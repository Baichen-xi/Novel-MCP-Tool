from __future__ import annotations

import os

import uvicorn


def main() -> None:
    os.environ.setdefault("PYTHONUTF8", "1")
    port = int(os.getenv("NOVEL_COCKPIT_PORT", "8765"))
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
