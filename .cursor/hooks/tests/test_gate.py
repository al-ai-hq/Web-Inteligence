"""Tests for the Cursor hook gate in .cursor/hooks/gate.py.

Payloads use Cursor field names (path/contents, top-level command, file_path
on reads). The gate must deny what the Claude hooks deny, and must allow
ordinary work.
"""
import json
import os
import subprocess
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
GATE = os.path.join(ROOT, ".cursor", "hooks", "gate.py")


def run_gate(mode, payload):
    return _run([GATE, mode], payload)


def run_gate_event(payload):
    return _run([GATE], payload)


def _run(args, payload):
    return subprocess.run(
        ["python3", *args],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=ROOT,
        env={**os.environ, "CURSOR_PROJECT_DIR": ROOT, "CLAUDE_PROJECT_DIR": ROOT},
    )


class GateTest(unittest.TestCase):
    def decision(self, result):
        self.assertTrue(result.stdout.strip(), result.stderr)
        return json.loads(result.stdout)

    def test_hooks_json_points_every_event_at_the_gate(self):
        with open(os.path.join(ROOT, ".cursor", "hooks.json"), encoding="utf-8") as handle:
            config = json.load(handle)
        self.assertEqual(config["version"], 1)
        for event in ("sessionStart", "preToolUse", "beforeShellExecution", "beforeReadFile", "beforeTabFileRead", "afterFileEdit"):
            hook = config["hooks"][event][0]
            self.assertEqual(hook["command"], ".cursor/hooks/gate.py")
            self.assertNotIn("failClosed", hook)

    def test_write_contents_with_secret_is_denied(self):
        secret = "SESSION" + "_SECRET=" + "h7Gk2Lp9Qx4Rt8Vz"
        result = run_gate("files", {
            "hook_event_name": "preToolUse",
            "tool_name": "Write",
            "tool_input": {"path": "apps/web/lib/session.ts", "contents": secret + "\n"},
        })
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(self.decision(result)["permission"], "deny")

    def test_ordinary_write_is_allowed(self):
        result = run_gate("files", {
            "tool_name": "Write",
            "tool_input": {"path": "apps/web/lib/session.ts", "contents": "export const label = 'ready';\n"},
        })
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.decision(result)["permission"], "allow")

    def test_patch_new_string_secret_is_denied(self):
        secret = "SESSION" + "_SECRET=" + "h7Gk2Lp9Qx4Rt8Vz"
        result = run_gate("files", {
            "tool_name": "Write",
            "tool_input": {
                "path": "apps/missing-file.ts",
                "old_string": "export const label = 'ready';",
                "new_string": secret,
            },
        })
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(self.decision(result)["permission"], "deny")

    def test_shell_delete_outside_repo_is_denied(self):
        result = run_gate("shell", {"hook_event_name": "beforeShellExecution", "command": "rm -rf /", "cwd": ROOT})
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(self.decision(result)["permission"], "deny")

    def test_ordinary_shell_is_allowed(self):
        result = run_gate("shell", {"command": "git status", "cwd": ROOT})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.decision(result)["permission"], "allow")

    def test_git_push_asks(self):
        result = run_gate("shell", {"command": "git push origin feature/int-00", "cwd": ROOT})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.decision(result)["permission"], "ask")

    def test_force_push_to_main_is_denied_before_ask(self):
        result = run_gate("shell", {"command": "git push --force origin main", "cwd": ROOT})
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(self.decision(result)["permission"], "deny")

    def test_env_read_is_denied_and_template_is_allowed(self):
        denied = run_gate("read", {"file_path": os.path.join(ROOT, ".env")})
        self.assertEqual(denied.returncode, 2)
        self.assertEqual(self.decision(denied)["permission"], "deny")
        allowed = run_gate("read", {"file_path": os.path.join(ROOT, ".env.example")})
        self.assertEqual(allowed.returncode, 0, allowed.stderr)
        self.assertEqual(self.decision(allowed)["permission"], "allow")

    def test_ssh_read_is_denied(self):
        result = run_gate("read", {"file_path": os.path.expanduser("~/.ssh/id_ed25519")})
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.decision(result)["permission"], "deny")

    def test_event_name_selects_shell_mode(self):
        result = run_gate_event({"hook_event_name": "beforeShellExecution", "command": "git status", "cwd": ROOT})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.decision(result)["permission"], "allow")

    def test_webfetch_asks(self):
        result = run_gate("files", {"tool_name": "WebFetch", "tool_input": {"url": "https://example.com"}})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.decision(result)["permission"], "ask")

    def test_format_without_prettier_exits_clean(self):
        result = run_gate("format", {"file_path": os.path.join(ROOT, "AGENTS.md"), "edits": []})
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_invalid_json_on_files_denies(self):
        result = subprocess.run(
            ["python3", GATE, "files"],
            input="{",
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stdout)["permission"], "deny")

    def test_skill_links_point_at_claude_skills(self):
        skills = os.path.join(ROOT, ".cursor", "skills")
        for name in sorted(os.listdir(skills)):
            path = os.path.join(skills, name)
            self.assertTrue(os.path.islink(path), name)
            target = os.path.realpath(path)
            self.assertTrue(target.endswith(os.path.join(".claude", "skills", name)), target)
            self.assertTrue(os.path.isfile(os.path.join(target, "SKILL.md")), name)


if __name__ == "__main__":
    unittest.main()
