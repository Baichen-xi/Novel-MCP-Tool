# Cherry Studio 小说知识库

一个本地小说资料系统：Cherry Studio 负责创作，LLM 通过 MCP 工具读写设定数据；浏览器版 React 前端负责实时查看、纠错和确认关键变更。

## 运行后端

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8765
```

也可以直接运行：

```powershell
.\scripts\start-backend.ps1
```

## 运行前端 Web 调试

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`。后端默认连接 `http://localhost:8765`。

也可以直接运行：

```powershell
.\scripts\start-web.ps1
```

前端冒烟测试：

```powershell
cd frontend
npm test
```

如果想同时构建后端 exe 和前端静态资源，可以运行：

```powershell
.\scripts\build-web.ps1
```

这会先生成 `backend/dist/novel-cockpit-backend.exe` 和 `backend/dist/novel-cockpit-mcp.exe`，再构建前端 `frontend/dist`，方便后续放到 VPS 或反代环境里。

## Cherry Studio MCP

MCP 入口在 `backend/app/mcp_server.py`。安装依赖后可用：

```powershell
cd backend
python -m app.mcp_server
```

推荐先运行一键打包脚本，生成 `backend/dist/novel-cockpit-mcp.exe`。Cherry Studio 中可把 MCP 命令配置为：

```json
{
  "mcpServers": {
    "novel-cockpit": {
      "command": "<项目目录>\\backend\\dist\\novel-cockpit-mcp.exe",
      "args": [],
      "env": {
        "NOVEL_COCKPIT_DB": "%APPDATA%\\local.novel.cockpit\\novel.db",
        "PYTHONUTF8": "1",
        "FASTMCP_SHOW_SERVER_BANNER": "false",
        "FASTMCP_LOG_ENABLED": "false"
      },
      "cwd": "<项目目录>"
    }
  }
}
```

同样的模板已保存为 `cherry-studio.mcp.example.json`。如果尚未构建 exe，也可以运行 `.\scripts\start-mcp.ps1`，它会优先使用 exe，找不到时回退到 Python 模块入口。

第一版 MCP 工具：

- `healthcheck`
- `init_project`
- `get_context_pack`
- `get_character`
- `propose_character_update`
- `get_world_state`
- `propose_world_update`
- `get_timeline`
- `add_chapter_summary`
- `get_pending_changes`

完整的“每个工具怎么用 + 可以直接发给 LLM 的提示词”已经整理到 [docs/LLM_MCP_TOOL_GUIDE.md](docs/LLM_MCP_TOOL_GUIDE.md)。

数据库只保留一份权威库，规范写在 [docs/数据库单库规范.md](docs/数据库单库规范.md)。

HTTP 接口、MCP 工具、service 层和数据库之间的关系，以及重复/缺失/风险项，整理在 [docs/接口与代码关系审计.md](docs/接口与代码关系审计.md)。后续新增或重构接口前建议先读这份文档。

如果 LLM 不确定某一类写入的 JSON 结构，先调用 `get_payload_templates` 拿模板，再写入，别靠猜字段名。

## 当前能力

- Cherry Studio 通过 MCP 初始化项目、读取上下文包、提交角色/世界变更、保存章节摘要。
- LLM 修改核心字段会进入待确认队列，作者可在前端页面批准或拒绝。
- 作者可直接修正角色、地图节点、世界书词条。
- 历史页记录角色、地图、世界书等变更，并支持对可回滚记录恢复到修改前快照。
- 时间线页显示章节摘要、事实和伏笔。
- 顶部提供项目 JSON 导入/导出，便于备份和迁移。
- 世界书区域提供 SillyTavern World Info JSON 导入/导出。
- 男女主页面提供 SillyTavern V2 角色卡 JSON 导入/导出，结构化字段保存在 `extensions.novel_cockpit`。
- 地图页支持“地图册”：可分别导入大千世界、三千道域、位面、道域、秘境等非连续地图图片，并在图片上新增、定位和编辑地图节点。
- 男女主当前位置会匹配结构化地图节点，匹配到节点后自动切换到对应地图册图片；DeepSeek 等非多模态模型不会读取图片本体，只读取节点、层级、位面、坐标、描述和世界书文本。
- 地图画布支持缩放、重置、左下角标度尺和放大后的鼠标拖动查看；界面变窄时地图与详情面板会自动换行，避免互相挤压。
- 地图图片可记录真实尺度：比例文字、横向/纵向范围、距离单位和尺度类型会进入 MCP 上下文包，旧地图未设置时显示“未设定比例”。
- 前端使用 GSAP 做轻量视图/地图节点过渡，并在系统开启“减少动态效果”时自动关闭动画。
- 时间线页支持导入完整章节正文（txt、md、JSON），用于作者阅读和核对；完整正文不会进入 MCP `get_context_pack`，避免污染后续 AI 记忆。
- 顶部提供项目切换和新建入口，MCP 默认操作当前激活项目。
- 多项目数据按当前激活项目隔离，允许不同项目使用相同角色名、地图节点名和章节号。

## 当前限制

- 开发模式仍依赖本机 Python 环境。正式部署建议先运行 `scripts/build-backend-exe.ps1` 生成随包后端 exe，再把 `frontend/dist` 部署到静态站点或反向代理后面。
- Cherry Studio 可以直接使用 `backend\dist\novel-cockpit-mcp.exe`，这个 exe 已在 stdio `healthcheck` 中验证过。
