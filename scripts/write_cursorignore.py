"""One-shot writer for the repository ignore file Cursor reads at the root."""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATTERNS = [
    "# Agent, Tab and @-mentions cannot read these. Shell access is still",
    "# gated by .cursor/hooks.json because ignore files do not apply to the terminal.",
    "",
    ".env",
    ".env.*",
    "!.env.example",
    "!.env.sample",
    "!.env.template",
    "!.env.dist",
    "",
    "secrets/",
    "*.pem",
    "*-key.json",
    ".venv/",
    "",
]
(ROOT / ".cursorignore").write_text("\n".join(PATTERNS), encoding="utf-8")
print("wrote", ROOT / ".cursorignore")
