from __future__ import annotations

import os
import sys

os.environ.setdefault("FASTMCP_LOG_ENABLED", "false")
os.environ.setdefault("FASTMCP_SHOW_SERVER_BANNER", "false")
sys.stderr = open(os.devnull, "w", encoding="utf-8")

from app.mcp_server import mcp


def main() -> None:
    mcp.run(show_banner=False)


if __name__ == "__main__":
    main()
