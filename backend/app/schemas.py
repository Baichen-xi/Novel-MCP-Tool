from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, model_validator


def pick_alias(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return default


def normalize_item(item: dict[str, Any], aliases: dict[str, tuple[str, ...]]) -> dict[str, Any]:
    normalized = dict(item)
    for target, keys in aliases.items():
        if normalized.get(target) in (None, ""):
            value = pick_alias(item, *keys)
            if value not in (None, ""):
                normalized[target] = value
    return normalized


def ensure_list(value: Any) -> list[Any]:
    if value in (None, ""):
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalize_structured_block(value: Any, default_key: str = "summary") -> dict[str, Any]:
    if value in (None, ""):
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        return {default_key: value}
    text = str(value).strip()
    return {default_key: text} if text else {}


def text_items(value: Any) -> list[str]:
    items: list[str] = []
    for item in ensure_list(value):
        if isinstance(item, str):
            for line in item.splitlines():
                cleaned = line.strip().lstrip("-•*· ").strip()
                if cleaned:
                    items.append(cleaned)
    return items


def normalize_characters(value: Any) -> list[dict[str, Any]]:
    characters = [normalize_item(item, CHARACTER_ALIASES) for item in ensure_list(value) if isinstance(item, dict)]
    for character in characters:
        for key in ("aliases", "abilities", "equipment", "public_facts", "private_facts", "locked_facts"):
            if key in character:
                character[key] = normalize_text_list(character.get(key))
    return characters


def normalize_text_list(value: Any) -> list[str]:
    if value in (None, ""):
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, (tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        parts = [part.strip() for part in re.split(r"[,\n，；;、]+", value) if part.strip()]
        return parts or [value.strip()]
    return [str(value).strip()] if str(value).strip() else []


def normalize_lore_entries(value: Any) -> list[dict[str, Any]]:
    entries = [normalize_item(item, LORE_ALIASES) for item in ensure_list(value) if isinstance(item, dict)]
    for line in text_items(value):
        title, _, content = line.partition("：")
        if not content:
            title, _, content = line.partition(":")
        entries.append({"title": title.strip() or line, "keys": [title.strip() or line], "content": content.strip() or line})
    return entries


def normalize_map_nodes(value: Any) -> list[dict[str, Any]]:
    nodes = [normalize_item(item, MAP_NODE_ALIASES) for item in ensure_list(value) if isinstance(item, dict)]
    for line in text_items(value):
        name = line
        description = ""
        if "（" in line and "）" in line:
            name = line.split("（", 1)[0].strip()
            description = line
        elif "(" in line and ")" in line:
            name = line.split("(", 1)[0].strip()
            description = line
        elif "：" in line:
            name, description = [part.strip() for part in line.split("：", 1)]
        elif ":" in line:
            name, description = [part.strip() for part in line.split(":", 1)]
        nodes.append({"name": name.strip() or line, "type": "地点", "description": description or line})
    return nodes


def normalize_timeline(value: Any) -> list[dict[str, Any]]:
    events = [normalize_item(item, TIMELINE_ALIASES) for item in ensure_list(value) if isinstance(item, dict)]
    for index, line in enumerate(text_items(value), start=1):
        events.append({"chapter": index, "event": line})
    return events


def normalize_factions(value: Any) -> list[dict[str, Any]]:
    factions = [normalize_item(item, FACTION_ALIASES) for item in ensure_list(value) if isinstance(item, dict)]
    for line in text_items(value):
        name, _, summary = line.partition("：")
        if not summary:
            name, _, summary = line.partition(":")
        factions.append({"name": name.strip() or line, "summary": summary.strip() or line})
    for faction in factions:
        for key in ("aliases", "core_members", "allies", "enemies", "sub_factions", "locked_facts", "tags"):
            if key in faction:
                faction[key] = normalize_text_list(faction.get(key))
    return factions


CHARACTER_ALIASES = {
    "name": ("姓名", "名字", "角色名"),
    "role": ("角色身份", "角色定位", "定位"),
    "gender": ("性别",),
    "personality": ("性格", "性格特征", "性格描述"),
    "realm": ("当前境界", "境界", "修为"),
    "identity": ("身份", "书中身份", "人物身份"),
    "status": ("存活状态", "生死状态", "状态"),
    "location": ("位置", "所在地", "当前地点"),
    "emotional_state": ("情绪", "心理状态", "当前情绪"),
    "physical_state": ("身体", "身体状态", "伤势"),
    "faction": ("阵营", "势力", "所属势力"),
    "bloodline": ("血脉",),
    "abilities": ("能力", "技能", "功法", "所修功法"),
    "equipment": ("装备", "物品", "拥有的装备"),
    "relationship_notes": ("人物关系", "关系", "关系状态", "关系备注"),
    "public_facts": ("公开事实",),
    "private_facts": ("隐藏事实", "秘密"),
    "locked_facts": ("禁改事实", "锁定事实"),
    "state_variables": ("状态变量", "变量", "MVU", "mvu", "variables"),
}

LORE_ALIASES = {
    "title": ("标题", "名称", "词条名"),
    "keys": ("关键词", "触发词", "key"),
    "content": ("内容", "设定", "描述"),
    "scope": ("范围",),
    "priority": ("优先级",),
}

MAP_NODE_ALIASES = {
    "name": ("名称", "地点名", "节点名"),
    "type": ("类型", "节点类型"),
    "shape": ("形状", "范围形状", "区域形状"),
    "parent_name": ("上级", "父节点", "所属"),
    "description": ("描述", "说明"),
    "faction": ("势力", "归属"),
    "color": ("颜色", "区域颜色", "势力颜色", "RGB", "rgb"),
    "polygon_points": ("多边形点", "顶点", "范围点", "点集"),
}

TIMELINE_ALIASES = {
    "chapter": ("章节", "章"),
    "era": ("纪年", "纪元", "时代", "时间段", "阶段"),
    "year_label": ("year", "年份", "纪年时间", "故事时间", "发生时间", "时间"),
    "time_note": ("timeNote", "time_note", "时间说明", "时间备注", "模糊时间", "具体时间"),
    "sort_order": ("sort", "order", "时间序号", "排序", "时间顺序", "故事顺序", "顺序"),
    "side": ("侧边", "左右", "显示侧", "位置"),
    "event_type": ("type", "event_type", "事件类型", "类型"),
    "title": ("标题", "事件标题", "名称"),
    "summary": ("说明", "事件说明", "摘要", "事件经过", "内容"),
    "narrative": ("叙述章节", "来源章节", "首次揭示", "叙述", "读者得知"),
    "event": ("事件", "内容"),
    "date_label": ("日期",),
    "involved_characters": ("characters", "相关角色", "参与角色", "涉及人物", "人物"),
    "factions": ("相关势力", "涉及势力", "势力"),
    "location": ("地点", "位置"),
    "consequences": ("后果", "影响"),
    "hooks": ("伏笔", "伏笔变化"),
    "tags": ("标签",),
}

FACTION_ALIASES = {
    "name": ("名称", "势力名", "组织名", "宗门名", "国家名"),
    "aliases": ("别名", "别称"),
    "type": ("类型", "势力类型", "组织类型"),
    "level": ("层级", "等级", "级别"),
    "status": ("状态",),
    "parent_name": ("上级势力", "上级", "归属", "隶属"),
    "location": ("所在地", "总部", "驻地", "位置"),
    "sphere": ("势力范围", "影响范围", "辖区"),
    "leader": ("领袖", "首领", "掌门", "宗主", "皇帝", "负责人"),
    "core_members": ("核心成员", "重要人物", "代表人物"),
    "allies": ("盟友", "友方", "同盟"),
    "enemies": ("敌对方", "敌人", "敌对势力"),
    "sub_factions": ("下属势力", "附属", "分支"),
    "summary": ("简介", "概述", "描述"),
    "ideology": ("理念", "目标", "宗旨"),
    "resources": ("资源", "底蕴", "资产"),
    "plot_notes": ("剧情备注", "剧情作用", "备注"),
    "locked_facts": ("禁改事实", "锁定事实"),
    "tags": ("标签",),
}


class ProjectInit(BaseModel):
    title: str = "未命名作品"
    genre: str = ""
    premise: str = ""
    rules: list[str] = Field(default_factory=list)
    world_profile: dict[str, Any] = Field(default_factory=dict)
    power_system: dict[str, Any] = Field(default_factory=dict)
    current_chapter: int | str = 1
    current_scene_goal: str = ""
    current_conflict: str = ""
    characters: list[dict[str, Any]] = Field(default_factory=list)
    factions: list[dict[str, Any]] = Field(default_factory=list)
    lore_entries: list[dict[str, Any]] = Field(default_factory=list)
    map_nodes: list[dict[str, Any]] = Field(default_factory=list)
    timeline: list[dict[str, Any]] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_llm_payload(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        source = dict(data)
        project = pick_alias(source, "project", "work", "book", "novel", "作品", "项目", default={})
        if isinstance(project, dict):
            merged = dict(project)
            merged.update({key: value for key, value in source.items() if key not in {"project", "work", "book", "novel", "作品", "项目"}})
            source = merged

        source["title"] = pick_alias(source, "title", "name", "book_title", "novel_title", "作品名", "书名", "标题", default=source.get("title", "未命名作品"))
        source["genre"] = pick_alias(source, "genre", "type", "category", "题材", "类型", default=source.get("genre", ""))
        source["premise"] = pick_alias(source, "premise", "summary", "description", "简介", "梗概", "故事梗概", default=source.get("premise", ""))
        source["rules"] = pick_alias(source, "rules", "world_rules", "世界规则", "规则", default=source.get("rules", []))
        source["world_profile"] = normalize_structured_block(
            pick_alias(
                source,
                "world_profile",
                "world",
                "world_setting",
                "world_profile_json",
                "宇宙观",
                "世界观",
                "设定总览",
                "世界设定",
                default=source.get("world_profile", {}),
            ),
            "summary",
        )
        source["power_system"] = normalize_structured_block(
            pick_alias(
                source,
                "power_system",
                "power",
                "realm_system",
                "cultivation_system",
                "power_system_json",
                "境界",
                "境界体系",
                "境界设定",
                "修炼体系",
                "力量体系",
                "阶位体系",
                "等级体系",
                default=source.get("power_system", {}),
            ),
            "summary",
        )
        source["current_chapter"] = pick_alias(source, "current_chapter", "chapter", "当前章节", "章节", default=source.get("current_chapter", 1))
        source["current_scene_goal"] = pick_alias(source, "current_scene_goal", "scene_goal", "场景目标", default=source.get("current_scene_goal", ""))
        source["current_conflict"] = pick_alias(source, "current_conflict", "conflict", "主线冲突", "当前冲突", default=source.get("current_conflict", ""))

        characters = pick_alias(source, "characters", "角色", "人物", default=source.get("characters", []))
        factions = pick_alias(source, "factions", "势力", "势力划分", "组织", "阵营", default=source.get("factions", []))
        lore_entries = pick_alias(source, "lore_entries", "world_info", "worldbook", "world_book", "世界书", "设定词条", default=source.get("lore_entries", []))
        map_nodes = pick_alias(source, "map_nodes", "map", "locations", "地图", "地点", default=source.get("map_nodes", []))
        timeline = pick_alias(source, "timeline", "events", "时间线", "事件", default=source.get("timeline", []))

        source["characters"] = normalize_characters(characters)
        source["factions"] = normalize_factions(factions)
        source["lore_entries"] = normalize_lore_entries(lore_entries)
        source["map_nodes"] = normalize_map_nodes(map_nodes)
        source["timeline"] = normalize_timeline(timeline)
        return source


class ProjectCreate(BaseModel):
    title: str = "未命名作品"
    genre: str = ""
    premise: str = ""


class ProjectUpdate(BaseModel):
    title: str | None = None
    genre: str | None = None
    premise: str | None = None


class ProjectDeleteProposal(BaseModel):
    project_id: int | None = None
    project_title: str = ""
    reason: str = ""


class CharacterDeleteProposal(BaseModel):
    project_id: int | None = None
    project_title: str = ""
    reason: str = ""


class FactionIn(BaseModel):
    name: str
    aliases: list[str] = Field(default_factory=list)
    type: str = ""
    level: str = ""
    status: str = "active"
    parent_name: str = ""
    location: str = ""
    sphere: str = ""
    leader: str = ""
    core_members: list[str] = Field(default_factory=list)
    allies: list[str] = Field(default_factory=list)
    enemies: list[str] = Field(default_factory=list)
    sub_factions: list[str] = Field(default_factory=list)
    summary: str = ""
    ideology: str = ""
    resources: str = ""
    plot_notes: str = ""
    locked_facts: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            normalized = normalize_item(data, FACTION_ALIASES)
            for key in ("aliases", "core_members", "allies", "enemies", "sub_factions", "locked_facts", "tags"):
                if key in normalized:
                    normalized[key] = normalize_text_list(normalized.get(key))
            return normalized
        return data


class FactionUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = "作者手动修正势力"
    source: str = "user"


class FactionDeleteProposal(BaseModel):
    reason: str = ""


class ContextRequest(BaseModel):
    scene_goal: str
    chapter: int | None = None
    keywords: list[str] = Field(default_factory=list)
    characters: list[str] = Field(default_factory=list)


class CharacterUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = ""
    source: str = "llm"


class DirectCharacterUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = "作者手动修正"


class WorldUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = ""
    source: str = "llm"


class MapNodeUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = "作者手动修正地图"


class MapNodeCreate(BaseModel):
    name: str
    type: str = "地点"
    shape: str = "point"
    map_image_id: int | None = None
    layer: str = ""
    plane: str = ""
    parent_name: str = ""
    description: str = ""
    faction: str = ""
    color: str = ""
    x: float = 50
    y: float = 50
    polygon_points: list[dict[str, Any]] = Field(default_factory=list)


class MapImageIn(BaseModel):
    title: str = "世界地图"
    layer: str = "世界"
    parent_name: str = ""
    scope: str = ""
    scale_label: str = ""
    real_width: float = 0
    real_height: float = 0
    distance_unit: str = "里"
    scale_kind: str = ""
    image_data: str
    mime_type: str = "image/png"
    notes: str = ""


class MapImageUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = "作者手动修正地图图片"


class LoreEntryUpdate(BaseModel):
    patch: dict[str, Any]
    reason: str = "作者手动修正世界书"


class ChapterSummaryIn(BaseModel):
    chapter: int
    title: str = ""
    summary: str
    facts: list[dict[str, Any] | str] = Field(default_factory=list)
    hooks: list[dict[str, Any] | str] = Field(default_factory=list)


class FullChapterIn(BaseModel):
    chapter: int
    title: str = ""
    content: str
    source: str = "user_import"


class ResolveChangeIn(BaseModel):
    patch: dict[str, Any] | None = None
