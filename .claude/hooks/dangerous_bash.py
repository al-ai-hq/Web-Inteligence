#!/usr/bin/env python3
"""dangerous_bash: PreToolUse hook for Bash.

Blocks:
- recursive deletes (`rm -r`, `rm -rf`, ...) whose target is outside the
  repository, is the repository root itself, or cannot be resolved (for
  example `$UNSET/`); paths under the system temp directory are allowed;
- force pushes (`--force`, `-f`, `--force-with-lease`, `+refspec`) and branch
  deletes aimed at main or master;
- piping a download into a shell (`curl ... | sh`, `wget ... | bash`,
  `sh <(curl ...)`, `bash -c "$(curl ...)"`);
- reading credential locations: ~/.config/gcloud,
  application_default_credentials.json, .env files (not .env.example,
  .env.sample, .env.template, .env.dist), ~/.aws/credentials, ~/.ssh/id_*,
  .netrc, .git-credentials, and commands that print credentials or secrets
  (`gcloud auth print-access-token`, `gcloud secrets versions access`);
- `--dangerously-skip-permissions`.

Commands inside `sh -c`, `bash -c`, `zsh -c` and `eval` are checked too.
Known limits: targets passed through xargs or find -delete are not resolved.

Exit 0 allows. Exit 2 blocks with the reason on stderr.

Sources: 04-CLAUDE-CODE-BUILD-PROMPT section 24 (deny destructive and
secret-reading operations; never use bypass-permissions modes),
05-PROJECT-PLAN section 11.
"""
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile

HOOK = "dangerous_bash"
ROUTES = {
    "delete": ("Recursive deletes outside the repository are not run by Claude Code. "
               "If the delete is needed, ask a human to run it in their own terminal."),
    "push": ("Never force-push or delete main/master. Push a branch and open a pull "
             "request; branch protection and a code owner decide the merge."),
    "pipe": ("Do not pipe downloads into a shell. Download the file, review it, pin "
             "its version and checksum, and add the step to a reviewed script or CI."),
    "creds": ("Credentials and secrets are never read or printed in a Claude Code "
              "session (managed settings deny it). Use Secret Manager references and "
              "workload identity; ask a human if a value must be checked."),
    "bypass": ("Bypass-permissions mode is disabled for this project. Run Claude Code "
               "with the reviewed permission rules in .claude/settings.json."),
    "input": "Fix the hook input or ask a human to run the command.",
}

SHELLS = {"sh", "bash", "zsh", "dash", "ksh"}
OPERATORS = {";", "&&", "||", "|", "&", "(", ")", "|&", ";;", "\n"}
PIPE_TO_SHELL = [
    re.compile(r"\b(?:curl|wget)\b[^|;&]*\|\s*(?:sudo\s+)?(?:env\s+)?(?:/\S*/)?(?:ba|z|da|k)?sh\b"),
    re.compile(r"\b(?:ba|z|da|k)?sh\s+<\(\s*(?:curl|wget)\b"),
    re.compile(r"\b(?:ba|z|da|k)?sh\s+-c\s+[\"']?\$\(\s*(?:curl|wget)\b"),
]
CREDENTIAL_PATTERNS = [
    ("gcloud credential directory", re.compile(r"\.config/gcloud\b|AppData[\\/]+Roaming[\\/]+gcloud", re.I)),
    ("application default credentials", re.compile(r"application_default_credentials\.json")),
    (".env file", re.compile(
        r"(?:^|[\s'\"=/<>(:])\.env(?:\.(?!(?:example|sample|template|dist)\b)[A-Za-z0-9_-]+)?(?=$|[\s'\";|&)<>])")),
    ("AWS credentials file", re.compile(r"\.aws/credentials\b")),
    ("SSH private key", re.compile(r"\.ssh/id_[A-Za-z0-9_]+(?!\.pub)\b")),
    (".netrc", re.compile(r"(?:^|[\s'\"/])\.netrc\b")),
    (".git-credentials", re.compile(r"\.git-credentials\b")),
    ("printing an access token", re.compile(r"\bgcloud\s+auth\s+(?:application-default\s+)?print-(?:access|identity)-token\b")),
    ("reading a Secret Manager value", re.compile(r"\bgcloud\s+secrets\s+versions\s+access\b")),
]


def block(kind, reason):
    sys.stderr.write("BLOCKED by %s: %s\nApproval route: %s\n" % (HOOK, reason, ROUTES[kind]))
    sys.exit(2)


def tokenize(command):
    # Newlines separate commands. Replacing them also splits multi-line quoted
    # strings and heredocs, which only makes the check more conservative.
    command = command.replace("\r", " ").replace("\n", " ; ")
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()")
        lexer.whitespace_split = True
        return list(lexer)
    except ValueError:
        return command.split()


def segments(tokens):
    current = []
    for token in tokens:
        if token in OPERATORS or token.strip() == "" or set(token) <= set(";&|()"):
            if current:
                yield current
            current = []
        else:
            current.append(token)
    if current:
        yield current


def strip_prefixes(words):
    """Drop sudo, env assignments, env, command, nohup, time, exec."""
    i = 0
    while i < len(words):
        word = words[i]
        if word in ("sudo", "doas", "env"):
            i += 1
            while i < len(words) and words[i].startswith("-"):
                takes_value = words[i] in ("-u", "-g", "-h", "-p", "-C", "-U", "-r", "-t", "-D", "-S")
                i += 2 if takes_value and word != "env" else 1
            continue
        if word in ("command", "nohup", "time", "exec", "builtin"):
            i += 1
            continue
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", word):
            i += 1
            continue
        break
    return words[i:]


def inside(path, root):
    return path == root or path.startswith(root.rstrip(os.sep) + os.sep)


def check_rm(args, cwd, root):
    recursive, targets, end_of_flags = False, [], False
    for arg in args:
        if not end_of_flags and arg == "--":
            end_of_flags = True
            continue
        if not end_of_flags and arg.startswith("--"):
            if arg in ("--recursive",):
                recursive = True
            continue
        if not end_of_flags and arg.startswith("-") and len(arg) > 1:
            if "r" in arg[1:] or "R" in arg[1:]:
                recursive = True
            continue
        targets.append(arg)
    if not recursive:
        return
    root_real = os.path.realpath(root)
    temp_real = os.path.realpath(tempfile.gettempdir())
    for target in targets:
        expanded = os.path.expandvars(os.path.expanduser(target))
        if "$" in expanded or "`" in expanded:
            block("delete", "recursive delete of %r: target cannot be resolved" % target)
        glob_free = re.split(r"[*?\[]", expanded, maxsplit=1)[0] or "."
        path = glob_free if os.path.isabs(glob_free) else os.path.join(cwd, glob_free)
        path = os.path.realpath(os.path.normpath(path))
        if path == root_real:
            block("delete", "recursive delete of %r would remove the repository root" % target)
        if inside(path, root_real):
            continue
        if path != temp_real and inside(path, temp_real):
            continue
        block("delete", "recursive delete of %r resolves outside the repository (%s)" % (target, path))


def current_branch(cwd):
    try:
        result = subprocess.run(["git", "-C", cwd, "rev-parse", "--abbrev-ref", "HEAD"],
                                capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def check_git(args, cwd):
    i = 0
    while i < len(args) and args[i].startswith("-"):
        i += 2 if args[i] in ("-C", "-c", "--git-dir", "--work-tree", "--namespace") else 1
    if i >= len(args) or args[i] != "push":
        return
    push_args = args[i + 1:]
    force = delete = everything = False
    positional = []
    for arg in push_args:
        if arg == "--mirror":
            force = everything = True
        elif arg == "--force" or arg.startswith("--force-with-lease"):
            force = True
        elif arg == "--delete":
            delete = True
        elif arg == "--all":
            everything = True
        elif arg.startswith("--"):
            continue
        elif arg.startswith("-") and len(arg) > 1:
            if "f" in arg[1:]:
                force = True
            if "d" in arg[1:]:
                delete = True
        else:
            positional.append(arg)
    refspecs = positional[1:]
    protected = ("main", "master")

    def target_of(spec):
        dst = spec.split(":", 1)[1] if ":" in spec else spec
        return dst.lstrip("+").replace("refs/heads/", "")

    for spec in refspecs:
        dst = target_of(spec)
        if dst in protected and (force or delete or spec.startswith("+") or spec.startswith(":")):
            block("push", "force push or delete aimed at %s" % dst)
    if (force or delete) and everything:
        block("push", "forced or deleting push of all branches, including main/master")
    if force and not refspecs:
        branch = current_branch(cwd)
        if branch is None or branch in protected or branch == "HEAD":
            block("push", "force push from branch %s (main/master or unknown)" % (branch or "unknown"))


def check_segment(words, cwd, root, depth):
    words = strip_prefixes(words)
    if not words:
        return
    name = os.path.basename(words[0])
    if name == "rm":
        check_rm(words[1:], cwd, root)
    elif name == "git":
        check_git(words[1:], cwd)
    elif name in SHELLS and depth < 3:
        for j, word in enumerate(words[1:], start=1):
            if word == "-c" and j + 1 < len(words):
                check_command(words[j + 1], cwd, root, depth + 1)
                break
    elif name == "eval" and depth < 3:
        check_command(" ".join(words[1:]), cwd, root, depth + 1)


def check_command(command, cwd, root, depth=0):
    if "--dangerously-skip-permissions" in command:
        block("bypass", "`--dangerously-skip-permissions` is not allowed")
    for pattern in PIPE_TO_SHELL:
        if pattern.search(command):
            block("pipe", "command pipes a download into a shell")
    for label, pattern in CREDENTIAL_PATTERNS:
        if pattern.search(command):
            block("creds", "command touches a credential location or prints a secret (%s)" % label)
    for words in segments(tokenize(command)):
        check_segment(words, cwd, root, depth)


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw) if raw.strip() else {}
    except ValueError:
        block("input", "hook input is not valid JSON, so the command could not be checked")
    if not isinstance(data, dict):
        block("input", "hook input is not a JSON object, so the command could not be checked")
    if (data.get("tool_name") or "") != "Bash":
        sys.exit(0)
    tool_input = data.get("tool_input") or {}
    if not isinstance(tool_input, dict):
        sys.exit(0)
    root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
    cwd = data.get("cwd") or root
    check_command(str(tool_input.get("command") or ""), cwd, root)
    sys.exit(0)


if __name__ == "__main__":
    main()
