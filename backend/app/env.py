"""
Environment loading, done once and done first.

Both the full district service and the chat-only deployment read keys from
os.environ at import time, so whichever of them starts has to have loaded
backend/.env before its first os.environ.get call. Importing this module is
that guarantee — it is imported for its side effect, which is why it holds
no functions worth calling.
"""

import os

# A real key belongs in backend/.env (git-ignored), not in an exported shell
# variable: the export dies with the terminal, which is how a demo that worked
# last night is a 503 the next morning. Loaded before anything below reads
# os.environ, and loudly skipped rather than silently ignored.
_ENV_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
try:
    from dotenv import load_dotenv

    load_dotenv(_ENV_FILE)
except ImportError:  # pragma: no cover - depends on the host's install
    if os.path.exists(_ENV_FILE):
        print(
            f"WARNING: {_ENV_FILE} exists but python-dotenv is not installed, so its "
            "values were NOT loaded. Run: pip install -r requirements.txt",
            flush=True,
        )
