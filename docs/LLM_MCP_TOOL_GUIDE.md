# 小说资料台 MCP 工具调用说明书

适用对象：Cherry Studio 里的写作模型、构思助手、总结助手，或者任何支持 MCP 工具调用的 LLM。

这份文档的目标很直接：让模型**真的去调用工具**，而不是只口头答应。  
你可以把“通用系统提示词”整段贴给模型，再按章节目标追加对应的工具提示词。

## 通用系统提示词

```text
你正在使用“小说资料台”的 MCP 工具来管理小说设定、角色、世界观、地图、时间线和章节正文。

强制规则：
1. 只要需要读取、修改、保存或确认资料，就必须真实调用 MCP 工具。
2. 没有拿到工具返回结果之前，不得声称“已经读取”“已经保存”“已经修改”。
3. 多本书并行时，优先显式传 project_title 或 project_id，禁止凭空猜当前书。
4. 删除类操作不能直接执行，只能调用 proposal 工具提交待确认请求。
5. 写入时要尽量只改必要字段，避免无关字段被覆盖。
6. 章节写作流程优先：读取上下文 -> 写正文 -> 保存正文 -> 提取摘要/事实/伏笔 -> 更新角色/世界/时间线。
7. 如果工具返回错误，先修正参数并重试，不要用自然语言解释来冒充工具结果。
8. 如果你不确定该调哪个工具，先调用 list_projects、get_context_pack 或 get_world_state 进行确认。

输出规则：
- 如果已经调用工具，就只根据工具结果继续。
- 如果需要用户确认，直接说明缺什么，不要编造。
```

## 推荐工作流提示词

### 1. 初始化一本新书

```text
请先调用 create_project 创建新项目，随后根据我提供的书名、题材、梗概和初始设定调用 init_project 写入世界观、角色、地图和时间线。
如果是多本书并行，请始终使用 project_title 明确路由，不能把内容写到当前激活书里。
```

### 2. 开始写一章

```text
请先调用 get_context_pack 获取当前章节所需的上下文包。
拿到结果后，再根据上下文写正文，并在章节结束后保存章节正文和章节摘要。
不要只输出写作建议，必须先读资料再写。
```

### 3. 保存正文并抽取新信息

```text
请调用 save_full_chapter 保存我刚编辑后的章节正文，然后调用 get_full_chapter 复核正文。
接着从正文中抽取新增事实、角色变化、世界变化和伏笔，最后调用 add_chapter_summary 记录章节摘要。
如果正文里出现了新的角色状态、位置变化或世界设定变化，再分别调用 propose_character_update 或 propose_world_update。
```

### 4. 只想查看当前资料

```text
请先调用 get_context_pack 或 get_world_state 查看当前资料，不要直接凭记忆回答。
如果我问的是某个角色，就优先调用 get_character。
如果我问的是时间线，就优先调用 get_timeline。
```

### 5. 处理待确认变更

```text
请调用 get_pending_changes 查看当前有哪些待确认变更。
查看后先整理给我，不要自己批准或拒绝；批准/拒绝由前端作者手动处理。
```

## 工具总表

### `healthcheck`

用途：
- 检查 MCP 服务是否可用
- 检查数据库路径
- 查看当前激活项目

适合什么时候调用：
- Cherry Studio 刚连上 MCP 的时候
- 你怀疑工具没有连通的时候
- 切换环境后先做一次探测

输入：
- 无

返回：
- `status`
- `service`
- `database_path`
- `project`

可直接发给 LLM 的提示词：

```text
请先调用 healthcheck，确认 MCP 服务、数据库路径和当前项目是否正常。
如果返回异常，请把异常点列出来，不要自行猜测连接状态。
```

---

### `list_projects`

用途：
- 列出所有小说项目
- 查看当前激活项目

适合什么时候调用：
- 你有多本书并行推进
- 你不确定当前正在操作哪一本书
- 需要切换项目前先确认列表

输入：
- 无

返回：
- `active_project`
- `projects`

可直接发给 LLM 的提示词：

```text
请调用 list_projects，列出所有小说项目和当前激活项目。
如果发现有多本同名或相近项目，请先提示我确认，不要自行选择。
```

---

### `create_project(title, genre="", premise="")`

用途：
- 创建一本新小说项目
- 自动切换到新项目

适合什么时候调用：
- 我明确要求你新开一本书
- 你正在做一个全新的创作分支

输入：
- `title`：书名，必填
- `genre`：题材，可选
- `premise`：梗概，可选

返回：
- `project`
- `active_project`

可直接发给 LLM 的提示词：

```text
请调用 create_project 创建一本新小说项目，书名用我给出的标题，题材和梗概按我提供的内容填写。
创建完成后请告诉我当前激活的是哪一本书，不要把内容写进别的项目。
```

---

### `switch_project(project_title=None, project_id=None)`

用途：
- 切换当前激活小说

适合什么时候调用：
- 我明确说“切到《某书》”
- 你要在多本书之间切换写作
- 你发现当前项目不对

输入：
- `project_title`：书名
- `project_id`：项目 ID

返回：
- 切换后的项目仪表盘

可直接发给 LLM 的提示词：

```text
请调用 switch_project 切换到我指定的小说。
如果我给的是书名，就按书名切换；如果书名不唯一，请先提醒我确认，不要自行猜测。
```

---

### `propose_delete_project(project_title=None, project_id=None, reason="")`

用途：
- 提交删除小说请求
- 不会直接删除，只会进入待确认队列

适合什么时候调用：
- 我明确要求删除某本书
- 你发现当前书应该被废弃，但不能直接执行破坏性删除

输入：
- `project_title` 或 `project_id`
- `reason`：删除原因

返回：
- 删除提案结果

可直接发给 LLM 的提示词：

```text
请调用 propose_delete_project 提交删除小说请求，不要直接删除任何数据。
如果涉及破坏性操作，必须先走待确认流程，等待作者在前端批准。
```

---

### `init_project(payload, project_title=None, project_id=None)`

用途：
- 用一整套结构化数据初始化项目
- 写入书名、题材、梗概、规则、角色、世界书、地图、时间线

重要提醒：
- 这个工具会先清空当前项目的相关资料，再写入新的初始化内容
- 适合“重建整本书”的场景，不适合当普通增量写入工具

适合什么时候调用：
- 构思助手刚产出完整架构
- 我要求你“一次性建档”
- 需要把整本书的初始资料灌进去

输入：
- `payload.title`
- `payload.genre`
- `payload.premise`
- `payload.rules`
- `payload.current_chapter`
- `payload.current_scene_goal`
- `payload.current_conflict`
- `payload.characters`
- `payload.lore_entries`
- `payload.map_nodes`
- `payload.timeline`

返回：
- 当前项目仪表盘

可直接发给 LLM 的提示词：

```text
请调用 init_project，把我给你的整套小说架构写入当前项目。
如果是新书，请先确保项目路由正确；如果是已有书，先确认我是否真的要覆盖初始化内容，因为这个工具会清空当前项目后重建。
```

---

### `get_context_pack(scene_goal, chapter=None, keywords=None, characters=None, project_title=None, project_id=None)`

用途：
- 读取章节写作所需的上下文包
- 包含项目、角色、世界书、时间线、最近摘要、待确认变更

适合什么时候调用：
- 每章开写前
- 每个重要场景开写前
- 你需要确认角色、地点、伏笔是否一致的时候

输入：
- `scene_goal`：本场景目标，必填
- `chapter`：章节号，可选
- `keywords`：关键词列表，可选
- `characters`：关心的角色名列表，可选
- `project_title` / `project_id`：建议在多书并行时显式填写

返回：
- `project`
- `scene_goal`
- `chapter`
- `characters`
- `world`
- `relevant_lore`
- `timeline`
- `recent_summaries`
- `pending_changes`

可直接发给 LLM 的提示词：

```text
请先调用 get_context_pack，读取本章写作所需的上下文包。
拿到结果后，再根据上下文继续写作，不要凭记忆补设定。
如果是多本书并行，请显式传 project_title 或 project_id。
```

---

### `get_character(name, project_title=None, project_id=None)`

用途：
- 查询某个角色的完整状态
- 适合查看角色的基础字段和扩展状态变量

适合什么时候调用：
- 我要看某个人现在怎么样
- 角色状态可能刚发生变化
- 需要写角色相关剧情前

输入：
- `name`：角色名，必填
- `project_title` / `project_id`：建议在多书并行时显式填写

返回：
- 角色完整资料，可能包含 `state_variables`

可直接发给 LLM 的提示词：

```text
请调用 get_character 查询这个角色的完整状态，不要用记忆补全。
如果我给了书名或项目 ID，请严格按该项目读取。
```

---

### `propose_character_update(name, patch, reason="", project_title=None, project_id=None)`

用途：
- 提交角色状态变更
- 轻量字段可能直接写入，核心设定字段会进入待确认队列

适合什么时候调用：
- 角色位置变了
- 角色情绪、身体状态、关系状态更新了
- 角色的状态变量需要同步更新

输入：
- `name`：角色名，必填
- `patch`：要更新的字段
- `reason`：变更原因
- `project_title` / `project_id`

推荐写法：
- 尽量只传真正变化的字段
- `state_variables` 可以直接作为结构化对象写入

返回：
- 变更结果，可能包含 `pending` 信息

可直接发给 LLM 的提示词：

```text
请调用 propose_character_update 更新这个角色的状态。
只提交真正变化的字段，核心设定如果需要改动请走待确认流程，不要直接覆盖旧值。
如果要更新角色的扩展状态变量，请直接放进 state_variables。
```

---

### `propose_delete_character(name, project_title=None, project_id=None, reason="")`

用途：
- 提交删除角色卡请求
- 不会直接删除，只会进入待确认队列

适合什么时候调用：
- 我明确要求删除某个角色
- 某个角色应该从当前书中彻底移除，但不能直接破坏性执行

输入：
- `name`：角色名
- `reason`：删除原因
- `project_title` / `project_id`

返回：
- 删除提案结果

可直接发给 LLM 的提示词：

```text
请调用 propose_delete_character 提交删除这个角色的请求，不要直接删除数据。
删除类操作必须进入待确认队列，等作者在前端处理。
```

---

### `get_world_state(scope=None, project_title=None, project_id=None)`

用途：
- 查询世界观、世界书、地图节点和地图图片元数据

适合什么时候调用：
- 我在问世界设定
- 我在问某个地点、势力、地图范围
- 我需要核对地图相关的结构信息

输入：
- `scope`：范围关键词，可选
- `project_title` / `project_id`

返回：
- 世界观、世界书、地图节点等结构化数据

可直接发给 LLM 的提示词：

```text
请调用 get_world_state 查看世界设定和地图信息，不要只凭记忆回答。
如果我指定了书名，请按对应项目读取。
```

---

### `propose_world_update(patch=None, reason="", project_title=None, project_id=None, title="", entries=None, map_nodes=None)`

用途：
- 提交世界观、地图、世界书、规则等变更
- 核心世界设定会进入待确认队列

适合什么时候调用：
- 新增世界书词条
- 修正地图节点
- 修改势力归属、规则、地图结构
- 记录新的世界事实

输入：
- 推荐使用 `patch`
- 兼容旧写法时也可以传 `title`、`entries`、`map_nodes`
- `reason`：变更原因

返回：
- 变更结果，可能包含 `pending` 信息

可直接发给 LLM 的提示词：

```text
请调用 propose_world_update 提交世界观或地图变更。
核心设定、地图结构、规则改动请走待确认流程，不要直接当成已生效事实。
如果我给的是旧格式数据，也可以转换后再提交，但不要跳过工具。
```

---

### `get_timeline(chapter_range=None, project_title=None, project_id=None)`

用途：
- 查询时间线
- 按章节范围查看事件记录

适合什么时候调用：
- 我问“之前发生了什么”
- 你要核对时间顺序
- 需要检查章节之间的连续性

输入：
- `chapter_range`：例如 `1-20`
- `project_title` / `project_id`

返回：
- 时间线事件列表

可直接发给 LLM 的提示词：

```text
请调用 get_timeline 核对时间线，不要用印象流补事件顺序。
如果我指定了章节范围，请按范围读取。
```

---

### `add_chapter_summary(chapter, summary, facts=None, hooks=None, title="", project_title=None, project_id=None)`

用途：
- 保存章节摘要
- 保存本章新增事实
- 保存本章伏笔

适合什么时候调用：
- 一章写完之后
- 章节正文已保存后
- 需要把本章信息压缩进资料库的时候

输入：
- `chapter`：章节号，必填
- `summary`：章节摘要，必填
- `facts`：新增事实
- `hooks`：伏笔
- `title`：章节标题，可选

返回：
- 章节摘要保存结果

可直接发给 LLM 的提示词：

```text
请在章节写完后调用 add_chapter_summary，保存这一章的摘要、新增事实和伏笔。
事实和伏笔要尽量结构化、简洁，不要写成散文式长段落。
```

---

### `list_full_chapters(project_title=None, project_id=None)`

用途：
- 列出已保存的完整正文
- 只返回章节号、标题和长度，不返回全文

适合什么时候调用：
- 我想知道当前存了哪些章节正文
- 需要先确认有哪些全文可以编辑

输入：
- `project_title` / `project_id`

返回：
- 章节列表

可直接发给 LLM 的提示词：

```text
请调用 list_full_chapters，列出当前项目已保存的完整正文章节。
注意这里只是清单，不会返回全文。
```

---

### `get_full_chapter(chapter, project_title=None, project_id=None)`

用途：
- 读取某一章的完整正文
- 适合做复核、抽取和再编辑

适合什么时候调用：
- 我要让模型复核我改过的正文
- 要从全文中重新抽取事实、伏笔和状态变化
- 要检查某章正文是否已正确保存

输入：
- `chapter`：章节号，必填
- `project_title` / `project_id`

返回：
- 章节完整正文

可直接发给 LLM 的提示词：

```text
请调用 get_full_chapter 读取这一章的完整正文。
读完后再帮我抽取新增事实、角色变化、世界变化和伏笔，不要只给概述。
```

---

### `save_full_chapter(chapter, content, title="", source="llm", project_title=None, project_id=None)`

用途：
- 保存或更新某章完整正文
- 支持作者编辑后的正文回写

适合什么时候调用：
- 我已经改好正文，要保存回系统
- LLM 根据编辑结果重写了这一章
- 你要把正文作为后续抽取的基础资料

输入：
- `chapter`：章节号，必填
- `content`：完整正文，必填
- `title`：章节标题，可选
- `source`：来源，默认 `llm`

返回：
- 保存后的章节信息

可直接发给 LLM 的提示词：

```text
请调用 save_full_chapter 保存我编辑后的章节全文。
保存后你还要继续调用 get_full_chapter 复核，然后提取新的关键信息，更新摘要、角色状态、世界观和时间线。
```

---

### `get_pending_changes()`

用途：
- 查看待人工确认的变更队列

适合什么时候调用：
- 我想知道有哪些变更还没确认
- 你要向我汇报 LLM 提交了什么待审内容

输入：
- 无

返回：
- 待确认变更列表

可直接发给 LLM 的提示词：

```text
请调用 get_pending_changes 查看当前待确认变更。
查看后只做整理和说明，不要擅自批准、拒绝或伪造审批结果。
```

## 一套最稳的章节闭环

如果你想让模型尽量少偷懒，最推荐的顺序是：

1. `switch_project` 或在所有调用里显式带 `project_title`
2. `get_context_pack`
3. 写正文
4. `save_full_chapter`
5. `get_full_chapter`
6. 抽取新增事实、角色变化、世界变化、伏笔
7. `add_chapter_summary`
8. 需要时调用 `propose_character_update` / `propose_world_update`
9. 最后 `get_pending_changes` 汇总待确认项

## 直接复制给 LLM 的短版总提示词

如果你只想贴一段最短的通用提示词，可以直接用这个：

```text
你正在使用小说资料台 MCP 工具。
需要读取或修改资料时，必须真实调用工具，不能只口头答应。
多本书并行时，必须显式传 project_title 或 project_id。
删除类只能提交 proposal，不可直接删除。
章节流程优先：get_context_pack -> 写正文 -> save_full_chapter -> get_full_chapter -> add_chapter_summary -> 更新角色/世界 -> get_pending_changes。
没有工具返回之前，不得声称已完成读取或保存。
```
