# Development Status

## 已完成

- FastAPI + SQLite 后端。
- FastMCP 工具服务，已用 FastMCP Client 做端到端调用测试。
- React 悬浮资料台：当前状态、男女主、地图/世界书、时间线/章节摘要、历史、待确认。
- Tauri 桌面壳，窗口置顶。
- Tauri 启动时会尝试自动拉起 FastAPI 后端，优先使用随包后端 exe，数据库写入用户应用数据目录。
- 桌面端后端启动诊断：前端可显示后端目录、数据库、日志、Python 和依赖检查结果。
- LLM 核心字段写入保护：重要变更进入待确认队列。
- 作者直接纠错：角色、地图节点、世界书词条。
- 历史审计与回滚：角色、地图节点、世界书词条支持恢复修改前快照。
- 项目 JSON 导入导出。
- SillyTavern World Info JSON 导入导出。
- SillyTavern V2 角色卡 JSON 导入导出。
- 多项目第一版：项目新建、切换、当前项目数据过滤。
- 多项目同名支持：不同项目可使用相同角色名、地图节点名和章节号。
- 玄幻地图册：前端可分别导入大千世界、三千道域、位面、道域、秘境等非连续地图，地图节点支持 `map_image_id`、层级和位面字段。
- 地图自动切换：男女主当前位置会匹配结构化地图节点，并自动切到对应地图册图片；MCP/上下文包只暴露文本节点和图片元数据，不向非多模态模型发送图片本体。
- 地图画布交互：地图在窄界面下会自适应收缩，提供缩放、重置、左下角标度尺；放大后可按住鼠标拖动画布查看细节。
- 地图尺度系统：每张地图图片可保存 `scale_label`、`real_width`、`real_height`、`distance_unit`、`scale_kind`，用于表达同尺寸图片背后的真实世界大小差异。
- 前端体验优化：顶部动作区使用一致图标按钮，状态页和空状态文案更贴近作者资料台，地图册显示层级面包屑和节点统计，并尊重系统“减少动态效果”设置。
- 完整章节正文导入与阅读：前端可导入 txt、md、JSON 正文，`get_context_pack` 不包含完整正文，避免污染 AI 记忆。
- PyInstaller 后端 exe 构建脚本与一键桌面打包脚本。
- PyInstaller MCP exe，Cherry Studio 可直接通过 stdio 调用，并提供 `healthcheck` 工具。
- 前端 Vitest/jsdom 冒烟测试，覆盖当前状态、角色编辑、后端诊断和表单归一化。
- 前端 Vite 已升级到 8.x，`npm audit --audit-level=moderate` 为 0 漏洞。
- NSIS Windows 安装包打包通过。
- Release 产物冒烟测试脚本：检查桌面 exe、NSIS 安装包、随包后端 exe、随包 MCP exe，并真实启动后端和调用 MCP `healthcheck`；可选 `-LaunchDesktop` 验证桌面壳自动拉起后端。

## 当前限制

- 开发模式仍依赖本机 Python 环境。使用 `scripts/build-desktop.ps1` 生成的桌面安装包会包含随包后端 exe 和 MCP exe。

## 验证命令

```powershell
cd backend
python -m pytest
```

```powershell
cd frontend
npm test
```

```powershell
cd frontend
npm run build
```

```powershell
cd frontend\src-tauri
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 && cargo check"
```

```powershell
cd frontend
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat"" -arch=x64 -host_arch=x64 && npm run tauri:build"
```

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-release.ps1
```

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-release.ps1 -LaunchDesktop
```

## 当前产物

```text
frontend\src-tauri\target\release\novel-cockpit.exe
frontend\src-tauri\target\release\bundle\nsis\小说资料台_0.1.0_x64-setup.exe
```

## 下一步建议

- 增加 Cherry Studio 真实配置连通确认流程。
- 增加 Chroma/Qdrant 章节检索作为第二阶段记忆。
