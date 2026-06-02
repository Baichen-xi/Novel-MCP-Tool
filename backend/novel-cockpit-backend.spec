# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import copy_metadata

datas = []
datas += copy_metadata('fastmcp')
datas += copy_metadata('fastmcp-slim')


a = Analysis(
    ['app\\standalone.py'],
    pathex=['C:\\Users\\zero\\Desktop\\codex\\小说MCP工具\\backend'],
    binaries=[],
    datas=datas,
    hiddenimports=['app.main', 'app.mcp_server', 'fastmcp'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='novel-cockpit-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
