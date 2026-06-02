from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from .db import DB_PATH
from .schemas import ChapterSummaryIn, ContextRequest, FullChapterIn, ProjectInit
from .services import (
    add_chapter_summary as add_summary_service,
    create_project as create_project_service,
    get_faction as get_faction_service,
    list_factions as list_factions_service,
    get_full_chapter as get_full_chapter_service,
    get_character as get_character_service,
    get_context_pack as get_context_pack_service,
    get_project,
    get_power_system as get_power_system_service,
    get_timeline as get_timeline_service,
    get_world_state as get_world_state_service,
    get_world_profile as get_world_profile_service,
    init_project as init_project_service,
    import_full_chapter as save_full_chapter_service,
    list_full_chapters as list_full_chapters_service,
    list_projects as list_projects_service,
    list_pending_changes,
    prepare_project_context,
    propose_character_update as propose_character_update_service,
    propose_delete_character as propose_delete_character_service,
    propose_delete_project as propose_delete_project_service,
    propose_delete_faction as propose_delete_faction_service,
    propose_faction_update as propose_faction_update_service,
    propose_power_system_update as propose_power_system_update_service,
    propose_world_profile_update as propose_world_profile_update_service,
    propose_world_update as propose_world_update_service,
    switch_to_project,
    world_entries_to_patch,
)

mcp = FastMCP("novel-cockpit")

PAYLOAD_TEMPLATES: dict[str, Any] = {
    "project": {
        "title": "未命名作品",
        "genre": "玄幻/都市/末日/奇幻/科幻",
        "premise": "一句话概述故事开局与核心冲突",
        "rules": ["世界规则1", "世界规则2"],
        "world_profile": {"summary": "世界设定总览一段话"},
        "power_system": {
            "summary": "力量/境界设定总览一段话",
            "tiers": [
                {
                    "name": "炼气境",
                    "description": "吸纳并炼化外界力量，打通修行基础。",
                    "stages": [
                        {"name": "初期", "description": "刚踏入此境。"},
                        {"name": "中期", "description": "力量逐渐稳定。"},
                        {"name": "后期", "description": "接近突破瓶颈。"},
                    ],
                }
            ],
        },
        "characters": [],
        "factions": [],
        "lore_entries": [],
        "map_nodes": [],
        "timeline": [],
    },
    "character": {
        "name": "角色名",
        "aliases": ["别名1", "别名2"],
        "role": "主角/配角/男主/女主/重要配角/其他",
        "gender": "男/女",
        "personality": "性格",
        "realm": "当前境界",
        "identity": "书中身份",
        "status": "存活/死亡",
        "location": "当前地点",
        "faction": "所属阵营",
        "bloodline": "血脉",
        "abilities": ["所修功法1", "所修功法2"],
        "equipment": ["装备1"],
        "relationship_notes": "人物关系备注",
        "public_facts": ["公开事实"],
        "private_facts": ["隐藏事实"],
        "locked_facts": ["禁改事实"],
        "state_variables": {
            "identity": {"公开身份": "", "隐藏身份": "", "社会角色": "", "阵营": ""},
            "appearance": {"外貌": "", "衣着": "", "气质": "", "显著特征": []},
            "body": {"身体状态": "", "伤势": [], "疲劳": "", "限制": []},
            "emotion": {"情绪": "", "欲望": "", "恐惧": "", "执念": "", "压力": ""},
            "relationship": {"信任": "", "好感": "", "敌意": "", "依赖": "", "备注": ""},
            "plot": {"当前目标": "", "秘密": [], "把柄": [], "伏笔": [], "禁改": []},
            "scene": {"位置": "", "同行者": [], "物品": [], "短期行动": ""},
            "custom": {}
        },
    },
    "faction": {
        "name": "势力名",
        "aliases": ["别名1", "别名2"],
        "type": "宗门/家族/王朝/公司/避难所/教会/军团",
        "level": "层级",
        "status": "active",
        "parent_name": "上级势力",
        "location": "总部/驻地",
        "sphere": "势力范围",
        "leader": "领袖",
        "core_members": ["核心成员1"],
        "allies": ["盟友1"],
        "enemies": ["敌对势力1"],
        "sub_factions": ["下属势力1"],
        "summary": "组织简介",
        "ideology": "理念/目标/价值观",
        "resources": "资源与底蕴",
        "plot_notes": "剧情备注",
        "locked_facts": ["禁改事实"],
        "tags": ["标签1"],
    },
    "map_node": {
        "name": "节点名",
        "type": "region/city/sect/building/secret_realm/place",
        "shape": "point/polygon",
        "layer": "地图层级",
        "plane": "位面/世界层",
        "parent_name": "上级节点",
        "description": "地点说明",
        "faction": "所属势力",
        "color": "120,146,185",
        "x": 50,
        "y": 50,
        "polygon_points": [{"x": 40, "y": 40}, {"x": 60, "y": 40}, {"x": 60, "y": 60}, {"x": 40, "y": 60}],
    },
    "world_profile": {"summary": "世界观总览一段话"},
    "power_system": {
        "summary": "力量体系总览一段话",
        "tiers": [
            {
                "name": "第一大境界",
                "description": "这一层境界的核心描述。",
                "stages": [
                    {"name": "初期", "description": "小境界说明。"},
                    {"name": "中期", "description": "小境界说明。"},
                    {"name": "后期", "description": "小境界说明。"},
                ],
            }
        ],
    },
}


@mcp.tool()
def healthcheck() -> dict[str, Any]:
    """检查 MCP 服务、数据库路径和当前项目。"""
    project = get_project()
    return {
        "status": "ok",
        "service": "novel-cockpit-mcp",
        "database_path": str(DB_PATH),
        "project": {
            "id": project.get("id"),
            "title": project.get("title"),
            "current_chapter": project.get("current_chapter"),
        },
    }


@mcp.tool()
def get_payload_templates(kind: str | None = None) -> dict[str, Any]:
    """获取标准 JSON 模板。写入前不确定结构时先调用，避免字段拼错或遗漏。"""
    if kind:
        template = PAYLOAD_TEMPLATES.get(kind)
        if template is None:
            return {"kind": kind, "templates": PAYLOAD_TEMPLATES}
        return {"kind": kind, "template": template}
    return {"templates": PAYLOAD_TEMPLATES}


@mcp.tool()
def list_projects() -> dict[str, Any]:
    """列出所有小说项目，并返回当前激活项目。"""
    return {"active_project": get_project(), "projects": list_projects_service()}


@mcp.tool()
def create_project(title: str, genre: str = "", premise: str = "") -> dict[str, Any]:
    """创建新小说项目并切换到该项目。"""
    return {"project": create_project_service(title, genre, premise), "active_project": get_project()}


@mcp.tool()
def switch_project(project_title: str | None = None, project_id: int | None = None) -> dict[str, Any]:
    """按书名或 ID 切换当前小说项目。"""
    return switch_to_project(project_id, project_title)


@mcp.tool()
def propose_delete_project(project_title: str | None = None, project_id: int | None = None, reason: str = "") -> dict[str, Any]:
    """提交删除小说请求。不会直接删除，需作者在前端待确认中批准。"""
    return propose_delete_project_service(project_id, project_title, reason, "llm")


@mcp.tool()
def init_project(payload: dict[str, Any], project_title: str | None = None, project_id: int | None = None) -> dict[str, Any]:
    """初始化小说项目，写入作品、角色、世界书、地图和时间线。"""
    validated = ProjectInit.model_validate(payload)
    prepare_project_context(project_id, project_title or validated.title, create_missing=True, genre=validated.genre, premise=validated.premise)
    return init_project_service(validated)


@mcp.tool()
def get_context_pack(
    scene_goal: str,
    chapter: int | None = None,
    keywords: list[str] | None = None,
    characters: list[str] | None = None,
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """读取当前写作所需上下文包。章节开始前优先调用。"""
    prepare_project_context(project_id, project_title)
    return get_context_pack_service(
        ContextRequest(
            scene_goal=scene_goal,
            chapter=chapter,
            keywords=keywords or [],
            characters=characters or [],
        )
    )


@mcp.tool()
def get_character(name: str, project_title: str | None = None, project_id: int | None = None) -> dict[str, Any] | None:
    """查询角色完整状态。"""
    prepare_project_context(project_id, project_title)
    return get_character_service(name)


@mcp.tool()
def propose_character_update(
    name: str,
    patch: dict[str, Any],
    reason: str = "",
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """提交角色状态变更。核心字段会进入待确认队列。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    return propose_character_update_service(name, patch, reason, "llm")


@mcp.tool()
def propose_delete_character(name: str, project_title: str | None = None, project_id: int | None = None, reason: str = "") -> dict[str, Any]:
    """提交删除角色卡请求。不会直接删除，需作者在前端待确认中批准。"""
    return propose_delete_character_service(name, project_id, project_title, reason, "llm")


@mcp.tool()
def get_factions(project_title: str | None = None, project_id: int | None = None) -> list[dict[str, Any]]:
    """读取当前项目的势力摘要列表。需要完整势力详情时再调用 get_faction。"""
    prepare_project_context(project_id, project_title)
    return list_factions_service(full=False)


@mcp.tool()
def get_faction(name: str, project_title: str | None = None, project_id: int | None = None) -> dict[str, Any] | None:
    """读取单个势力完整详情。"""
    prepare_project_context(project_id, project_title)
    return get_faction_service(name)


@mcp.tool()
def propose_faction_update(
    name: str,
    patch: dict[str, Any],
    reason: str = "",
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """提交势力新增或修改。核心字段会进入待确认队列。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    return propose_faction_update_service(name, patch, reason, "llm")


@mcp.tool()
def propose_delete_faction(name: str, reason: str = "", project_title: str | None = None, project_id: int | None = None) -> dict[str, Any]:
    """提交删除势力请求。不会直接删除，需作者在前端待确认中批准。"""
    prepare_project_context(project_id, project_title)
    return propose_delete_faction_service(name, reason, "llm")


@mcp.tool()
def get_world_state(scope: str | None = None, project_title: str | None = None, project_id: int | None = None) -> dict[str, Any]:
    """查询世界观、世界书和地图节点。"""
    prepare_project_context(project_id, project_title)
    return get_world_state_service(scope)


@mcp.tool()
def get_world_profile(project_title: str | None = None, project_id: int | None = None) -> dict[str, Any]:
    """读取项目级世界观总览。"""
    prepare_project_context(project_id, project_title)
    state = get_world_state_service()
    return {
        "world_profile": get_world_profile_service(),
        "world_profile_summary": state.get("world_profile_summary", ""),
    }


@mcp.tool()
def propose_world_profile_update(
    patch: dict[str, Any],
    reason: str = "",
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """提交世界观总览变更。核心设定会进入待确认队列。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    return propose_world_profile_update_service(patch, reason, "llm")


@mcp.tool()
def get_power_system(project_title: str | None = None, project_id: int | None = None) -> dict[str, Any]:
    """读取项目级境界 / 力量体系。"""
    prepare_project_context(project_id, project_title)
    state = get_world_state_service()
    return {
        "power_system": get_power_system_service(),
        "power_system_summary": state.get("power_system_summary", ""),
    }


@mcp.tool()
def propose_power_system_update(
    patch: dict[str, Any],
    reason: str = "",
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """提交境界 / 力量体系变更。核心设定会进入待确认队列。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    return propose_power_system_update_service(patch, reason, "llm")


@mcp.tool()
def propose_world_update(
    patch: dict[str, Any] | None = None,
    reason: str = "",
    project_title: str | None = None,
    project_id: int | None = None,
    title: str = "",
    entries: list[Any] | None = None,
    map_nodes: list[Any] | None = None,
) -> dict[str, Any]:
    """提交世界状态变更。可传 patch，也兼容 title/entries/map_nodes；硬设定会进入待确认队列。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    effective_patch = dict(patch or {})
    if title or entries or map_nodes:
        compatibility_patch = world_entries_to_patch(title, entries, map_nodes)
        for key, value in compatibility_patch.items():
            if key in effective_patch and isinstance(effective_patch[key], list):
                effective_patch[key] = [*effective_patch[key], *value]
            else:
                effective_patch[key] = value
    if not effective_patch:
        return {"mode": "noop", "message": "No world update patch supplied."}
    return propose_world_update_service(effective_patch, reason or title, "llm")


@mcp.tool()
def get_timeline(chapter_range: str | None = None, project_title: str | None = None, project_id: int | None = None) -> list[dict[str, Any]]:
    """查询时间线。chapter_range 格式示例：1-20。"""
    prepare_project_context(project_id, project_title)
    return get_timeline_service(chapter_range)


@mcp.tool()
def add_chapter_summary(
    chapter: int,
    summary: str,
    facts: list[Any] | None = None,
    hooks: list[Any] | None = None,
    title: str = "",
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """保存章节摘要、新增事实和伏笔。章节结束后调用。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    return add_summary_service(
        ChapterSummaryIn(chapter=chapter, title=title, summary=summary, facts=facts or [], hooks=hooks or [])
    )


@mcp.tool()
def list_full_chapters(project_title: str | None = None, project_id: int | None = None) -> list[dict[str, Any]]:
    """列出已保存的完整正文，只返回章节、标题和长度，不返回正文全文。"""
    prepare_project_context(project_id, project_title)
    return list_full_chapters_service()


@mcp.tool()
def get_full_chapter(chapter: int, project_title: str | None = None, project_id: int | None = None) -> dict[str, Any] | None:
    """读取某章完整正文。用于从作者编辑后的正文中提取摘要、事实、伏笔和状态变化。"""
    prepare_project_context(project_id, project_title)
    return get_full_chapter_service(chapter)


@mcp.tool()
def save_full_chapter(
    chapter: int,
    content: str,
    title: str = "",
    source: str = "llm",
    project_title: str | None = None,
    project_id: int | None = None,
) -> dict[str, Any]:
    """保存或更新某章完整正文。保存后可再调用 get_full_chapter 读取并提取关键信息。"""
    prepare_project_context(project_id, project_title, create_missing=bool(project_title))
    return save_full_chapter_service(FullChapterIn(chapter=chapter, title=title, content=content, source=source))


@mcp.tool()
def get_pending_changes() -> list[dict[str, Any]]:
    """读取待人工确认的变更。"""
    return list_pending_changes()


if __name__ == "__main__":
    mcp.run(show_banner=False)
