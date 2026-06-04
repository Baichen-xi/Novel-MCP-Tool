from __future__ import annotations

import json
import math
import re
from typing import Any

from .db import get_connection, init_db
from .schemas import (
    ChapterSummaryIn,
    ContextRequest,
    FullChapterIn,
    FactionIn,
    MapImageIn,
    MapNodeCreate,
    ProjectInit,
    normalize_structured_block,
    normalize_text_list,
)

JSON_FIELDS = {
    "aliases",
    "abilities",
    "equipment",
    "public_facts",
    "private_facts",
    "locked_facts",
    "state_variables",
    "keys",
    "rules",
    "facts",
    "hooks",
    "involved_characters",
    "factions",
    "tags",
    "polygon_points",
    "core_members",
    "allies",
    "enemies",
    "sub_factions",
}

LIST_JSON_FIELDS = {
    "aliases",
    "abilities",
    "equipment",
    "public_facts",
    "private_facts",
    "locked_facts",
    "keys",
    "rules",
    "facts",
    "hooks",
    "involved_characters",
    "factions",
    "tags",
    "polygon_points",
    "core_members",
    "allies",
    "enemies",
    "sub_factions",
}

TEXT_LIST_JSON_FIELDS = {
    "aliases",
    "abilities",
    "equipment",
    "public_facts",
    "private_facts",
    "locked_facts",
    "core_members",
    "allies",
    "enemies",
    "sub_factions",
}

LIST_JSON_FIELDS_NO_TEXT = {
    "keys",
    "rules",
    "facts",
    "hooks",
    "involved_characters",
    "factions",
    "tags",
    "polygon_points",
    "core_members",
    "allies",
    "enemies",
    "sub_factions",
}


def current_project_id(conn: Any | None = None) -> int:
    if conn is not None:
        row = conn.execute("SELECT id FROM projects WHERE is_active = 1 ORDER BY id LIMIT 1").fetchone()
        return int(row["id"]) if row else 1
    init_db()
    with get_connection() as owned_conn:
        return current_project_id(owned_conn)


def normalize_project_title(title: str | None) -> str:
    return str(title or "").strip()


def set_active_project(conn: Any, project_id: int) -> None:
    conn.execute("UPDATE projects SET is_active = 0")
    conn.execute("UPDATE projects SET is_active = 1 WHERE id = ?", (project_id,))


def resolve_project(
    project_id: int | None = None,
    project_title: str | None = None,
    create_missing: bool = False,
    genre: str = "",
    premise: str = "",
) -> dict[str, Any]:
    init_db()
    title = normalize_project_title(project_title)
    with get_connection() as conn:
        if project_id is not None:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            if not row:
                raise ValueError("Project not found")
            return normalize_row(row)
        if title:
            rows = conn.execute("SELECT * FROM projects WHERE title = ? ORDER BY id", (title,)).fetchall()
            if len(rows) > 1:
                raise ValueError(f"Project title is ambiguous: {title}")
            if rows:
                return normalize_row(rows[0])
            if create_missing:
                cursor = conn.execute(
                    """
                    INSERT INTO projects (title, genre, premise, is_active)
                    VALUES (?, ?, ?, 0)
                    """,
                    (title, genre, premise),
                )
                row = conn.execute("SELECT * FROM projects WHERE id = ?", (cursor.lastrowid,)).fetchone()
                return normalize_row(row)
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (current_project_id(conn),)).fetchone()
        return normalize_row(row)


def switch_to_project(project_id: int | None = None, project_title: str | None = None, create_missing: bool = False) -> dict[str, Any]:
    project = resolve_project(project_id, project_title, create_missing=create_missing)
    with get_connection() as conn:
        set_active_project(conn, int(project["id"]))
    return get_dashboard()


def prepare_project_context(
    project_id: int | None = None,
    project_title: str | None = None,
    create_missing: bool = False,
    genre: str = "",
    premise: str = "",
) -> dict[str, Any]:
    project = resolve_project(project_id, project_title, create_missing=create_missing, genre=genre, premise=premise)
    with get_connection() as conn:
        set_active_project(conn, int(project["id"]))
    return get_project()

CHARACTER_COLUMNS = {
    "name",
    "aliases",
    "role",
    "gender",
    "personality",
    "realm",
    "identity",
    "age",
    "status",
    "location",
    "emotional_state",
    "physical_state",
    "faction",
    "bloodline",
    "abilities",
    "equipment",
    "relationship_notes",
    "public_facts",
    "private_facts",
    "locked_facts",
    "state_variables",
}

AUTO_CHARACTER_FIELDS = {
    "location",
    "emotional_state",
    "physical_state",
    "relationship_notes",
}

PROTECTED_CHARACTER_FIELDS = {
    "age",
    "status",
    "role",
    "gender",
    "personality",
    "realm",
    "identity",
    "faction",
    "bloodline",
    "abilities",
    "equipment",
    "public_facts",
    "private_facts",
    "locked_facts",
    "state_variables",
}

PROTECTED_WORLD_FIELDS = {
    "rules",
    "world_profile",
    "power_system",
    "map_nodes",
    "lore_entries",
    "factions",
    "world_rules",
    "timeline",
}

FACTION_COLUMNS = {
    "name",
    "aliases",
    "type",
    "level",
    "status",
    "parent_name",
    "location",
    "sphere",
    "leader",
    "core_members",
    "allies",
    "enemies",
    "sub_factions",
    "summary",
    "ideology",
    "resources",
    "plot_notes",
    "locked_facts",
    "tags",
}

PROTECTED_FACTION_FIELDS = {
    "name",
    "type",
    "level",
    "status",
    "parent_name",
    "leader",
    "allies",
    "enemies",
    "sub_factions",
    "locked_facts",
}

MAP_NODE_COLUMNS = {
    "name",
    "type",
    "shape",
    "map_image_id",
    "layer",
    "plane",
    "parent_name",
    "description",
    "faction",
    "color",
    "x",
    "y",
    "polygon_points",
}

MAP_IMAGE_COLUMNS = {
    "title",
    "layer",
    "parent_name",
    "scope",
    "scale_label",
    "real_width",
    "real_height",
    "distance_unit",
    "scale_kind",
    "image_data",
    "mime_type",
    "notes",
}

LORE_ENTRY_COLUMNS = {
    "title",
    "keys",
    "content",
    "scope",
    "priority",
    "insertion_position",
    "enabled",
}

MODULE_LABELS = {
    "characters": "人物信息",
    "factions": "势力结构",
    "powerSystem": "境界体系",
    "maps": "世界图册",
    "timeline": "故事时间线",
    "chapters": "章节概览",
    "world": "世界设定",
    "projects": "小说项目",
}

SCHEMA_GUIDES: dict[str, dict[str, Any]] = {
    "character": {
        "模块": "人物信息",
        "用途": "创建或补全单个人物资料。字段可以使用中文名，后端会归一到数据库字段。",
        "必填": ["姓名"],
        "推荐字段": ["姓名", "性别", "性格", "当前境界", "身份", "角色身份", "存活状态", "人物关系", "所修功法", "拥有的装备", "阵营", "血脉", "补充资料"],
        "示例": {
            "姓名": "林玄",
            "性别": "男",
            "性格": "隐忍、谨慎，关键时刻敢赌命",
            "当前境界": "炼气三层",
            "身份": "天元宗外门弟子",
            "角色身份": "主角",
            "存活状态": "存活",
            "人物关系": "与苏璃互相试探，暂未完全信任",
            "所修功法": ["青木诀", "问心剑诀残篇"],
            "拥有的装备": ["青铜古戒"],
            "阵营": "天元宗",
            "血脉": "未觉醒古族血脉",
            "补充资料": {"秘密": "青铜古戒内藏有残魂"},
        },
    },
    "faction": {
        "模块": "势力结构",
        "用途": "创建或补全宗门、国家、公司、避难所等组织资料。",
        "必填": ["名称"],
        "推荐字段": ["名称", "别名", "类型", "层级", "状态", "上级势力", "所在地", "势力范围", "领袖", "核心成员", "盟友", "敌对方", "下属势力", "简介", "理念", "资源", "剧情备注", "禁改事实", "标签"],
        "示例": {
            "名称": "天元宗",
            "类型": "宗门",
            "层级": "区域霸主",
            "状态": "活跃",
            "所在地": "东玄道域·天元山脉",
            "势力范围": "东玄道域北境三十六城",
            "领袖": "玄微真人",
            "核心成员": ["苏璃", "戒律长老"],
            "敌对方": ["黑水盟"],
            "简介": "以问心阶和剑修传承立宗的北境大宗。",
        },
    },
    "power_realm": {
        "模块": "境界体系",
        "用途": "创建或修改一个大境界，可携带小境界列表。",
        "必填": ["境界", "说明"],
        "推荐字段": ["境界", "说明", "小境界"],
        "示例": {
            "境界": "炼气境",
            "说明": "吸纳天地灵气入体，完成修行根基。",
            "小境界": [
                {"名称": "初期", "说明": "初步感气，引灵入体。"},
                {"名称": "中期", "说明": "灵气运转稳定，可施展基础术法。"},
                {"名称": "后期", "说明": "经脉渐通，准备筑基。"},
            ],
        },
    },
    "map_image": {
        "模块": "世界图册",
        "用途": "创建或修改一张地图册卡片，不要求携带图片本体。",
        "必填": ["地图名"],
        "推荐字段": ["地图名", "层级", "范围说明", "横向范围", "纵向范围", "距离单位", "标度文字", "地图类型", "说明"],
        "示例": {
            "地图名": "东玄道域总览",
            "层级": "道域",
            "范围说明": "东玄道域北境到南境的概览图",
            "横向范围": 800000,
            "纵向范围": 520000,
            "距离单位": "里",
            "标度文字": "1 格 = 4 万里",
            "地图类型": "区域",
            "说明": "用于展示主要宗门、城池、秘境之间的方位关系。",
        },
    },
    "map_node": {
        "模块": "世界图册",
        "用途": "创建或修改地图点位。点位必须给出 x/y，范围为 0-100 的前端百分比坐标。",
        "必填": ["名称", "x", "y"],
        "推荐字段": ["名称", "显示方式", "说明", "所属势力", "颜色", "x", "y"],
        "示例": {"名称": "黑水城", "显示方式": "点", "说明": "黑水盟控制的边境城池。", "所属势力": "黑水盟", "颜色": "120,146,185", "x": 62, "y": 48},
    },
    "map_region": {
        "模块": "世界图册",
        "用途": "创建或修改地图区域。区域必须给出至少三个顶点，顶点 x/y 为 0-100 的百分比坐标。",
        "必填": ["名称", "顶点"],
        "推荐字段": ["名称", "显示方式", "说明", "所属势力", "颜色", "顶点"],
        "示例": {
            "名称": "天元宗势力范围",
            "显示方式": "区域",
            "说明": "天元宗直接控制的山门与附属城镇。",
            "所属势力": "天元宗",
            "颜色": "111,134,98",
            "顶点": [{"x": 28, "y": 30}, {"x": 48, "y": 28}, {"x": 54, "y": 45}, {"x": 34, "y": 52}],
        },
    },
    "timeline_event": {
        "模块": "故事时间线",
        "用途": "写入小说世界内真实发生顺序的事件，不会和章节概览自动联动。",
        "必填": ["事件标题", "故事时间", "排序值", "事件说明"],
        "推荐字段": ["纪元", "故事时间", "时间说明", "排序值", "左右", "事件类型", "事件标题", "事件说明", "叙述章节", "章节", "地点", "涉及人物", "涉及势力", "影响结果", "伏笔", "标签"],
        "示例": {
            "纪元": "新星纪元",
            "故事时间": "新星纪元 1032 年 春",
            "时间说明": "天元宗收徒日午后",
            "排序值": 1032.2,
            "左右": "右",
            "事件类型": "正序事件",
            "事件标题": "林玄登上问心阶",
            "事件说明": "林玄在问心阶停步，神魂异象短暂显现。",
            "叙述章节": "第 1 章正序讲述",
            "章节": 1,
            "地点": "天元宗山门",
            "涉及人物": ["林玄", "苏璃"],
            "涉及势力": ["天元宗"],
            "影响结果": "林玄获得入门资格。",
            "伏笔": ["问心阶为何回应林玄神魂"],
        },
    },
    "chapter_overview": {
        "模块": "章节概览",
        "用途": "保存某章被讲述、揭示或补完的关键事实，不会自动写入故事时间线。",
        "必填": ["章节", "摘要"],
        "推荐字段": ["章节", "标题", "摘要", "事实", "伏笔"],
        "示例": {
            "章节": 1,
            "标题": "陨落的天才",
            "摘要": "林玄在退婚后进入天元宗山门，问心阶异动。",
            "事实": ["林玄被退婚", "青铜古戒第一次发热"],
            "伏笔": ["问心阶异象来源未明"],
        },
    },
    "world_summary": {
        "模块": "世界设定",
        "用途": "更新世界设定总览，只写一段话。",
        "必填": ["世界设定"],
        "推荐字段": ["世界设定"],
        "示例": {"世界设定": "这是一个宗门、王朝与秘境并存的修行世界，灵气潮汐决定各地资源兴衰。"},
    },
}


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def loads(value: str | None, fallback: Any = None) -> Any:
    if value in (None, ""):
        return fallback
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return fallback


def get_schema(kind: str | None = None) -> dict[str, Any]:
    if not kind:
        return {"schemas": SCHEMA_GUIDES}
    normalized_kind = str(kind).strip()
    schema = SCHEMA_GUIDES.get(normalized_kind)
    if not schema:
        return {"kind": normalized_kind, "valid_kind": False, "schemas": SCHEMA_GUIDES}
    return {"kind": normalized_kind, "valid_kind": True, "schema": schema}


def validation_ok(kind: str, normalized: dict[str, Any], warnings: list[str] | None = None) -> dict[str, Any]:
    return {
        "valid": True,
        "kind": kind,
        "errors": [],
        "warnings": warnings or [],
        "normalized": normalized,
    }


def validation_error(kind: str, errors: list[str], normalized: dict[str, Any] | None = None, warnings: list[str] | None = None) -> dict[str, Any]:
    return {
        "valid": False,
        "kind": kind,
        "errors": errors,
        "warnings": warnings or [],
        "normalized": normalized or {},
        "schema": get_schema(kind).get("schema", {}),
    }


def first_present(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if data.get(key) not in (None, ""):
            return data.get(key)
    return default


def normalize_map_image_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = {
        "title": str(first_present(payload, "title", "name", "地图名", "名称", default="世界地图")).strip() or "世界地图",
        "layer": str(first_present(payload, "layer", "层级", default="世界")).strip(),
        "parent_name": str(first_present(payload, "parent_name", "上级地图", "所属地图", default="")).strip(),
        "scope": str(first_present(payload, "scope", "范围说明", "范围", default="")).strip(),
        "scale_label": str(first_present(payload, "scale_label", "标度文字", "显示标度", default="")).strip(),
        "real_width": parse_float(first_present(payload, "real_width", "横向范围", "宽度", default=0)),
        "real_height": parse_float(first_present(payload, "real_height", "纵向范围", "高度", default=0)),
        "distance_unit": str(first_present(payload, "distance_unit", "距离单位", "单位", default="里")).strip() or "里",
        "scale_kind": str(first_present(payload, "scale_kind", "地图类型", "类型", default="")).strip(),
        "image_data": str(first_present(payload, "image_data", "图片数据", default="")).strip(),
        "mime_type": str(first_present(payload, "mime_type", "图片类型", default="image/png")).strip() or "image/png",
        "notes": str(first_present(payload, "notes", "说明", "备注", default="")).strip(),
    }
    if first_present(payload, "map_id_or_name", "id", "map_id", "地图ID") not in (None, ""):
        prepared["map_id_or_name"] = first_present(payload, "map_id_or_name", "id", "map_id", "地图ID")
    return prepared


def normalize_power_realm_payload(payload: dict[str, Any]) -> dict[str, Any]:
    tier = normalize_power_tier(
        {
            "name": first_present(payload, "name", "title", "境界", "名称", "大境界", default=""),
            "description": first_present(payload, "description", "summary", "说明", "描述", default=""),
            "stages": first_present(payload, "stages", "小境界", "小境界列表", "阶段列表", default=[]),
        }
    )
    return tier


def normalize_chapter_overview_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "chapter": parse_chapter(first_present(payload, "chapter", "章节", "章", default=1)),
        "title": str(first_present(payload, "title", "标题", "章节标题", default="")).strip(),
        "summary": str(first_present(payload, "summary", "摘要", "概览", "内容", default="")).strip(),
        "facts": first_present(payload, "facts", "事实", "新增事实", default=[]),
        "hooks": first_present(payload, "hooks", "伏笔", "钩子", default=[]),
    }


def normalize_map_node_payload(payload: dict[str, Any], shape: str | None = None) -> dict[str, Any]:
    prepared = dict(payload or {})
    aliases = {
        "name": ("名称", "地点名", "节点名", "区域名"),
        "shape": ("显示方式", "形状", "范围形状"),
        "description": ("说明", "描述"),
        "faction": ("所属势力", "势力", "归属"),
        "color": ("颜色", "区域颜色", "RGB", "rgb"),
        "x": ("横坐标", "X"),
        "y": ("纵坐标", "Y"),
        "polygon_points": ("顶点", "多边形点", "范围点", "点集"),
        "type": ("类型", "节点类型"),
    }
    for target, keys in aliases.items():
        if prepared.get(target) in (None, ""):
            for key in keys:
                if prepared.get(key) not in (None, ""):
                    prepared[target] = prepared[key]
                    break
    if shape:
        prepared["shape"] = shape
    if str(prepared.get("shape") or "").strip() in {"点", "point"}:
        prepared["shape"] = "point"
    if str(prepared.get("shape") or "").strip() in {"区域", "范围", "多边形", "polygon", "region"}:
        prepared["shape"] = "polygon"
    if not prepared.get("type"):
        prepared["type"] = "区域" if prepared.get("shape") == "polygon" else "地点"
    return normalize_map_node_geometry(prepared)


def normalize_timeline_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(payload or {})
    aliases = {
        "era": ("纪元", "纪年", "时代", "时间段"),
        "year_label": ("故事时间", "发生时间", "时间", "年份"),
        "time_note": ("时间说明", "时间备注", "具体时间"),
        "sort_order": ("排序值", "排序", "时间顺序", "故事顺序"),
        "side": ("左右", "显示侧", "侧边"),
        "event_type": ("事件类型", "类型"),
        "title": ("事件标题", "标题", "名称"),
        "summary": ("事件说明", "说明", "摘要", "内容"),
        "narrative": ("叙述章节", "来源章节", "首次揭示"),
        "chapter": ("章节", "章"),
        "location": ("地点", "位置"),
        "involved_characters": ("涉及人物", "相关角色", "参与角色", "人物"),
        "factions": ("涉及势力", "相关势力", "势力"),
        "consequences": ("影响结果", "后果", "影响"),
        "hooks": ("伏笔", "伏笔变化"),
        "tags": ("标签",),
    }
    for target, keys in aliases.items():
        if prepared.get(target) in (None, ""):
            for key in keys:
                if prepared.get(key) not in (None, ""):
                    prepared[target] = prepared[key]
                    break
    return normalize_timeline_event_payload(prepared)


def validate_payload(kind: str, payload: Any) -> dict[str, Any]:
    normalized_kind = str(kind or "").strip()
    if normalized_kind not in SCHEMA_GUIDES:
        return validation_error(normalized_kind or "unknown", [f"未知资料类型：{kind}"])
    if normalized_kind == "world_summary" and isinstance(payload, str):
        payload = {"世界设定": payload}
    if not isinstance(payload, dict):
        return validation_error(normalized_kind, ["payload 必须是 JSON 对象，不能是纯文本或数组。"])

    errors: list[str] = []
    warnings: list[str] = []
    normalized: dict[str, Any] = {}

    if normalized_kind == "character":
        if "补充资料" in payload and "state_variables" not in payload:
            payload = {**payload, "state_variables": {"custom": payload.get("补充资料")}}
        normalized = normalize_character_payload(payload)
        if not str(normalized.get("name") or "").strip():
            errors.append("缺少必填字段：姓名。")
    elif normalized_kind == "faction":
        normalized = normalize_faction_payload(payload)
        if not str(normalized.get("name") or "").strip():
            errors.append("缺少必填字段：名称。")
    elif normalized_kind == "power_realm":
        normalized = normalize_power_realm_payload(payload)
        if not str(normalized.get("name") or "").strip():
            errors.append("缺少必填字段：境界。")
        if not str(normalized.get("description") or "").strip():
            errors.append("缺少必填字段：说明。")
    elif normalized_kind == "map_image":
        normalized = normalize_map_image_payload(payload)
        if not normalized.get("title"):
            errors.append("缺少必填字段：地图名。")
    elif normalized_kind == "map_node":
        normalized = normalize_map_node_payload(payload, "point")
        if not str(normalized.get("name") or "").strip():
            errors.append("缺少必填字段：名称。")
        for axis in ("x", "y"):
            try:
                value = float(normalized.get(axis))
            except (TypeError, ValueError):
                errors.append(f"字段 {axis} 必须是 0-100 的数字。")
                continue
            if value < 0 or value > 100:
                errors.append(f"字段 {axis} 超出范围，必须在 0-100 之间。")
    elif normalized_kind == "map_region":
        normalized = normalize_map_node_payload(payload, "polygon")
        points = normalized.get("polygon_points", [])
        if not str(normalized.get("name") or "").strip():
            errors.append("缺少必填字段：名称。")
        if not isinstance(points, list) or len(points) < 3:
            errors.append("区域必须提供至少 3 个顶点，字段名可用 顶点 或 polygon_points。")
        for index, point in enumerate(points if isinstance(points, list) else [], start=1):
            for axis in ("x", "y"):
                value = point.get(axis)
                if not isinstance(value, (int, float)) or value < 0 or value > 100:
                    errors.append(f"第 {index} 个顶点的 {axis} 必须是 0-100 的数字。")
    elif normalized_kind == "timeline_event":
        normalized = normalize_timeline_payload(payload)
        if not str(normalized.get("title") or "").strip() or normalized.get("title") == "未命名事件":
            errors.append("缺少必填字段：事件标题。")
        if not str(normalized.get("summary") or "").strip():
            errors.append("缺少必填字段：事件说明。")
        if not str(normalized.get("year_label") or "").strip() or normalized.get("year_label") == "时间未定":
            errors.append("缺少必填字段：故事时间。")
        if "sort_order" not in payload and "排序值" not in payload and "排序" not in payload and "时间顺序" not in payload:
            errors.append("缺少必填字段：排序值。")
    elif normalized_kind == "chapter_overview":
        normalized = normalize_chapter_overview_payload(payload)
        if not normalized.get("chapter"):
            errors.append("缺少必填字段：章节。")
        if not normalized.get("summary"):
            errors.append("缺少必填字段：摘要。")
    elif normalized_kind == "world_summary":
        summary = str(first_present(payload, "summary", "世界设定", "设定", "内容", default="")).strip()
        normalized = {"summary": summary}
        if not summary:
            errors.append("缺少必填字段：世界设定。")

    if errors:
        return validation_error(normalized_kind, errors, normalized, warnings)
    return validation_ok(normalized_kind, normalized, warnings)


def require_valid_payload(kind: str, payload: Any) -> dict[str, Any]:
    result = validate_payload(kind, payload)
    if not result["valid"]:
        return result
    return result


def parse_world_coordinate(value: Any) -> tuple[float, float, float | None] | None:
    if value in (None, ""):
        return None
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        try:
            z = float(value[2]) if len(value) > 2 and value[2] not in (None, "") else None
            return (float(value[0]), float(value[1]), z)
        except (TypeError, ValueError):
            return None
    match = re.search(r"[-+]?\d+(?:\.\d+)?\s*[,，、]\s*[-+]?\d+(?:\.\d+)?(?:\s*[,，、]\s*[-+]?\d+(?:\.\d+)?)?", str(value))
    if not match:
        return None
    parts = [part.strip() for part in re.split(r"[,，、]", match.group(0))]
    try:
        z = float(parts[2]) if len(parts) > 2 else None
        return (float(parts[0]), float(parts[1]), z)
    except (TypeError, ValueError):
        return None


def extract_node_world_coordinate(node: dict[str, Any]) -> tuple[float, float, float | None] | None:
    for key in ("world_coordinate", "core_coordinate", "coordinates", "coordinate", "position", "核心坐标", "坐标"):
        parsed = parse_world_coordinate(node.get(key))
        if parsed:
            return parsed
    return parse_world_coordinate(node.get("description", ""))


def normalize_batch_coordinate(value: float, minimum: float, maximum: float, low: float, high: float, invert: bool = False) -> float:
    if maximum == minimum:
        return 50.0
    ratio = (value - minimum) / (maximum - minimum)
    if invert:
        ratio = 1 - ratio
    return round(low + ratio * (high - low), 1)


def normalize_polygon_points(value: Any) -> list[dict[str, float]]:
    if value in (None, ""):
        return []
    raw = value
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        try:
            raw = json.loads(text)
        except json.JSONDecodeError:
            raw = [line.strip() for line in text.splitlines() if line.strip()]
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        return []
    points: list[dict[str, float]] = []
    for item in raw:
        point: tuple[float, float] | None = None
        if isinstance(item, dict):
            x = item.get("x", item.get("X", item.get("横坐标", item.get("left"))))
            y = item.get("y", item.get("Y", item.get("纵坐标", item.get("top"))))
            point = parse_world_coordinate([x, y])[:2] if parse_world_coordinate([x, y]) else None
        elif isinstance(item, (list, tuple)):
            point = parse_world_coordinate(item)[:2] if parse_world_coordinate(item) else None
        elif isinstance(item, str):
            point = parse_world_coordinate(item)[:2] if parse_world_coordinate(item) else None
        if point:
            points.append({"x": round(point[0], 1), "y": round(point[1], 1)})
    return points


def polygon_centroid(points: list[dict[str, float]]) -> tuple[float, float]:
    if not points:
        return (50.0, 50.0)
    if len(points) < 3:
        x = sum(point["x"] for point in points) / len(points)
        y = sum(point["y"] for point in points) / len(points)
        return (x, y)
    area = 0.0
    cx = 0.0
    cy = 0.0
    for index, point in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        cross = point["x"] * next_point["y"] - next_point["x"] * point["y"]
        area += cross
        cx += (point["x"] + next_point["x"]) * cross
        cy += (point["y"] + next_point["y"]) * cross
    if abs(area) < 1e-6:
        x = sum(point["x"] for point in points) / len(points)
        y = sum(point["y"] for point in points) / len(points)
        return (x, y)
    area *= 0.5
    return (cx / (6 * area), cy / (6 * area))


def normalize_map_node_geometry(node: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(node)
    shape = str(prepared.get("shape") or "point").strip().lower()
    if shape in {"area", "region", "zone", "polygon"}:
        shape = "polygon"
    prepared["shape"] = shape or "point"
    for key in ("name", "type", "layer", "plane", "parent_name", "description", "faction", "color"):
        value = prepared.get(key)
        prepared[key] = "" if value in (None, "") else str(value)
    points = prepared.get("polygon_points")
    if not points:
        points = prepared.get("points") or prepared.get("vertices") or prepared.get("polygon")
    polygon_points = normalize_polygon_points(points)
    if polygon_points:
        prepared["shape"] = "polygon"
        prepared["polygon_points"] = polygon_points
        cx, cy = polygon_centroid(polygon_points)
        prepared["x"] = round(cx, 1)
        prepared["y"] = round(cy, 1)
    else:
        prepared["polygon_points"] = []
    for key in ("x", "y"):
        if prepared.get(key) in (None, ""):
            continue
        try:
            prepared[key] = float(prepared[key])
        except (TypeError, ValueError):
            pass
    return prepared


def has_canvas_position(node: dict[str, Any]) -> bool:
    if str(node.get("shape") or "").lower() == "polygon" and node.get("polygon_points"):
        return True
    try:
        x = float(node.get("x"))
        y = float(node.get("y"))
    except (TypeError, ValueError):
        return False
    return 0 <= x <= 100 and 0 <= y <= 100 and not (x == 0 and y == 0)


def auto_layout_canvas_positions(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    missing_indexes = [index for index, node in enumerate(nodes) if not has_canvas_position(node)]
    if not missing_indexes:
        return nodes
    count = len(missing_indexes)
    columns = max(1, math.ceil(math.sqrt(count)))
    rows = max(1, math.ceil(count / columns))
    for order, index in enumerate(missing_indexes):
        column = order % columns
        row = order // columns
        x = 50.0 if columns == 1 else 14 + column * (72 / (columns - 1))
        y = 50.0 if rows == 1 else 16 + row * (68 / (rows - 1))
        nodes[index]["x"] = round(x, 1)
        nodes[index]["y"] = round(y, 1)
    return nodes


def prepare_map_nodes_for_canvas(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    prepared = [normalize_map_node_geometry(dict(node)) for node in nodes if isinstance(node, dict)]
    parsed: list[tuple[int, float, float, float | None]] = []
    for index, node in enumerate(prepared):
        coordinate = extract_node_world_coordinate(node)
        if coordinate:
            parsed.append((index, *coordinate))
    if not parsed:
        return auto_layout_canvas_positions(prepared)
    should_normalize = any(
        prepared[index].get("x") in (None, "") or prepared[index].get("y") in (None, "")
        for index, *_ in parsed
    ) or any(
        not (0 <= float(node.get("x", 0) or 0) <= 100 and 0 <= float(node.get("y", 0) or 0) <= 100)
        for node in prepared
        if node.get("x") not in (None, "") or node.get("y") not in (None, "")
    )
    if not should_normalize:
        return prepared
    xs = [item[1] for item in parsed]
    ys = [item[2] for item in parsed]
    for index, raw_x, raw_y, raw_z in parsed:
        node = prepared[index]
        node["x"] = normalize_batch_coordinate(raw_x, min(xs), max(xs), 12, 88)
        node["y"] = normalize_batch_coordinate(raw_y, min(ys), max(ys), 12, 88, invert=True)
        original = f"原始坐标：({raw_x:g}, {raw_y:g}{', ' + format(raw_z, 'g') if raw_z is not None else ''})"
        description = str(node.get("description", "") or "")
        if original not in description:
            node["description"] = f"{description}\n{original}".strip()
    return auto_layout_canvas_positions(prepared)


def map_node_storage_payload(node: dict[str, Any]) -> dict[str, Any]:
    prepared = normalize_map_node_geometry(node)
    prepared["polygon_points_json"] = dumps(prepared.get("polygon_points", []))
    return prepared


def world_entries_to_patch(title: str = "", entries: list[Any] | None = None, map_nodes: list[Any] | None = None) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    lore_entries: list[dict[str, Any]] = []
    nodes: list[dict[str, Any]] = []
    if title and entries:
        lore_entries.append(
            {
                "title": title,
                "keys": [title],
                "content": "\n".join(f"{item.get('name', '未命名')}：{item.get('content', '')}" if isinstance(item, dict) else str(item) for item in entries),
                "scope": "world",
                "priority": 70,
            }
        )
    for item in entries or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", item.get("title", ""))).strip()
        content = str(item.get("content", item.get("description", ""))).strip()
        if name or content:
            lore_entries.append({"title": name or title or "世界条目", "keys": [name] if name else [], "content": content, "scope": "world", "priority": 60})
        coordinate = extract_node_world_coordinate({"description": content, **item})
        if coordinate and name:
            nodes.append(
                {
                    "name": name,
                    "type": item.get("type", item.get("类型", "地点")),
                    "layer": item.get("layer", item.get("所属位面", item.get("plane", ""))),
                    "plane": item.get("plane", item.get("所属位面", "")),
                    "description": content,
                    "world_coordinate": coordinate,
                }
            )
    for item in map_nodes or []:
        if isinstance(item, dict):
            nodes.append(item)
    if lore_entries:
        patch["lore_entries"] = lore_entries
    if nodes:
        patch["map_nodes"] = nodes
    return patch


def normalize_row(row: Any) -> dict[str, Any]:
    item = dict(row)
    normalized: dict[str, Any] = {}
    for key, value in item.items():
        if key.endswith("_json"):
            field = key.removesuffix("_json")
            loaded = loads(value, [] if field in LIST_JSON_FIELDS else {})
            if field in TEXT_LIST_JSON_FIELDS:
                normalized[field] = normalize_text_list(loaded)
            elif field in LIST_JSON_FIELDS_NO_TEXT:
                if isinstance(loaded, list):
                    normalized[field] = loaded
                elif loaded in (None, ""):
                    normalized[field] = []
                else:
                    normalized[field] = [loaded]
            else:
                normalized[field] = loaded
        else:
            normalized[key] = value
    return normalized


def normalize_world_profile(value: Any) -> dict[str, Any]:
    profile = normalize_structured_block(value, "summary")
    if not isinstance(profile, dict):
        return {}
    return profile


def normalize_power_stage(value: Any) -> dict[str, Any]:
    stage = normalize_structured_block(value, "description")
    if not isinstance(stage, dict):
        return {}
    aliases = {
        "name": ("name", "title", "名称", "阶段", "小境界", "阶位", "等级", "层次"),
        "description": ("description", "desc", "说明", "描述", "介绍", "效果", "特点"),
    }
    for target, sources in aliases.items():
        if stage.get(target) in (None, ""):
            for source in sources:
                value = stage.get(source)
                if value not in (None, ""):
                    stage[target] = value
                    break
    stage["name"] = "" if stage.get("name") in (None, "") else str(stage.get("name")).strip()
    stage["description"] = "" if stage.get("description") in (None, "") else str(stage.get("description")).strip()
    extras = {key: value for key, value in stage.items() if key not in {"name", "description"}}
    if extras and not stage.get("description"):
        stage["description"] = flatten_text_block(extras)
    return {key: value for key, value in stage.items() if value not in (None, "", [], {})}


def normalize_power_tier(value: Any) -> dict[str, Any]:
    tier = normalize_structured_block(value, "description")
    if not isinstance(tier, dict):
        return {}
    aliases = {
        "name": ("name", "title", "境界", "大境界", "层次", "阶段", "阶位", "等级", "境界名称"),
        "description": ("description", "desc", "说明", "描述", "介绍", "效果", "特点"),
        "stages": ("stages", "sub_stages", "levels", "ranks", "小境界", "小境界列表", "阶段列表", "minor_stages"),
    }
    for target, sources in aliases.items():
        if tier.get(target) in (None, ""):
            for source in sources:
                value = tier.get(source)
                if value not in (None, ""):
                    tier[target] = value
                    break
    tier["name"] = "" if tier.get("name") in (None, "") else str(tier.get("name")).strip()
    tier["description"] = "" if tier.get("description") in (None, "") else str(tier.get("description")).strip()
    stages = tier.get("stages")
    normalized_stages: list[dict[str, Any]] = []
    if isinstance(stages, list):
        for item in stages:
            if isinstance(item, dict):
                normalized = normalize_power_stage(item)
            else:
                normalized = normalize_power_stage({"name": item})
            if normalized:
                normalized_stages.append(normalized)
    elif stages not in (None, ""):
        normalized = normalize_power_stage({"name": stages})
        if normalized:
            normalized_stages.append(normalized)
    if normalized_stages:
        tier["stages"] = normalized_stages
    elif "stages" in tier:
        tier["stages"] = []
    extras = {key: value for key, value in tier.items() if key not in {"name", "description", "stages"}}
    if extras and not tier.get("description"):
        tier["description"] = flatten_text_block(extras)
    return {key: value for key, value in tier.items() if value not in (None, "", [], {})}


def normalize_power_system(value: Any) -> dict[str, Any]:
    system = normalize_structured_block(value, "summary")
    if not isinstance(system, dict):
        return {}
    aliases = {
        "summary": ("summary", "overview", "总览", "简介", "说明", "概述"),
        "tiers": ("tiers", "stages", "levels", "ranks", "境界", "大境界", "境界列表", "realm_list", "power_levels"),
    }
    for target, sources in aliases.items():
        if system.get(target) in (None, ""):
            for source in sources:
                value = system.get(source)
                if value not in (None, ""):
                    system[target] = value
                    break
    system["summary"] = "" if system.get("summary") in (None, "") else str(system.get("summary")).strip()
    tiers = system.get("tiers")
    normalized_tiers: list[dict[str, Any]] = []
    if isinstance(tiers, list):
        for item in tiers:
            if isinstance(item, dict):
                normalized = normalize_power_tier(item)
            else:
                normalized = normalize_power_tier({"name": item})
            if normalized:
                normalized_tiers.append(normalized)
    elif tiers not in (None, ""):
        normalized = normalize_power_tier({"name": tiers})
        if normalized:
            normalized_tiers.append(normalized)
    if normalized_tiers:
        system["tiers"] = normalized_tiers
    elif "tiers" in system:
        system["tiers"] = []
    stage_aliases = {
        "major_tiers": "tiers",
        "realm_tiers": "tiers",
        "realm_levels": "tiers",
    }
    for source, target in stage_aliases.items():
        if system.get(target) in (None, "") and system.get(source) not in (None, ""):
            system[target] = system.get(source)
    extras = {key: value for key, value in system.items() if key not in {"summary", "tiers"}}
    if extras and not system.get("summary"):
        system["summary"] = flatten_text_block(extras)
    return {key: value for key, value in system.items() if value not in (None, "", [], {})}


def normalize_faction_payload(value: dict[str, Any]) -> dict[str, Any]:
    faction = dict(value or {})
    aliases = {
        "名称": "name",
        "势力名": "name",
        "组织名": "name",
        "别名": "aliases",
        "类型": "type",
        "层级": "level",
        "等级": "level",
        "状态": "status",
        "上级势力": "parent_name",
        "上级": "parent_name",
        "所在地": "location",
        "总部": "location",
        "本部": "location",
        "驻地": "location",
        "势力范围": "sphere",
        "影响范围": "sphere",
        "范围": "sphere",
        "领袖": "leader",
        "首领": "leader",
        "掌门": "leader",
        "宗主": "leader",
        "核心成员": "core_members",
        "重要人物": "core_members",
        "代表人物": "core_members",
        "盟友": "allies",
        "敌对方": "enemies",
        "敌人": "enemies",
        "下属势力": "sub_factions",
        "简介": "summary",
        "概述": "summary",
        "描述": "summary",
        "说明": "summary",
        "理念": "ideology",
        "目标": "ideology",
        "价值观": "ideology",
        "核心价值": "ideology",
        "资源": "resources",
        "底蕴": "resources",
        "剧情备注": "plot_notes",
        "关系网": "plot_notes",
        "关系": "plot_notes",
        "禁改事实": "locked_facts",
        "标签": "tags",
        "势力关系": "plot_notes",
        "总部地址": "location",
        "势力级别": "level",
        "级别": "level",
        "层次": "level",
    }
    for source, target in aliases.items():
        if faction.get(target) in (None, "") and faction.get(source) not in (None, ""):
            faction[target] = faction[source]
    if not faction.get("summary") and faction.get("description") not in (None, ""):
        faction["summary"] = faction.get("description")
    if not faction.get("location") and faction.get("headquarters") not in (None, ""):
        faction["location"] = faction.get("headquarters")
    if not faction.get("sphere") and faction.get("scope") not in (None, ""):
        faction["sphere"] = faction.get("scope")
    if not faction.get("ideology") and faction.get("values") not in (None, ""):
        faction["ideology"] = flatten_text_block(faction.get("values"))
    if not faction.get("plot_notes") and faction.get("relationships") not in (None, ""):
        faction["plot_notes"] = flatten_text_block(faction.get("relationships"))
    if not faction.get("core_members") and faction.get("notable_members") not in (None, ""):
        faction["core_members"] = faction.get("notable_members")
    for key in ("name", "type", "level", "status", "parent_name", "location", "sphere", "leader", "summary", "ideology", "resources", "plot_notes"):
        faction[key] = "" if faction.get(key) in (None, "") else str(faction.get(key))
    if not faction.get("status"):
        faction["status"] = "active"
    for key in ("aliases", "core_members", "allies", "enemies", "sub_factions", "locked_facts", "tags"):
        faction[key] = normalize_text_list(faction.get(key, []))
    return faction


def faction_summary(faction: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": faction.get("id"),
        "name": faction.get("name", ""),
        "type": faction.get("type", ""),
        "level": faction.get("level", ""),
        "status": faction.get("status", ""),
        "parent_name": faction.get("parent_name", ""),
        "location": faction.get("location", ""),
        "sphere": faction.get("sphere", ""),
        "leader": faction.get("leader", ""),
        "summary": faction.get("summary", ""),
        "tags": faction.get("tags", []),
    }


def deep_merge_dict(base: Any, patch: Any) -> dict[str, Any]:
    if not isinstance(base, dict):
        base = {}
    if not isinstance(patch, dict):
        return dict(base)
    merged = dict(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge_dict(merged[key], value)
        else:
            merged[key] = value
    return merged


def flatten_text_block(value: Any) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        parts: list[str] = []
        for key, item in value.items():
            if item in (None, "", [], {}):
                continue
            if isinstance(item, list):
                flattened = "、".join(str(subitem).strip() for subitem in item if str(subitem).strip())
                if flattened:
                    parts.append(f"{key}:{flattened}")
            elif isinstance(item, dict):
                nested = flatten_text_block(item)
                if nested:
                    parts.append(f"{key}:{nested}")
            else:
                parts.append(f"{key}:{item}")
        return "；".join(parts)
    if isinstance(value, list):
        return "、".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def summarize_world_profile(profile: Any) -> str:
    profile = profile if isinstance(profile, dict) else {}
    if not profile:
        return ""
    summary = flatten_text_block(profile.get("summary") or profile.get("overview"))
    if summary:
        return summary
    parts: list[str] = []
    for key in ("summary", "overview", "world_type", "genre", "era", "main_stage", "main_stage_name", "tone", "tonality"):
        value = profile.get(key)
        text = flatten_text_block(value)
        if text:
            parts.append(text if key in {"summary", "overview"} else f"{key}:{text}")
    for key in ("core_rules", "rules", "taboos", "keywords", "factions"):
        value = profile.get(key)
        text = flatten_text_block(value)
        if text:
            parts.append(f"{key}:{text}")
    return "；".join(parts[:8]) if parts else flatten_text_block(profile)


def summarize_power_system(power_system: Any) -> str:
    power_system = power_system if isinstance(power_system, dict) else {}
    if not power_system:
        return ""
    parts: list[str] = []
    for key in ("summary", "overview", "system_name", "name", "type", "main_path", "progression"):
        value = power_system.get(key)
        text = flatten_text_block(value)
        if text:
            parts.append(text if key in {"summary", "overview"} else f"{key}:{text}")
    tiers = power_system.get("tiers") or power_system.get("stages") or power_system.get("levels") or power_system.get("ranks") or []
    if isinstance(tiers, list):
        tier_lines: list[str] = []
        for item in tiers:
            if isinstance(item, dict):
                tier_name = flatten_text_block(item.get("name") or item.get("title") or item.get("level") or item.get("rank"))
                tier_desc = flatten_text_block(item.get("description") or item.get("desc") or item.get("summary"))
                stages = item.get("stages") or item.get("sub_stages") or []
                stage_names: list[str] = []
                if isinstance(stages, list):
                    for stage in stages[:9]:
                        if isinstance(stage, dict):
                            stage_name = flatten_text_block(stage.get("name") or stage.get("title") or stage.get("level") or stage.get("rank"))
                        else:
                            stage_name = flatten_text_block(stage)
                        if stage_name:
                            stage_names.append(stage_name)
                line = tier_name
                if tier_desc:
                    line = f"{line}：{tier_desc}" if line else tier_desc
                if stage_names:
                    line = f"{line}（{ '、'.join(stage_names) }）" if line else f"（{ '、'.join(stage_names) }）"
                if line:
                    tier_lines.append(line)
            else:
                tier_name = str(item).strip()
                if tier_name:
                    tier_lines.append(tier_name)
        if tier_lines:
            parts.append(f"tiers:{'；'.join(tier_lines[:8])}")
    for key in ("breakthrough", "breakthrough_rules", "cost", "risk", "restrictions"):
        value = power_system.get(key)
        text = flatten_text_block(value)
        if text:
            parts.append(f"{key}:{text}")
    return "；".join(parts[:8]) if parts else flatten_text_block(power_system)


def normalize_character_payload(character: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(character)
    alias_map = {
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
        "abilities": ("所修功法", "能力", "技能", "功法"),
        "equipment": ("拥有的装备", "装备", "物品"),
        "relationship_notes": ("人物关系", "关系", "关系状态", "关系备注"),
        "public_facts": ("公开事实",),
        "private_facts": ("隐藏事实", "秘密"),
        "locked_facts": ("禁改事实", "锁定事实"),
        "state_variables": ("状态变量", "变量", "MVU", "mvu", "variables"),
    }
    alias_source_keys = {source for sources in alias_map.values() for source in sources}
    for target, sources in alias_map.items():
        if prepared.get(target) in (None, ""):
            for source_key in sources:
                value = prepared.get(source_key)
                if value not in (None, ""):
                    prepared[target] = value
                    break
    status_value = str(prepared.get("status", "")).strip()
    if status_value.lower() in {"active", "alive", "true", "on"}:
        prepared["status"] = "存活"
    elif status_value.lower() in {"dead", "death", "false", "off"}:
        prepared["status"] = "死亡"
    for key in ("aliases", "abilities", "equipment", "public_facts", "private_facts", "locked_facts"):
        prepared[key] = normalize_text_list(prepared.get(key))
    state_variables = prepared.get("state_variables")
    if not isinstance(state_variables, dict):
        state_variables = {}
    custom = state_variables.get("custom")
    if not isinstance(custom, dict):
        custom = {}
    extras = {
        key: value
        for key, value in prepared.items()
        if key not in CHARACTER_COLUMNS and key != "name" and key not in alias_source_keys and key != "补充资料"
    }
    if isinstance(character.get("补充资料"), dict):
        extras = deep_merge_dict(character["补充资料"], extras)
    if extras:
        state_variables["custom"] = deep_merge_dict(custom, extras)
    prepared["state_variables"] = state_variables
    return prepared


def parse_chapter(value: Any) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else 1


def parse_optional_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else None


def parse_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_timeline_event_payload(event: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(event or {})
    title = str(prepared.get("title") or "").strip()
    summary = str(prepared.get("summary") or "").strip()
    legacy_event = str(prepared.get("event") or "").strip()
    date_label = str(prepared.get("date_label") or "").strip()
    year_label = str(prepared.get("year_label") or "").strip() or date_label
    time_note = str(prepared.get("time_note") or "").strip()
    event_type = str(prepared.get("event_type") or "").strip() or ("正序事件" if prepared.get("chapter") else "未知时间")
    side = str(prepared.get("side") or "").strip().lower()
    side = "left" if side in {"left", "左", "左侧"} else "right" if side in {"right", "右", "右侧"} else ""
    chapter = parse_optional_int(prepared.get("chapter"))
    narrative = str(prepared.get("narrative") or "").strip()
    if not title:
        title = legacy_event[:28] if legacy_event else "未命名事件"
    if not summary:
        summary = legacy_event or title
    if not legacy_event:
        legacy_event = summary
    if not year_label:
        year_label = f"第 {chapter} 章" if chapter else "时间未定"
    if not narrative and chapter:
        narrative = f"第 {chapter} 章"
    if not side:
        side = "left" if parse_float(prepared.get("sort_order"), chapter or 0) % 2 else "right"
    return {
        "chapter": chapter,
        "era": str(prepared.get("era") or "未定纪年").strip() or "未定纪年",
        "year_label": year_label,
        "time_note": time_note,
        "sort_order": parse_float(prepared.get("sort_order"), float(chapter or 0)),
        "side": side,
        "event_type": event_type,
        "title": title,
        "summary": summary,
        "narrative": narrative,
        "date_label": date_label or year_label,
        "event": legacy_event,
        "involved_characters": normalize_text_list(prepared.get("involved_characters", [])),
        "factions": normalize_text_list(prepared.get("factions", [])),
        "location": str(prepared.get("location") or "").strip(),
        "consequences": str(prepared.get("consequences") or "").strip(),
        "hooks": normalize_text_list(prepared.get("hooks", [])),
        "tags": normalize_text_list(prepared.get("tags", [])),
    }


def init_project(payload: ProjectInit) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        for table in (
            "characters",
            "lore_entries",
            "map_nodes",
            "map_images",
            "timeline_events",
            "chapter_summaries",
            "full_chapters",
            "factions",
            "pending_changes",
            "change_history",
        ):
            conn.execute(f"DELETE FROM {table} WHERE project_id = ?", (project_id,))
        conn.execute(
            """
            UPDATE projects
            SET title = ?, genre = ?, premise = ?, rules_json = ?, world_profile_json = ?, power_system_json = ?,
                current_chapter = ?, current_scene_goal = ?, current_conflict = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                payload.title,
                payload.genre,
                payload.premise,
                dumps(payload.rules),
                dumps(normalize_world_profile(payload.world_profile)),
                dumps(normalize_power_system(payload.power_system)),
                parse_chapter(payload.current_chapter),
                payload.current_scene_goal,
                payload.current_conflict,
                project_id,
            ),
        )
        for character in payload.characters:
            upsert_character(conn, character, project_id)
        for faction in payload.factions:
            upsert_faction(conn, faction, project_id)
        for lore in payload.lore_entries:
            conn.execute(
                """
                INSERT INTO lore_entries (project_id, title, keys_json, content, scope, priority, insertion_position, enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    lore.get("title", ""),
                    dumps(lore.get("keys", [])),
                    lore.get("content", ""),
                    lore.get("scope", ""),
                    int(lore.get("priority", 50)),
                    lore.get("insertion_position", "context"),
                    1 if lore.get("enabled", True) else 0,
                ),
            )
        for node in prepare_map_nodes_for_canvas(payload.map_nodes):
            prepared = map_node_storage_payload(node)
            conn.execute(
                """
                INSERT INTO map_nodes (project_id, map_image_id, layer, plane, name, type, shape, parent_name, description, faction, color, x, y, polygon_points_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, name) DO UPDATE SET
                    map_image_id = excluded.map_image_id,
                    layer = excluded.layer,
                    plane = excluded.plane,
                    type = excluded.type,
                    shape = excluded.shape,
                    parent_name = excluded.parent_name,
                    description = excluded.description,
                    faction = excluded.faction,
                    color = excluded.color,
                    x = excluded.x,
                    y = excluded.y,
                    polygon_points_json = excluded.polygon_points_json,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    project_id,
                    prepared.get("map_image_id"),
                    prepared.get("layer", ""),
                    prepared.get("plane", ""),
                    prepared.get("name", ""),
                    prepared.get("type", "place"),
                    prepared.get("shape", "point"),
                    prepared.get("parent_name", ""),
                    prepared.get("description", ""),
                    prepared.get("faction", ""),
                    prepared.get("color", ""),
                    float(prepared.get("x", 0)),
                    float(prepared.get("y", 0)),
                    prepared.get("polygon_points_json", "[]"),
                ),
            )
        for event in payload.timeline:
            add_timeline_event(conn, event, project_id)
    return get_dashboard()


def upsert_character(conn: Any, character: dict[str, Any], project_id: int | None = None) -> None:
    project_id = project_id or current_project_id(conn)
    character = normalize_character_payload(character)
    name = character.get("name")
    if not name:
        return
    fields = {
        "aliases_json": dumps(character.get("aliases", [])),
        "role": character.get("role", ""),
        "gender": character.get("gender", ""),
        "personality": character.get("personality", ""),
        "realm": character.get("realm", ""),
        "identity": character.get("identity", ""),
        "age": str(character.get("age", "")),
        "status": character.get("status", "存活"),
        "location": character.get("location", ""),
        "emotional_state": character.get("emotional_state", ""),
        "physical_state": character.get("physical_state", ""),
        "faction": character.get("faction", ""),
        "bloodline": character.get("bloodline", ""),
        "abilities_json": dumps(character.get("abilities", [])),
        "equipment_json": dumps(character.get("equipment", [])),
        "relationship_notes": character.get("relationship_notes", ""),
        "public_facts_json": dumps(character.get("public_facts", [])),
        "private_facts_json": dumps(character.get("private_facts", [])),
        "locked_facts_json": dumps(character.get("locked_facts", [])),
        "state_variables_json": dumps(character.get("state_variables", {})),
    }
    conn.execute(
        """
        INSERT INTO characters (
            project_id, name, aliases_json, role, gender, personality, realm, identity, age, status, location, emotional_state,
            physical_state, faction, bloodline, abilities_json, equipment_json, relationship_notes,
            public_facts_json, private_facts_json, locked_facts_json, state_variables_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, name) DO UPDATE SET
            aliases_json = excluded.aliases_json,
            role = excluded.role,
            gender = excluded.gender,
            personality = excluded.personality,
            realm = excluded.realm,
            identity = excluded.identity,
            age = excluded.age,
            status = excluded.status,
            location = excluded.location,
            emotional_state = excluded.emotional_state,
            physical_state = excluded.physical_state,
            faction = excluded.faction,
            bloodline = excluded.bloodline,
            abilities_json = excluded.abilities_json,
            equipment_json = excluded.equipment_json,
            relationship_notes = excluded.relationship_notes,
            public_facts_json = excluded.public_facts_json,
            private_facts_json = excluded.private_facts_json,
            locked_facts_json = excluded.locked_facts_json,
            state_variables_json = excluded.state_variables_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (project_id, name, *fields.values()),
    )


def upsert_faction(conn: Any, faction: dict[str, Any], project_id: int | None = None) -> None:
    project_id = project_id or current_project_id(conn)
    faction = normalize_faction_payload(faction)
    name = faction.get("name")
    if not name:
        return
    conn.execute(
        """
        INSERT INTO factions (
            project_id, name, aliases_json, type, level, status, parent_name, location, sphere,
            leader, core_members_json, allies_json, enemies_json, sub_factions_json,
            summary, ideology, resources, plot_notes, locked_facts_json, tags_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, name) DO UPDATE SET
            aliases_json = excluded.aliases_json,
            type = excluded.type,
            level = excluded.level,
            status = excluded.status,
            parent_name = excluded.parent_name,
            location = excluded.location,
            sphere = excluded.sphere,
            leader = excluded.leader,
            core_members_json = excluded.core_members_json,
            allies_json = excluded.allies_json,
            enemies_json = excluded.enemies_json,
            sub_factions_json = excluded.sub_factions_json,
            summary = excluded.summary,
            ideology = excluded.ideology,
            resources = excluded.resources,
            plot_notes = excluded.plot_notes,
            locked_facts_json = excluded.locked_facts_json,
            tags_json = excluded.tags_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            project_id,
            name,
            dumps(faction.get("aliases", [])),
            faction.get("type", ""),
            faction.get("level", ""),
            faction.get("status", "active"),
            faction.get("parent_name", ""),
            faction.get("location", ""),
            faction.get("sphere", ""),
            faction.get("leader", ""),
            dumps(faction.get("core_members", [])),
            dumps(faction.get("allies", [])),
            dumps(faction.get("enemies", [])),
            dumps(faction.get("sub_factions", [])),
            faction.get("summary", ""),
            faction.get("ideology", ""),
            faction.get("resources", ""),
            faction.get("plot_notes", ""),
            dumps(faction.get("locked_facts", [])),
            dumps(faction.get("tags", [])),
        ),
    )


def add_timeline_event(conn: Any, event: dict[str, Any], project_id: int | None = None) -> None:
    project_id = project_id or current_project_id(conn)
    prepared = normalize_timeline_event_payload(event)
    conn.execute(
        """
        INSERT INTO timeline_events (
            project_id, chapter, era, year_label, time_note, sort_order, side, event_type,
            title, summary, narrative, date_label, event, involved_characters_json,
            factions_json, location, consequences, hooks_json, tags_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            prepared["chapter"],
            prepared["era"],
            prepared["year_label"],
            prepared["time_note"],
            prepared["sort_order"],
            prepared["side"],
            prepared["event_type"],
            prepared["title"],
            prepared["summary"],
            prepared["narrative"],
            prepared["date_label"],
            prepared["event"],
            dumps(prepared["involved_characters"]),
            dumps(prepared["factions"]),
            prepared["location"],
            prepared["consequences"],
            dumps(prepared["hooks"]),
            dumps(prepared["tags"]),
        ),
    )


def get_project() -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (current_project_id(conn),)).fetchone()
    return normalize_row(row)


def get_project_from_conn(conn: Any) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (current_project_id(conn),)).fetchone()
    return normalize_row(row)


def list_projects() -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC, id DESC").fetchall()
    return [normalize_row(row) for row in rows]


def create_project(title: str = "未命名作品", genre: str = "", premise: str = "") -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        conn.execute("UPDATE projects SET is_active = 0")
        cursor = conn.execute(
            """
            INSERT INTO projects (title, genre, premise, is_active)
            VALUES (?, ?, ?, 1)
            """,
            (title, genre, premise),
        )
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return normalize_row(project)


def update_project(project_id: int, patch: dict[str, Any]) -> dict[str, Any]:
    init_db()
    allowed_fields = ("title", "genre", "premise")
    fields: list[str] = []
    values: list[Any] = []
    for field in allowed_fields:
        if field in patch and patch[field] is not None:
            value = str(patch[field]).strip() if field == "title" else str(patch[field] or "")
            if field == "title" and not value:
                raise ValueError("Project title cannot be empty")
            fields.append(f"{field} = ?")
            values.append(value)
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise ValueError("Project not found")
        if fields:
            values.append(project_id)
            conn.execute(f"UPDATE projects SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return normalize_row(project)


def delete_project(project_id: int) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise ValueError("Project not found")
        was_active = bool(row["is_active"])
        for table in (
            "characters",
            "lore_entries",
            "map_nodes",
            "map_images",
            "timeline_events",
            "chapter_summaries",
            "full_chapters",
            "factions",
            "pending_changes",
            "change_history",
        ):
            conn.execute(f"DELETE FROM {table} WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        remaining = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC, id DESC").fetchall()
        if remaining:
            if was_active or not any(project["is_active"] for project in remaining):
                conn.execute("UPDATE projects SET is_active = 0")
                conn.execute("UPDATE projects SET is_active = 1 WHERE id = ?", (remaining[0]["id"],))
        else:
            conn.execute(
                "INSERT INTO projects (id, title, genre, premise, is_active) VALUES (1, '未命名作品', '', '', 1)"
            )
    return get_dashboard()


def propose_delete_project(project_id: int | None = None, project_title: str | None = None, reason: str = "", source: str = "llm") -> dict[str, Any]:
    project = resolve_project(project_id, project_title)
    with get_connection() as conn:
        set_active_project(conn, int(project["id"]))
    change = create_pending_change(
        "project_delete",
        project.get("title", ""),
        {"project_id": project["id"], "title": project.get("title", "")},
        reason or "请求删除小说项目",
        source,
    )
    return {"mode": "pending", "change": change, "project": project}


def switch_project(project_id: int) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise ValueError("Project not found")
        conn.execute("UPDATE projects SET is_active = 0")
        conn.execute("UPDATE projects SET is_active = 1 WHERE id = ?", (project_id,))
    return get_dashboard()


def delete_character(name: str) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        before_row = conn.execute("SELECT * FROM characters WHERE project_id = ? AND name = ?", (project_id, name)).fetchone()
        if not before_row:
            raise ValueError("Character not found")
        before = normalize_row(before_row)
        conn.execute("DELETE FROM characters WHERE project_id = ? AND name = ?", (project_id, name))
        conn.execute(
            """
            UPDATE pending_changes
            SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP
            WHERE project_id = ? AND target_type = 'character_delete' AND target_name = ? AND status = 'pending'
            """,
            (project_id, name),
        )
        log_history(conn, "character_delete", name, {"deleted": True}, "作者删除角色卡", "user", before, {})
    return {"status": "deleted", "dashboard": get_dashboard()}


def propose_delete_character(
    name: str,
    project_id: int | None = None,
    project_title: str | None = None,
    reason: str = "",
    source: str = "llm",
) -> dict[str, Any]:
    prepare_project_context(project_id, project_title)
    character = get_character(name)
    if not character:
        raise ValueError("Character not found")
    change = create_pending_change(
        "character_delete",
        name,
        {"name": name},
        reason or "请求删除角色卡",
        source,
    )
    return {"mode": "pending", "change": change, "character": character}


def list_characters() -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM characters WHERE project_id = ? ORDER BY role DESC, name",
            (current_project_id(conn),),
        ).fetchall()
    return [normalize_row(row) for row in rows]


def get_character(name: str) -> dict[str, Any] | None:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM characters WHERE project_id = ? AND name = ?",
            (current_project_id(conn), name),
        ).fetchone()
    return normalize_row(row) if row else None


def list_factions(full: bool = True) -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM factions WHERE project_id = ? ORDER BY type, level, name",
            (current_project_id(conn),),
        ).fetchall()
    factions = [normalize_row(row) for row in rows]
    return factions if full else [faction_summary(faction) for faction in factions]


def get_faction(name: str) -> dict[str, Any] | None:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM factions WHERE project_id = ? AND name = ?",
            (current_project_id(conn), name),
        ).fetchone()
    return normalize_row(row) if row else None


def apply_faction_patch(conn: Any, name: str, patch: dict[str, Any], reason: str, source: str) -> dict[str, Any] | None:
    normalized_patch = normalize_faction_payload({**patch, "name": patch.get("name") or name})
    allowed = {key: value for key, value in normalized_patch.items() if key in FACTION_COLUMNS and key != "name"}
    incoming_name = str(normalized_patch.get("name") or name).strip()
    if not incoming_name:
        return None
    project_id = current_project_id(conn)
    before_row = conn.execute("SELECT * FROM factions WHERE project_id = ? AND name = ?", (project_id, name)).fetchone()
    before = normalize_row(before_row) if before_row else {}
    if not before_row:
        upsert_faction(conn, {"name": incoming_name, **allowed}, project_id)
    else:
        assignments = []
        values: list[Any] = []
        if incoming_name != name:
            assignments.append("name = ?")
            values.append(incoming_name)
        for key, value in allowed.items():
            if key in {"aliases", "core_members", "allies", "enemies", "sub_factions", "locked_facts", "tags"}:
                value = normalize_text_list(value)
            column = f"{key}_json" if key in JSON_FIELDS else key
            assignments.append(f"{column} = ?")
            values.append(dumps(value) if key in JSON_FIELDS else str(value))
        if assignments:
            conn.execute(
                f"UPDATE factions SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND name = ?",
                [*values, project_id, name],
            )
    after_row = conn.execute("SELECT * FROM factions WHERE project_id = ? AND name = ?", (project_id, incoming_name)).fetchone()
    after = normalize_row(after_row) if after_row else {}
    log_history(conn, "faction", incoming_name, patch, reason, source, before, after)
    return after


def update_faction_direct(name: str, patch: dict[str, Any], reason: str = "作者手动修正势力") -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        faction = apply_faction_patch(conn, name, patch, reason, "user")
    return {"mode": "applied", "faction": faction, "dashboard": get_dashboard()}


def create_faction(payload: FactionIn) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        before_row = conn.execute("SELECT * FROM factions WHERE project_id = ? AND name = ?", (project_id, payload.name)).fetchone()
        upsert_faction(conn, payload.model_dump(), project_id)
        after_row = conn.execute("SELECT * FROM factions WHERE project_id = ? AND name = ?", (project_id, payload.name)).fetchone()
        log_history(
            conn,
            "faction",
            payload.name,
            payload.model_dump(),
            "作者新增势力",
            "user",
            normalize_row(before_row) if before_row else {},
            normalize_row(after_row),
        )
    return {"mode": "applied", "faction": get_faction(payload.name), "dashboard": get_dashboard()}


def delete_faction(name: str) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        before_row = conn.execute("SELECT * FROM factions WHERE project_id = ? AND name = ?", (project_id, name)).fetchone()
        if not before_row:
            raise ValueError("Faction not found")
        before = normalize_row(before_row)
        conn.execute("DELETE FROM factions WHERE project_id = ? AND name = ?", (project_id, name))
        conn.execute(
            """
            UPDATE pending_changes
            SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP
            WHERE project_id = ? AND target_type = 'faction_delete' AND target_name = ? AND status = 'pending'
            """,
            (project_id, name),
        )
        log_history(conn, "faction_delete", name, {"deleted": True}, "作者删除势力", "user", before, {})
    return {"status": "deleted", "dashboard": get_dashboard()}


def propose_faction_update(name: str, patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    init_db()
    if source == "llm":
        payload = {"name": name, **(patch or {})}
        validation = validate_payload("faction", payload)
        if not validation["valid"]:
            return {"mode": "invalid", "validation": validation}
        normalized = validation["normalized"]
        target_name = str(normalized.get("name") or name).strip()
        return {
            "mode": "pending",
            "change": create_pending_change(
                "faction",
                target_name,
                normalized,
                reason,
                source,
                "factions",
                target_name,
                normalized,
                validation,
            ),
        }
    protected = any(field in PROTECTED_FACTION_FIELDS for field in patch)
    if not get_faction(name):
        protected = True
    if protected:
        return {"mode": "pending", "change": create_pending_change("faction", name, patch, reason, source)}
    with get_connection() as conn:
        faction = apply_faction_patch(conn, name, patch, reason, source)
    return {"mode": "applied", "faction": faction}


def propose_delete_faction(name: str, reason: str = "", source: str = "llm") -> dict[str, Any]:
    faction = get_faction(name)
    if not faction:
        raise ValueError("Faction not found")
    change = create_pending_change("faction_delete", name, {"name": name}, reason or "请求删除势力", source)
    return {"mode": "pending", "change": change, "faction": faction}


def list_lore(keyword: str | None = None) -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM lore_entries WHERE project_id = ? AND enabled = 1 ORDER BY priority DESC, title",
            (current_project_id(conn),),
        ).fetchall()
    entries = [normalize_row(row) for row in rows]
    if not keyword:
        return entries
    lowered = keyword.lower()
    return [
        entry
        for entry in entries
        if lowered in entry["title"].lower()
        or lowered in entry["content"].lower()
        or any(lowered in key.lower() for key in entry["keys"])
    ]


def strip_image_data(images: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{key: value for key, value in image.items() if key != "image_data"} for image in images]


def get_world_state(scope: str | None = None, include_image_data: bool = False) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        project = get_project_from_conn(conn)
        nodes = [normalize_row(row) for row in conn.execute("SELECT * FROM map_nodes WHERE project_id = ? ORDER BY type, name", (project_id,)).fetchall()]
        images = [normalize_row(row) for row in conn.execute("SELECT * FROM map_images WHERE project_id = ? ORDER BY layer, title, id", (project_id,)).fetchall()]
        lore = [normalize_row(row) for row in conn.execute("SELECT * FROM lore_entries WHERE project_id = ? ORDER BY priority DESC, title", (project_id,)).fetchall()]
        factions = [normalize_row(row) for row in conn.execute("SELECT * FROM factions WHERE project_id = ? ORDER BY type, level, name", (project_id,)).fetchall()]
    world_profile = normalize_world_profile(project.get("world_profile", {}))
    power_system = normalize_power_system(project.get("power_system", {}))
    if scope:
        needle = scope.lower()
        nodes = [n for n in nodes if needle in n["name"].lower() or needle in n["description"].lower() or needle in n["type"].lower()]
        lore = [l for l in lore if needle in l["title"].lower() or needle in l["content"].lower() or needle in l["scope"].lower()]
        factions = [
            f
            for f in factions
            if needle in f["name"].lower()
            or needle in f["summary"].lower()
            or needle in f["type"].lower()
            or needle in f["leader"].lower()
        ]
    return {
        "project": project,
        "world_profile": world_profile,
        "power_system": power_system,
        "world_profile_summary": summarize_world_profile(world_profile),
        "power_system_summary": summarize_power_system(power_system),
        "map_nodes": nodes,
        "map_images": images if include_image_data else strip_image_data(images),
        "factions": factions if include_image_data else [faction_summary(faction) for faction in factions],
        "lore_entries": lore,
    }


def get_world_state_from_conn(conn: Any, include_image_data: bool = False) -> dict[str, Any]:
    project_id = current_project_id(conn)
    project = get_project_from_conn(conn)
    nodes = [normalize_row(row) for row in conn.execute("SELECT * FROM map_nodes WHERE project_id = ? ORDER BY type, name", (project_id,)).fetchall()]
    images = [normalize_row(row) for row in conn.execute("SELECT * FROM map_images WHERE project_id = ? ORDER BY layer, title, id", (project_id,)).fetchall()]
    lore = [normalize_row(row) for row in conn.execute("SELECT * FROM lore_entries WHERE project_id = ? ORDER BY priority DESC, title", (project_id,)).fetchall()]
    factions = [normalize_row(row) for row in conn.execute("SELECT * FROM factions WHERE project_id = ? ORDER BY type, level, name", (project_id,)).fetchall()]
    world_profile = normalize_world_profile(project.get("world_profile", {}))
    power_system = normalize_power_system(project.get("power_system", {}))
    return {
        "project": project,
        "world_profile": world_profile,
        "power_system": power_system,
        "world_profile_summary": summarize_world_profile(world_profile),
        "power_system_summary": summarize_power_system(power_system),
        "map_nodes": nodes,
        "map_images": images if include_image_data else strip_image_data(images),
        "factions": factions if include_image_data else [faction_summary(faction) for faction in factions],
        "lore_entries": lore,
    }


def get_world_profile() -> dict[str, Any]:
    return get_world_state()["world_profile"]


def get_power_system() -> dict[str, Any]:
    return get_world_state()["power_system"]


def update_world_profile_direct(patch: dict[str, Any], reason: str = "作者手动修正世界观") -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        project = get_project_from_conn(conn)
        before = normalize_world_profile(project.get("world_profile", {}))
        merged = deep_merge_dict(before, patch)
        after = normalize_world_profile(merged)
        conn.execute(
            "UPDATE projects SET world_profile_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (dumps(after), project_id),
        )
        log_history(conn, "world_profile", "世界观", patch, reason, "user", before, after)
    return {"mode": "applied", "world_profile": get_world_profile(), "dashboard": get_dashboard()}


def update_power_system_direct(patch: dict[str, Any], reason: str = "作者手动修正境界设定") -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        project = get_project_from_conn(conn)
        before = normalize_power_system(project.get("power_system", {}))
        merged = deep_merge_dict(before, patch)
        after = normalize_power_system(merged)
        conn.execute(
            "UPDATE projects SET power_system_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (dumps(after), project_id),
        )
        log_history(conn, "power_system", "境界设定", patch, reason, "user", before, after)
    return {"mode": "applied", "power_system": get_power_system(), "dashboard": get_dashboard()}


def create_map_node(payload: MapNodeCreate) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        node = map_node_storage_payload(payload.model_dump())
        conn.execute(
            """
            INSERT INTO map_nodes (project_id, map_image_id, layer, plane, name, type, shape, parent_name, description, faction, color, x, y, polygon_points_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, name) DO UPDATE SET
                map_image_id = excluded.map_image_id,
                layer = excluded.layer,
                plane = excluded.plane,
                type = excluded.type,
                shape = excluded.shape,
                parent_name = excluded.parent_name,
                description = excluded.description,
                faction = excluded.faction,
                color = excluded.color,
                x = excluded.x,
                y = excluded.y,
                polygon_points_json = excluded.polygon_points_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                project_id,
                node.get("map_image_id"),
                node.get("layer", ""),
                node.get("plane", ""),
                node.get("name", ""),
                node.get("type", "place"),
                node.get("shape", "point"),
                node.get("parent_name", ""),
                node.get("description", ""),
                node.get("faction", ""),
                node.get("color", ""),
                float(node.get("x", 0)),
                float(node.get("y", 0)),
                node.get("polygon_points_json", "[]"),
            ),
        )
        row = conn.execute("SELECT * FROM map_nodes WHERE project_id = ? AND name = ?", (project_id, payload.name)).fetchone()
        log_history(conn, "map_node", payload.name, payload.model_dump(), "作者新增地图标注", "user", {}, normalize_row(row))
    return {"map_node": normalize_row(row), "dashboard": get_dashboard()}


def save_map_image(payload: MapImageIn) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        cursor = conn.execute(
            """
            INSERT INTO map_images (
                project_id, title, layer, parent_name, scope, scale_label, real_width,
                real_height, distance_unit, scale_kind, image_data, mime_type, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                payload.title,
                payload.layer,
                payload.parent_name,
                payload.scope,
                payload.scale_label,
                payload.real_width,
                payload.real_height,
                payload.distance_unit,
                payload.scale_kind,
                payload.image_data,
                payload.mime_type,
                payload.notes,
            ),
        )
        row = conn.execute("SELECT * FROM map_images WHERE id = ?", (cursor.lastrowid,)).fetchone()
        log_history(
            conn,
            "map_image",
            payload.title,
            {
                "title": payload.title,
                "layer": payload.layer,
                "parent_name": payload.parent_name,
                "scope": payload.scope,
                "scale_label": payload.scale_label,
                "real_width": payload.real_width,
                "real_height": payload.real_height,
                "distance_unit": payload.distance_unit,
                "scale_kind": payload.scale_kind,
                "mime_type": payload.mime_type,
                "notes": payload.notes,
            },
            "作者导入地图册图片",
            "user",
            {},
            normalize_row(row),
        )
    return {"map_image": normalize_row(row), "dashboard": get_dashboard()}


def update_map_image_direct(image_id: int, patch: dict[str, Any], reason: str = "作者手动修正地图图片") -> dict[str, Any]:
    init_db()
    allowed = {key: value for key, value in patch.items() if key in MAP_IMAGE_COLUMNS}
    if not allowed:
        raise ValueError("No valid map image fields")
    with get_connection() as conn:
        project_id = current_project_id(conn)
        row = conn.execute("SELECT * FROM map_images WHERE project_id = ? AND id = ?", (project_id, image_id)).fetchone()
        if not row:
            raise ValueError("Map image not found")
        assignments = []
        values: list[Any] = []
        for key, value in allowed.items():
            assignments.append(f"{key} = ?")
            if key in {"real_width", "real_height"}:
                values.append(float(value or 0))
            else:
                values.append(str(value or ""))
        values.append(image_id)
        conn.execute(
            f"UPDATE map_images SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
        updated = conn.execute("SELECT * FROM map_images WHERE project_id = ? AND id = ?", (project_id, image_id)).fetchone()
        log_history(conn, "map_image", str(allowed.get("title", row["title"])), allowed, reason, "user", normalize_row(row), normalize_row(updated))
    return {"mode": "applied", "map_image": normalize_row(updated), "dashboard": get_dashboard()}


def delete_map_image(image_id: int | None = None) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        if image_id is None:
            conn.execute("DELETE FROM map_nodes WHERE project_id = ? AND map_image_id IS NOT NULL", (project_id,))
            conn.execute("DELETE FROM map_images WHERE project_id = ?", (project_id,))
        else:
            conn.execute("DELETE FROM map_nodes WHERE project_id = ? AND map_image_id = ?", (project_id, image_id))
            conn.execute("DELETE FROM map_images WHERE project_id = ? AND id = ?", (project_id, image_id))
    return get_dashboard()


def update_map_node_direct(node_id: int, patch: dict[str, Any], reason: str = "作者手动修正地图") -> dict[str, Any]:
    init_db()
    allowed = {key: value for key, value in patch.items() if key in MAP_NODE_COLUMNS}
    if not allowed:
        raise ValueError("No valid map node fields")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM map_nodes WHERE project_id = ? AND id = ?",
            (current_project_id(conn), node_id),
        ).fetchone()
        if not row:
            raise ValueError("Map node not found")
        prepared = map_node_storage_payload({**normalize_row(row), **allowed})
        assignments = []
        values: list[Any] = []
        for key in ("map_image_id", "layer", "plane", "name", "type", "shape", "parent_name", "description", "faction", "color", "x", "y", "polygon_points_json"):
            assignments.append(f"{key} = ?")
            if key == "map_image_id":
                value = prepared.get(key)
                values.append(int(value) if value not in (None, "") else None)
            elif key in {"x", "y"}:
                values.append(float(prepared.get(key, 0)))
            elif key == "polygon_points_json":
                values.append(prepared.get(key, "[]"))
            else:
                values.append(str(prepared.get(key, "")))
        values.append(node_id)
        conn.execute(
            f"UPDATE map_nodes SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
        target_name = allowed.get("name", row["name"])
        updated = conn.execute("SELECT * FROM map_nodes WHERE id = ?", (node_id,)).fetchone()
        log_history(conn, "map_node", str(target_name), allowed, reason, "user", normalize_row(row), normalize_row(updated))
    return {"mode": "applied", "map_node": normalize_row(updated)}


def delete_map_node(node_id: int) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        row = conn.execute(
            "SELECT * FROM map_nodes WHERE project_id = ? AND id = ?",
            (project_id, node_id),
        ).fetchone()
        if not row:
            raise ValueError("Map node not found")
        before = normalize_row(row)
        conn.execute("DELETE FROM map_nodes WHERE project_id = ? AND id = ?", (project_id, node_id))
        log_history(conn, "map_node", str(before.get("name", node_id)), {"deleted": True}, "作者删除地图标注", "user", before, {})
    return {"status": "deleted", "dashboard": get_dashboard()}


def update_lore_entry_direct(entry_id: int, patch: dict[str, Any], reason: str = "作者手动修正世界书") -> dict[str, Any]:
    init_db()
    allowed = {key: value for key, value in patch.items() if key in LORE_ENTRY_COLUMNS}
    if not allowed:
        raise ValueError("No valid lore entry fields")
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM lore_entries WHERE project_id = ? AND id = ?",
            (current_project_id(conn), entry_id),
        ).fetchone()
        if not row:
            raise ValueError("Lore entry not found")
        assignments = []
        values: list[Any] = []
        for key, value in allowed.items():
            column = "keys_json" if key == "keys" else key
            assignments.append(f"{column} = ?")
            if key == "keys":
                values.append(dumps(value))
            elif key == "priority":
                values.append(int(value))
            elif key == "enabled":
                values.append(1 if value else 0)
            else:
                values.append(str(value))
        values.append(entry_id)
        conn.execute(
            f"UPDATE lore_entries SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
        target_name = allowed.get("title", row["title"])
        updated = conn.execute("SELECT * FROM lore_entries WHERE id = ?", (entry_id,)).fetchone()
        log_history(conn, "lore_entry", str(target_name), allowed, reason, "user", normalize_row(row), normalize_row(updated))
    return {"mode": "applied", "lore_entry": normalize_row(updated)}


def get_timeline(chapter_range: str | None = None) -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        query = """
            SELECT * FROM timeline_events
            WHERE project_id = ?
            ORDER BY
                CASE WHEN sort_order = 0 AND COALESCE(chapter, 0) > 0 THEN chapter ELSE sort_order END,
                COALESCE(chapter, 999999),
                year_label,
                date_label,
                id
        """
        params: tuple[Any, ...] = (project_id,)
        if chapter_range and "-" in chapter_range:
            start, end = [int(part.strip()) for part in chapter_range.split("-", 1)]
            query = """
                SELECT * FROM timeline_events
                WHERE project_id = ? AND chapter BETWEEN ? AND ?
                ORDER BY
                    CASE WHEN sort_order = 0 AND COALESCE(chapter, 0) > 0 THEN chapter ELSE sort_order END,
                    chapter,
                    id
            """
            params = (project_id, start, end)
        rows = conn.execute(query, params).fetchall()
    return [normalize_row(row) for row in rows]


def module_for_target_type(target_type: str) -> str:
    if target_type.startswith("character"):
        return "characters"
    if target_type.startswith("faction"):
        return "factions"
    if target_type.startswith("power") or target_type == "power_system":
        return "powerSystem"
    if target_type.startswith("map"):
        return "maps"
    if target_type.startswith("timeline"):
        return "timeline"
    if target_type.startswith("chapter"):
        return "chapters"
    if target_type.startswith("world"):
        return "world"
    if target_type.startswith("project"):
        return "projects"
    return ""


def pending_change_payload(
    target_type: str,
    target_name: str,
    patch: dict[str, Any],
    module_type: str = "",
    target_entity: str = "",
    preview: dict[str, Any] | None = None,
    validation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    module = module_type or module_for_target_type(target_type)
    return {
        "module_type": module,
        "module_label": MODULE_LABELS.get(module, module),
        "target_entity": target_entity or target_name,
        "preview": preview if preview is not None else patch,
        "validation": validation or {"valid": True, "errors": [], "warnings": []},
    }


def create_pending_change(
    target_type: str,
    target_name: str,
    patch: dict[str, Any],
    reason: str,
    source: str,
    module_type: str = "",
    target_entity: str = "",
    preview: dict[str, Any] | None = None,
    validation: dict[str, Any] | None = None,
) -> dict[str, Any]:
    meta = pending_change_payload(target_type, target_name, patch, module_type, target_entity, preview, validation)
    with get_connection() as conn:
        project_id = current_project_id(conn)
        cursor = conn.execute(
            """
            INSERT INTO pending_changes (
                project_id, target_type, target_name, module_type, target_entity,
                patch_json, preview_json, validation_json, reason, source
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                target_type,
                target_name,
                meta["module_type"],
                meta["target_entity"],
                dumps(patch),
                dumps(meta["preview"]),
                dumps(meta["validation"]),
                reason,
                source,
            ),
        )
        row = conn.execute("SELECT * FROM pending_changes WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return normalize_row(row)


def log_history(
    conn: Any,
    target_type: str,
    target_name: str,
    patch: dict[str, Any],
    reason: str,
    source: str,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO change_history (project_id, target_type, target_name, patch_json, before_json, after_json, reason, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (current_project_id(conn), target_type, target_name, dumps(patch), dumps(before or {}), dumps(after or {}), reason, source),
    )


def apply_character_patch(conn: Any, name: str, patch: dict[str, Any], reason: str, source: str) -> None:
    normalized_patch = normalize_character_payload({**patch, "name": patch.get("name") or name})
    allowed = {key: value for key, value in normalized_patch.items() if key in CHARACTER_COLUMNS and key != "name"}
    state_variables_patch = normalized_patch.get("state_variables")
    if not isinstance(state_variables_patch, dict):
        state_variables_patch = {}
    if not allowed:
        if state_variables_patch:
            allowed["state_variables"] = state_variables_patch
        else:
            raise ValueError("Patch does not contain any supported character fields")
    for key in ("aliases", "abilities", "equipment", "public_facts", "private_facts", "locked_facts"):
        if key in allowed:
            allowed[key] = normalize_text_list(allowed[key])
    if state_variables_patch:
        allowed["state_variables"] = state_variables_patch
    project_id = current_project_id(conn)
    before_row = conn.execute("SELECT * FROM characters WHERE project_id = ? AND name = ?", (project_id, name)).fetchone()
    before = normalize_row(before_row) if before_row else {}
    assignments = []
    values: list[Any] = []
    for key, value in allowed.items():
        column = f"{key}_json" if key in JSON_FIELDS else key
        assignments.append(f"{column} = ?")
        values.append(dumps(value) if key in JSON_FIELDS else str(value))
    values.append(name)
    conn.execute(
        f"UPDATE characters SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND name = ?",
        [*values[:-1], project_id, values[-1]],
    )
    after_row = conn.execute("SELECT * FROM characters WHERE project_id = ? AND name = ?", (project_id, name)).fetchone()
    log_history(conn, "character", name, allowed, reason, source, before, normalize_row(after_row) if after_row else {})


def propose_character_update(name: str, patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    init_db()
    if source == "llm":
        payload = {"name": name, **(patch or {})}
        validation = validate_payload("character", payload)
        if not validation["valid"]:
            return {"mode": "invalid", "validation": validation}
        normalized = validation["normalized"]
        target_name = str(normalized.get("name") or name).strip()
        return {
            "mode": "pending",
            "change": create_pending_change(
                "character",
                target_name,
                normalized,
                reason,
                source,
                "characters",
                target_name,
                normalized,
                validation,
            ),
        }
    protected = any(field in PROTECTED_CHARACTER_FIELDS for field in patch)
    existing = get_character(name)
    if not existing:
        protected = True
    if protected:
        return {"mode": "pending", "change": create_pending_change("character", name, patch, reason, source)}
    with get_connection() as conn:
        apply_character_patch(conn, name, patch, reason, source)
    return {"mode": "applied", "character": get_character(name)}


def update_character_direct(name: str, patch: dict[str, Any], reason: str = "作者手动修正") -> dict[str, Any]:
    init_db()
    if not get_character(name):
        raise ValueError("Character not found")
    with get_connection() as conn:
        apply_character_patch(conn, name, patch, reason, "user")
    return {"mode": "applied", "character": get_character(name)}


def propose_world_update(patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    init_db()
    if source == "llm":
        return {"mode": "pending", "change": create_pending_change("world", "", patch, reason, source)}
    protected = any(field in PROTECTED_WORLD_FIELDS for field in patch)
    if protected:
        return {"mode": "pending", "change": create_pending_change("world", "", patch, reason, source)}
    with get_connection() as conn:
        project_id = current_project_id(conn)
        if "current_scene_goal" in patch or "current_conflict" in patch or "current_chapter" in patch:
            fields = []
            values: list[Any] = []
            for key in ("current_scene_goal", "current_conflict", "current_chapter"):
                if key in patch:
                    fields.append(f"{key} = ?")
                    values.append(patch[key])
            values.append(project_id)
            conn.execute(f"UPDATE projects SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            log_history(conn, "world", "", patch, reason, source)
    return {"mode": "applied", "world": get_world_state()}


def propose_world_profile_update(patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    return propose_world_update({"world_profile": patch}, reason, source)


def propose_power_system_update(patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    return propose_world_update({"power_system": patch}, reason, source)


def propose_validated_change(
    kind: str,
    target_type: str,
    target_name: str,
    payload: dict[str, Any],
    reason: str = "",
    source: str = "llm",
    module_type: str = "",
    target_entity: str = "",
) -> dict[str, Any]:
    validation = validate_payload(kind, payload)
    if not validation["valid"]:
        return {"mode": "invalid", "validation": validation}
    normalized = validation["normalized"]
    target = target_entity or target_name
    if not target:
        target = str(normalized.get("name") or normalized.get("title") or normalized.get("chapter") or "").strip()
    change = create_pending_change(
        target_type,
        target,
        normalized,
        reason,
        source,
        module_type or module_for_target_type(target_type),
        target,
        normalized,
        validation,
    )
    return {"mode": "pending", "change": change, "validation": validation}


def propose_character_create(payload: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    validation = validate_payload("character", payload)
    if not validation["valid"]:
        return {"mode": "invalid", "validation": validation}
    name = str(validation["normalized"].get("name") or "").strip()
    return propose_validated_change("character", "character", name, payload, reason or "LLM 提交人物资料", source, "characters", name)


def propose_faction_create(payload: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    validation = validate_payload("faction", payload)
    if not validation["valid"]:
        return {"mode": "invalid", "validation": validation}
    name = str(validation["normalized"].get("name") or "").strip()
    return propose_validated_change("faction", "faction", name, payload, reason or "LLM 提交势力资料", source, "factions", name)


def propose_world_summary_update(summary: str | dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    payload = {"世界设定": summary} if isinstance(summary, str) else summary
    return propose_validated_change("world_summary", "world_summary", "世界设定", payload, reason or "LLM 提交世界设定", source, "world", "世界设定")


def propose_power_realm_create(payload: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    validation = validate_payload("power_realm", payload)
    if not validation["valid"]:
        return {"mode": "invalid", "validation": validation}
    name = str(validation["normalized"].get("name") or "").strip()
    return propose_validated_change("power_realm", "power_realm", name, payload, reason or "LLM 提交境界资料", source, "powerSystem", name)


def propose_power_realm_update(name: str, patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    payload = {"name": name, **(patch or {})}
    return propose_validated_change("power_realm", "power_realm", name, payload, reason or "LLM 修改境界资料", source, "powerSystem", name)


def propose_power_realm_delete(name: str, reason: str = "", source: str = "llm") -> dict[str, Any]:
    patch = {"name": name}
    change = create_pending_change("power_realm_delete", name, patch, reason or "LLM 请求删除境界", source, "powerSystem", name, patch)
    return {"mode": "pending", "change": change}


def propose_map_create(payload: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    validation = validate_payload("map_image", payload)
    if not validation["valid"]:
        return {"mode": "invalid", "validation": validation}
    title = str(validation["normalized"].get("title") or "").strip()
    return propose_validated_change("map_image", "map_image", title, payload, reason or "LLM 提交地图资料", source, "maps", title)


def propose_map_update(map_id_or_name: str | int, patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    payload = {"map_id_or_name": map_id_or_name, **(patch or {})}
    if not payload.get("title") and not payload.get("地图名") and not payload.get("名称"):
        payload["title"] = str(map_id_or_name)
    return propose_validated_change("map_image", "map_image", str(map_id_or_name), payload, reason or "LLM 修改地图资料", source, "maps", str(map_id_or_name))


def propose_map_delete(map_id_or_name: str | int, reason: str = "", source: str = "llm") -> dict[str, Any]:
    patch = {"map_id_or_name": map_id_or_name}
    change = create_pending_change("map_image_delete", str(map_id_or_name), patch, reason or "LLM 请求删除地图", source, "maps", str(map_id_or_name), patch)
    return {"mode": "pending", "change": change}


def propose_map_node_update(map_id_or_name: str | int, node_name: str, patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    payload = {"map_id_or_name": map_id_or_name, "name": node_name, **(patch or {})}
    return propose_validated_change("map_node", "map_node", node_name, payload, reason or "LLM 提交地图节点", source, "maps", node_name)


def propose_map_region_update(map_id_or_name: str | int, region_name: str, patch: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    payload = {"map_id_or_name": map_id_or_name, "name": region_name, "shape": "polygon", **(patch or {})}
    return propose_validated_change("map_region", "map_region", region_name, payload, reason or "LLM 提交地图区域", source, "maps", region_name)


def propose_map_node_delete(node_name: str, reason: str = "", source: str = "llm") -> dict[str, Any]:
    patch = {"name": node_name}
    change = create_pending_change("map_node_delete", node_name, patch, reason or "LLM 请求删除地图节点/区域", source, "maps", node_name, patch)
    return {"mode": "pending", "change": change}


def propose_timeline_event_create(payload: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    validation = validate_payload("timeline_event", payload)
    if not validation["valid"]:
        return {"mode": "invalid", "validation": validation}
    title = str(validation["normalized"].get("title") or "").strip()
    return propose_validated_change("timeline_event", "timeline_event", title, payload, reason or "LLM 提交故事时间线事件", source, "timeline", title)


def propose_timeline_event_delete(event_id: int, reason: str = "", source: str = "llm") -> dict[str, Any]:
    patch = {"id": event_id}
    change = create_pending_change("timeline_event_delete", str(event_id), patch, reason or "LLM 请求删除时间线事件", source, "timeline", str(event_id), patch)
    return {"mode": "pending", "change": change}


def propose_chapter_overview_update(chapter: int, payload: dict[str, Any], reason: str = "", source: str = "llm") -> dict[str, Any]:
    merged = {"chapter": chapter, **(payload or {})}
    return propose_validated_change("chapter_overview", "chapter_overview", f"第 {chapter} 章", merged, reason or "LLM 提交章节概览", source, "chapters", f"第 {chapter} 章")


def propose_chapter_overview_delete(chapter: int, reason: str = "", source: str = "llm") -> dict[str, Any]:
    patch = {"chapter": chapter, "summary": "删除章节概览"}
    change = create_pending_change("chapter_overview_delete", f"第 {chapter} 章", patch, reason or "LLM 请求删除章节概览", source, "chapters", f"第 {chapter} 章", patch)
    return {"mode": "pending", "change": change}


def apply_world_patch(conn: Any, patch: dict[str, Any], reason: str, source: str) -> None:
    project_id = current_project_id(conn)
    before = get_world_state_from_conn(conn)
    project = get_project_from_conn(conn)
    project_updates = {}
    if "rules" in patch:
        existing_rules = project.get("rules", [])
        incoming_rules = patch["rules"] if isinstance(patch["rules"], list) else [patch["rules"]]
        project_updates["rules_json"] = dumps([*existing_rules, *incoming_rules])
    if "world_profile" in patch:
        merged_world_profile = deep_merge_dict(project.get("world_profile", {}), patch["world_profile"])
        project_updates["world_profile_json"] = dumps(normalize_world_profile(merged_world_profile))
    if "power_system" in patch:
        merged_power_system = deep_merge_dict(project.get("power_system", {}), patch["power_system"])
        project_updates["power_system_json"] = dumps(normalize_power_system(merged_power_system))
    for key in ("current_scene_goal", "current_conflict", "current_chapter"):
        if key in patch:
            project_updates[key] = patch[key]
    if project_updates:
        assignments = [f"{key} = ?" for key in project_updates]
        values = [project_updates[key] for key in project_updates]
        values.append(project_id)
        conn.execute(
            f"UPDATE projects SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )

    for node in prepare_map_nodes_for_canvas(patch.get("map_nodes", []) or []):
        prepared = map_node_storage_payload(node)
        conn.execute(
            """
            INSERT INTO map_nodes (project_id, map_image_id, layer, plane, name, type, shape, parent_name, description, faction, color, x, y, polygon_points_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, name) DO UPDATE SET
                map_image_id = excluded.map_image_id,
                layer = excluded.layer,
                plane = excluded.plane,
                type = excluded.type,
                shape = excluded.shape,
                parent_name = excluded.parent_name,
                description = excluded.description,
                faction = excluded.faction,
                color = excluded.color,
                x = excluded.x,
                y = excluded.y,
                polygon_points_json = excluded.polygon_points_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                project_id,
                prepared.get("map_image_id"),
                prepared.get("layer", ""),
                prepared.get("plane", ""),
                prepared.get("name", ""),
                prepared.get("type", "place"),
                prepared.get("shape", "point"),
                prepared.get("parent_name", ""),
                prepared.get("description", ""),
                prepared.get("faction", ""),
                prepared.get("color", ""),
                float(prepared.get("x", 0)),
                float(prepared.get("y", 0)),
                prepared.get("polygon_points_json", "[]"),
            ),
        )

    for lore in patch.get("lore_entries", []) or []:
        title = lore.get("title", "")
        if not title:
            continue
        row = conn.execute("SELECT id FROM lore_entries WHERE project_id = ? AND title = ?", (project_id, title)).fetchone()
        if row:
            conn.execute(
                """
                UPDATE lore_entries
                SET keys_json = ?, content = ?, scope = ?, priority = ?, insertion_position = ?,
                    enabled = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (
                    dumps(lore.get("keys", [])),
                    lore.get("content", ""),
                    lore.get("scope", ""),
                    int(lore.get("priority", 50)),
                    lore.get("insertion_position", "context"),
                    1 if lore.get("enabled", True) else 0,
                    row["id"],
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO lore_entries (project_id, title, keys_json, content, scope, priority, insertion_position, enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    title,
                    dumps(lore.get("keys", [])),
                    lore.get("content", ""),
                    lore.get("scope", ""),
                    int(lore.get("priority", 50)),
                    lore.get("insertion_position", "context"),
                    1 if lore.get("enabled", True) else 0,
                ),
            )

    for faction in patch.get("factions", []) or []:
        if isinstance(faction, dict):
            upsert_faction(conn, faction, project_id)

    for event in patch.get("timeline", []) or []:
        add_timeline_event(conn, event, project_id)

    after = get_world_state_from_conn(conn)
    log_history(conn, "world", "", patch, reason, source, before, after)


def list_pending_changes() -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM pending_changes WHERE project_id = ? AND status = 'pending' ORDER BY id DESC",
            (current_project_id(conn),),
        ).fetchall()
    changes = []
    for row in rows:
        change = normalize_row(row)
        meta = pending_change_payload(
            change.get("target_type", ""),
            change.get("target_name", ""),
            change.get("patch", {}),
            change.get("module_type", ""),
            change.get("target_entity", ""),
            change.get("preview") if isinstance(change.get("preview"), dict) and change.get("preview") else None,
            change.get("validation") if isinstance(change.get("validation"), dict) and change.get("validation") else None,
        )
        change.update(meta)
        changes.append(change)
    return changes


def list_change_history(limit: int = 50) -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM change_history WHERE project_id = ? ORDER BY id DESC LIMIT ?",
            (current_project_id(conn), limit),
        ).fetchall()
    return [normalize_row(row) for row in rows]


def restore_map_node(conn: Any, snapshot: dict[str, Any]) -> None:
    prepared = map_node_storage_payload(snapshot)
    conn.execute(
        """
        UPDATE map_nodes
        SET map_image_id = ?, layer = ?, plane = ?, name = ?, type = ?, shape = ?, parent_name = ?,
            description = ?, faction = ?, color = ?, x = ?, y = ?, polygon_points_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            prepared.get("map_image_id"),
            prepared.get("layer", ""),
            prepared.get("plane", ""),
            prepared.get("name", ""),
            prepared.get("type", "place"),
            prepared.get("shape", "point"),
            prepared.get("parent_name", ""),
            prepared.get("description", ""),
            prepared.get("faction", ""),
            prepared.get("color", ""),
            float(prepared.get("x", 0)),
            float(prepared.get("y", 0)),
            prepared.get("polygon_points_json", "[]"),
            snapshot["id"],
        ),
    )


def restore_lore_entry(conn: Any, snapshot: dict[str, Any]) -> None:
    conn.execute(
        """
        UPDATE lore_entries
        SET title = ?, keys_json = ?, content = ?, scope = ?, priority = ?,
            insertion_position = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            snapshot.get("title", ""),
            dumps(snapshot.get("keys", [])),
            snapshot.get("content", ""),
            snapshot.get("scope", ""),
            int(snapshot.get("priority", 50)),
            snapshot.get("insertion_position", "context"),
            1 if snapshot.get("enabled", True) else 0,
            snapshot["id"],
        ),
    )


def restore_project_blob(conn: Any, field: str, snapshot: dict[str, Any]) -> None:
    column = f"{field}_json"
    value = snapshot if isinstance(snapshot, dict) else {}
    conn.execute(
        f"UPDATE projects SET {column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (dumps(value), current_project_id(conn)),
    )


def find_map_image_id(conn: Any, map_id_or_name: Any) -> int | None:
    if map_id_or_name in (None, ""):
        return None
    project_id = current_project_id(conn)
    try:
        image_id = int(map_id_or_name)
    except (TypeError, ValueError):
        image_id = None
    if image_id is not None:
        row = conn.execute("SELECT id FROM map_images WHERE project_id = ? AND id = ?", (project_id, image_id)).fetchone()
        return int(row["id"]) if row else None
    title = str(map_id_or_name).strip()
    row = conn.execute("SELECT id FROM map_images WHERE project_id = ? AND title = ? ORDER BY id DESC LIMIT 1", (project_id, title)).fetchone()
    return int(row["id"]) if row else None


def upsert_pending_map_image(conn: Any, patch: dict[str, Any], reason: str, source: str) -> dict[str, Any]:
    project_id = current_project_id(conn)
    prepared = normalize_map_image_payload(patch)
    image_id = find_map_image_id(conn, patch.get("id", patch.get("map_id", patch.get("地图ID"))))
    if image_id is None and patch.get("title"):
        image_id = find_map_image_id(conn, patch.get("title"))
    if image_id is None and patch.get("地图名"):
        image_id = find_map_image_id(conn, patch.get("地图名"))
    before = {}
    if image_id is not None:
        row = conn.execute("SELECT * FROM map_images WHERE project_id = ? AND id = ?", (project_id, image_id)).fetchone()
        if row:
            before = normalize_row(row)
            assignments = []
            values: list[Any] = []
            for key in MAP_IMAGE_COLUMNS:
                if key in prepared and (prepared[key] not in ("", None) or key in {"image_data", "notes", "scope"}):
                    assignments.append(f"{key} = ?")
                    values.append(float(prepared[key]) if key in {"real_width", "real_height"} else str(prepared[key] or ""))
            if assignments:
                values.append(image_id)
                conn.execute(f"UPDATE map_images SET {', '.join(assignments)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
    else:
        cursor = conn.execute(
            """
            INSERT INTO map_images (
                project_id, title, layer, parent_name, scope, scale_label, real_width,
                real_height, distance_unit, scale_kind, image_data, mime_type, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                prepared["title"],
                prepared["layer"],
                prepared["parent_name"],
                prepared["scope"],
                prepared["scale_label"],
                prepared["real_width"],
                prepared["real_height"],
                prepared["distance_unit"],
                prepared["scale_kind"],
                prepared["image_data"],
                prepared["mime_type"],
                prepared["notes"],
            ),
        )
        image_id = int(cursor.lastrowid)
    after_row = conn.execute("SELECT * FROM map_images WHERE project_id = ? AND id = ?", (project_id, image_id)).fetchone()
    after = normalize_row(after_row) if after_row else {}
    log_history(conn, "map_image", prepared["title"], prepared, reason, source, before, after)
    return after


def upsert_pending_map_node(conn: Any, target_name: str, patch: dict[str, Any], reason: str, source: str, shape: str | None = None) -> dict[str, Any]:
    project_id = current_project_id(conn)
    prepared = normalize_map_node_payload({**patch, "name": patch.get("name") or target_name}, shape)
    prepared["map_image_id"] = prepared.get("map_image_id") or find_map_image_id(conn, patch.get("map_id_or_name", patch.get("地图", patch.get("地图名"))))
    if not prepared.get("name"):
        raise ValueError("Map node name is required")
    before_row = conn.execute("SELECT * FROM map_nodes WHERE project_id = ? AND name = ?", (project_id, prepared["name"])).fetchone()
    before = normalize_row(before_row) if before_row else {}
    stored = map_node_storage_payload(prepared)
    conn.execute(
        """
        INSERT INTO map_nodes (project_id, map_image_id, layer, plane, name, type, shape, parent_name, description, faction, color, x, y, polygon_points_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, name) DO UPDATE SET
            map_image_id = excluded.map_image_id,
            layer = excluded.layer,
            plane = excluded.plane,
            type = excluded.type,
            shape = excluded.shape,
            parent_name = excluded.parent_name,
            description = excluded.description,
            faction = excluded.faction,
            color = excluded.color,
            x = excluded.x,
            y = excluded.y,
            polygon_points_json = excluded.polygon_points_json,
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            project_id,
            stored.get("map_image_id"),
            stored.get("layer", ""),
            stored.get("plane", ""),
            stored.get("name", ""),
            stored.get("type", "place"),
            stored.get("shape", "point"),
            stored.get("parent_name", ""),
            stored.get("description", ""),
            stored.get("faction", ""),
            stored.get("color", ""),
            float(stored.get("x", 0)),
            float(stored.get("y", 0)),
            stored.get("polygon_points_json", "[]"),
        ),
    )
    after_row = conn.execute("SELECT * FROM map_nodes WHERE project_id = ? AND name = ?", (project_id, prepared["name"])).fetchone()
    after = normalize_row(after_row) if after_row else {}
    log_history(conn, "map_node", prepared["name"], prepared, reason, source, before, after)
    return after


def apply_power_realm_patch(conn: Any, name: str, patch: dict[str, Any], reason: str, source: str, delete: bool = False) -> dict[str, Any]:
    project_id = current_project_id(conn)
    project = get_project_from_conn(conn)
    before = normalize_power_system(project.get("power_system", {}))
    tiers = list(before.get("tiers", []))
    target_name = str(name or first_present(patch, "name", "境界", "名称", default="")).strip()
    if delete:
        tiers = [tier for tier in tiers if tier.get("name") != target_name]
    else:
        incoming = normalize_power_realm_payload({**patch, "name": target_name or patch.get("name") or patch.get("境界")})
        if not incoming.get("name"):
            raise ValueError("Power realm name is required")
        replaced = False
        tiers = [
            (deep_merge_dict(tier, incoming) if tier.get("name") == incoming["name"] else tier)
            for tier in tiers
        ]
        replaced = any(tier.get("name") == incoming["name"] for tier in before.get("tiers", []))
        if not replaced:
            tiers.append(incoming)
    after = normalize_power_system({**before, "tiers": tiers})
    conn.execute("UPDATE projects SET power_system_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (dumps(after), project_id))
    log_history(conn, "power_system", target_name, patch, reason, source, before, after)
    return after


def apply_chapter_overview_patch(conn: Any, patch: dict[str, Any], reason: str, source: str, delete: bool = False) -> dict[str, Any]:
    project_id = current_project_id(conn)
    normalized = normalize_chapter_overview_payload(patch)
    chapter = int(normalized["chapter"])
    before_row = conn.execute("SELECT * FROM chapter_summaries WHERE project_id = ? AND chapter = ?", (project_id, chapter)).fetchone()
    before = normalize_row(before_row) if before_row else {}
    if delete:
        conn.execute("DELETE FROM chapter_summaries WHERE project_id = ? AND chapter = ?", (project_id, chapter))
        after: dict[str, Any] = {}
    else:
        conn.execute(
            """
            INSERT INTO chapter_summaries (project_id, chapter, title, summary, facts_json, hooks_json)
            VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, chapter) DO UPDATE SET
                    title = excluded.title,
                    summary = excluded.summary,
                    facts_json = excluded.facts_json,
                    hooks_json = excluded.hooks_json
            """,
            (project_id, chapter, normalized["title"], normalized["summary"], dumps(normalized["facts"]), dumps(normalized["hooks"])),
        )
        after_row = conn.execute("SELECT * FROM chapter_summaries WHERE project_id = ? AND chapter = ?", (project_id, chapter)).fetchone()
        after = normalize_row(after_row) if after_row else {}
    log_history(conn, "chapter_summary", f"第 {chapter} 章", normalized, reason, source, before, after)
    return after


def validate_pending_patch(target_type: str, patch: dict[str, Any]) -> dict[str, Any]:
    kind_map = {
        "character": "character",
        "faction": "faction",
        "power_realm": "power_realm",
        "map_image": "map_image",
        "map_node": "map_node",
        "map_region": "map_region",
        "timeline_event": "timeline_event",
        "chapter_overview": "chapter_overview",
        "world_summary": "world_summary",
    }
    kind = kind_map.get(target_type)
    if not kind:
        return {"valid": True, "normalized": patch, "errors": [], "warnings": []}
    result = validate_payload(kind, patch)
    if not result["valid"]:
        raise ValueError("待审核补丁格式错误：" + "；".join(result["errors"]))
    return result


def rollback_change(history_id: int) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM change_history WHERE id = ?", (history_id,)).fetchone()
        if not row:
            raise ValueError("History entry not found")
        entry = normalize_row(row)
        before = entry.get("before", {})
        if not before:
            raise ValueError("History entry has no rollback snapshot")
        if entry["target_type"] == "character":
            upsert_character(conn, before, current_project_id(conn))
        elif entry["target_type"] == "map_node":
            restore_map_node(conn, before)
        elif entry["target_type"] == "lore_entry":
            restore_lore_entry(conn, before)
        elif entry["target_type"] == "world_profile":
            restore_project_blob(conn, "world_profile", before)
        elif entry["target_type"] == "power_system":
            restore_project_blob(conn, "power_system", before)
        else:
            raise ValueError("This history entry type cannot be rolled back automatically")
        log_history(
            conn,
            entry["target_type"],
            entry["target_name"],
            before,
            f"回滚历史记录 #{history_id}",
            "user",
            entry.get("after", {}),
            before,
        )
    return {"status": "rolled_back", "dashboard": get_dashboard()}


def approve_change(change_id: int, edited_patch: dict[str, Any] | None = None) -> dict[str, Any]:
    init_db()
    delete_project_id: int | None = None
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM pending_changes WHERE project_id = ? AND id = ? AND status = 'pending'",
            (current_project_id(conn), change_id),
        ).fetchone()
        if not row:
            raise ValueError("Pending change not found")
        change = normalize_row(row)
        patch = edited_patch if edited_patch is not None else change["patch"]
        validation = validate_pending_patch(change["target_type"], patch)
        if validation.get("normalized"):
            patch = validation["normalized"]
        if change["target_type"] == "project_delete":
            delete_project_id = int(patch.get("project_id") or 0)
        elif change["target_type"] == "character_delete":
            before_row = conn.execute(
                "SELECT * FROM characters WHERE project_id = ? AND name = ?",
                (current_project_id(conn), change["target_name"]),
            ).fetchone()
            if not before_row:
                raise ValueError("Character not found")
            before = normalize_row(before_row)
            conn.execute(
                "DELETE FROM characters WHERE project_id = ? AND name = ?",
                (current_project_id(conn), change["target_name"]),
            )
            log_history(conn, "character_delete", change["target_name"], patch, change["reason"], "approved", before, {})
        elif change["target_type"] == "faction_delete":
            before_row = conn.execute(
                "SELECT * FROM factions WHERE project_id = ? AND name = ?",
                (current_project_id(conn), change["target_name"]),
            ).fetchone()
            if not before_row:
                raise ValueError("Faction not found")
            before = normalize_row(before_row)
            conn.execute(
                "DELETE FROM factions WHERE project_id = ? AND name = ?",
                (current_project_id(conn), change["target_name"]),
            )
            log_history(conn, "faction_delete", change["target_name"], patch, change["reason"], "approved", before, {})
        elif change["target_type"] == "character":
            if not get_character(change["target_name"]):
                upsert_character(conn, {"name": change["target_name"], **patch}, current_project_id(conn))
                log_history(conn, "character", change["target_name"], patch, change["reason"], "approved")
            else:
                apply_character_patch(conn, change["target_name"], patch, change["reason"], "approved")
        elif change["target_type"] == "faction":
            apply_faction_patch(conn, change["target_name"], patch, change["reason"], "approved")
        elif change["target_type"] == "world_summary":
            apply_world_patch(conn, {"world_profile": patch}, change["reason"], "approved")
        elif change["target_type"] == "power_realm":
            apply_power_realm_patch(conn, change["target_name"], patch, change["reason"], "approved")
        elif change["target_type"] == "power_realm_delete":
            apply_power_realm_patch(conn, change["target_name"], patch, change["reason"], "approved", delete=True)
        elif change["target_type"] == "map_image":
            upsert_pending_map_image(conn, patch, change["reason"], "approved")
        elif change["target_type"] == "map_image_delete":
            image_id = find_map_image_id(conn, patch.get("map_id_or_name", patch.get("id", change["target_name"])))
            if image_id is None:
                raise ValueError("Map image not found")
            before_row = conn.execute("SELECT * FROM map_images WHERE project_id = ? AND id = ?", (current_project_id(conn), image_id)).fetchone()
            before = normalize_row(before_row) if before_row else {}
            conn.execute("DELETE FROM map_nodes WHERE project_id = ? AND map_image_id = ?", (current_project_id(conn), image_id))
            conn.execute("DELETE FROM map_images WHERE project_id = ? AND id = ?", (current_project_id(conn), image_id))
            log_history(conn, "map_image_delete", change["target_name"], patch, change["reason"], "approved", before, {})
        elif change["target_type"] == "map_node":
            upsert_pending_map_node(conn, change["target_name"], patch, change["reason"], "approved", "point")
        elif change["target_type"] == "map_region":
            upsert_pending_map_node(conn, change["target_name"], patch, change["reason"], "approved", "polygon")
        elif change["target_type"] == "map_node_delete":
            before_row = conn.execute(
                "SELECT * FROM map_nodes WHERE project_id = ? AND name = ?",
                (current_project_id(conn), change["target_name"]),
            ).fetchone()
            if not before_row:
                raise ValueError("Map node not found")
            before = normalize_row(before_row)
            conn.execute("DELETE FROM map_nodes WHERE project_id = ? AND name = ?", (current_project_id(conn), change["target_name"]))
            log_history(conn, "map_node_delete", change["target_name"], patch, change["reason"], "approved", before, {})
        elif change["target_type"] == "timeline_event":
            add_timeline_event(conn, patch, current_project_id(conn))
            log_history(conn, "timeline_event", patch.get("title", change["target_name"]), patch, change["reason"], "approved")
        elif change["target_type"] == "timeline_event_delete":
            event_id = parse_optional_int(patch.get("id"))
            if event_id is None:
                raise ValueError("Timeline event id is required")
            before_row = conn.execute("SELECT * FROM timeline_events WHERE project_id = ? AND id = ?", (current_project_id(conn), event_id)).fetchone()
            if not before_row:
                raise ValueError("Timeline event not found")
            before = normalize_row(before_row)
            conn.execute("DELETE FROM timeline_events WHERE project_id = ? AND id = ?", (current_project_id(conn), event_id))
            log_history(conn, "timeline_event_delete", before.get("title", str(event_id)), patch, change["reason"], "approved", before, {})
        elif change["target_type"] == "chapter_overview":
            apply_chapter_overview_patch(conn, patch, change["reason"], "approved")
        elif change["target_type"] == "chapter_overview_delete":
            apply_chapter_overview_patch(conn, patch, change["reason"], "approved", delete=True)
        elif change["target_type"] == "world":
            apply_world_patch(conn, patch, change["reason"], "approved")
        conn.execute(
            "UPDATE pending_changes SET status = 'approved', patch_json = ?, validation_json = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?",
            (dumps(patch), dumps(validation), change_id),
        )
    if delete_project_id:
        return {"status": "approved", "dashboard": delete_project(delete_project_id)}
    return {"status": "approved", "dashboard": get_dashboard()}


def reject_change(change_id: int) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        conn.execute(
            "UPDATE pending_changes SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP WHERE project_id = ? AND id = ?",
            (current_project_id(conn), change_id),
        )
    return {"status": "rejected", "pending_changes": list_pending_changes()}


def delete_chapter_summary_timeline_signals(conn: Any, project_id: int, chapter: int) -> int:
    rows = conn.execute(
        "SELECT id, tags_json FROM timeline_events WHERE project_id = ? AND chapter = ?",
        (project_id, chapter),
    ).fetchall()
    ids = [row["id"] for row in rows if "chapter_summary" in loads(row["tags_json"], [])]
    if ids:
        conn.executemany("DELETE FROM timeline_events WHERE project_id = ? AND id = ?", [(project_id, event_id) for event_id in ids])
    return len(ids)


def add_chapter_summary(payload: ChapterSummaryIn) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        before_row = conn.execute(
            "SELECT * FROM chapter_summaries WHERE project_id = ? AND chapter = ?",
            (project_id, payload.chapter),
        ).fetchone()
        before = normalize_row(before_row) if before_row else None
        delete_chapter_summary_timeline_signals(conn, project_id, payload.chapter)
        conn.execute(
            """
            INSERT INTO chapter_summaries (project_id, chapter, title, summary, facts_json, hooks_json)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, chapter) DO UPDATE SET
                title = excluded.title,
                summary = excluded.summary,
                facts_json = excluded.facts_json,
                hooks_json = excluded.hooks_json
            """,
            (project_id, payload.chapter, payload.title, payload.summary, dumps(payload.facts), dumps(payload.hooks)),
        )
        after_row = conn.execute(
            "SELECT * FROM chapter_summaries WHERE project_id = ? AND chapter = ?",
            (project_id, payload.chapter),
        ).fetchone()
        after = normalize_row(after_row) if after_row else None
        log_history(conn, "chapter_summary", f"第 {payload.chapter} 章", payload.model_dump(), "保存章节概览", "user", before, after)
    return {"summary": get_chapter_summary(payload.chapter), "timeline": get_timeline()}


def get_chapter_summary(chapter: int) -> dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM chapter_summaries WHERE project_id = ? AND chapter = ?",
            (current_project_id(conn), chapter),
        ).fetchone()
    return normalize_row(row) if row else None


def get_recent_summaries(limit: int = 5) -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM chapter_summaries WHERE project_id = ? ORDER BY chapter DESC LIMIT ?",
            (current_project_id(conn), limit),
        ).fetchall()
    return [normalize_row(row) for row in rows]


def list_chapter_summaries() -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM chapter_summaries WHERE project_id = ? ORDER BY chapter DESC",
            (current_project_id(conn),),
        ).fetchall()
    return [normalize_row(row) for row in rows]


def delete_chapter_summary(chapter: int) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        before_row = conn.execute("SELECT * FROM chapter_summaries WHERE project_id = ? AND chapter = ?", (project_id, chapter)).fetchone()
        before = normalize_row(before_row) if before_row else None
        removed_signals = delete_chapter_summary_timeline_signals(conn, project_id, chapter)
        cursor = conn.execute("DELETE FROM chapter_summaries WHERE project_id = ? AND chapter = ?", (project_id, chapter))
        deleted = cursor.rowcount
        log_history(
            conn,
            "chapter_summary",
            f"第 {chapter} 章",
            {"chapter": chapter, "removed_timeline_signals": removed_signals},
            "删除章节概览",
            "user",
            before,
            None,
        )
    return {"deleted": deleted, "removed_timeline_signals": removed_signals, "dashboard": get_dashboard()}


def import_full_chapter(payload: FullChapterIn) -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        conn.execute(
            """
            INSERT INTO full_chapters (project_id, chapter, title, content, source)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id, chapter) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                source = excluded.source,
                updated_at = CURRENT_TIMESTAMP
            """,
            (project_id, payload.chapter, payload.title, payload.content, payload.source),
        )
        row = conn.execute("SELECT * FROM full_chapters WHERE project_id = ? AND chapter = ?", (project_id, payload.chapter)).fetchone()
    return {"chapter": normalize_row(row), "dashboard": get_dashboard()}


def list_full_chapters() -> list[dict[str, Any]]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, project_id, chapter, title, length(content) AS content_length, source, created_at, updated_at FROM full_chapters WHERE project_id = ? ORDER BY chapter DESC",
            (current_project_id(conn),),
        ).fetchall()
    return [normalize_row(row) for row in rows]


def get_full_chapter(chapter: int) -> dict[str, Any] | None:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM full_chapters WHERE project_id = ? AND chapter = ?",
            (current_project_id(conn), chapter),
        ).fetchone()
    return normalize_row(row) if row else None


def get_context_pack(request: ContextRequest) -> dict[str, Any]:
    project = get_project()
    names = request.characters or [c["name"] for c in list_characters() if c["role"] in ("男主", "女主", "主角", "女主角")][:4]
    characters = [character for name in names if (character := get_character(name))]
    keywords = request.keywords + [request.scene_goal]
    lore: list[dict[str, Any]] = []
    for keyword in keywords:
        lore.extend(list_lore(keyword))
    deduped_lore = list({entry["id"]: entry for entry in lore}.values())[:8]
    world_state = get_world_state()
    return {
        "project": project,
        "scene_goal": request.scene_goal,
        "chapter": request.chapter or project["current_chapter"],
        "characters": characters,
        "world": world_state,
        "world_profile": world_state["world_profile"],
        "power_system": world_state["power_system"],
        "world_profile_summary": world_state["world_profile_summary"],
        "power_system_summary": world_state["power_system_summary"],
        "relevant_lore": deduped_lore,
        "timeline": get_timeline(),
        "recent_summaries": get_recent_summaries(),
        "pending_changes": list_pending_changes(),
    }


def get_dashboard() -> dict[str, Any]:
    return {
        "project": get_project(),
        "projects": list_projects(),
        "characters": list_characters(),
        "world": get_world_state(include_image_data=True),
        "timeline": get_timeline(),
        "pending_changes": list_pending_changes(),
        "history": list_change_history(25),
        "chapter_summaries": list_chapter_summaries(),
        "recent_summaries": get_recent_summaries(),
        "full_chapters": list_full_chapters(),
    }


def export_project() -> dict[str, Any]:
    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        return {
            "version": 1,
            "project": get_project_from_conn(conn),
            "characters": [normalize_row(row) for row in conn.execute("SELECT * FROM characters WHERE project_id = ? ORDER BY name", (project_id,)).fetchall()],
            "factions": [normalize_row(row) for row in conn.execute("SELECT * FROM factions WHERE project_id = ? ORDER BY type, level, name", (project_id,)).fetchall()],
            "lore_entries": [normalize_row(row) for row in conn.execute("SELECT * FROM lore_entries WHERE project_id = ? ORDER BY priority DESC, title", (project_id,)).fetchall()],
            "map_nodes": [normalize_row(row) for row in conn.execute("SELECT * FROM map_nodes WHERE project_id = ? ORDER BY type, name", (project_id,)).fetchall()],
            "map_images": [normalize_row(row) for row in conn.execute("SELECT * FROM map_images WHERE project_id = ? ORDER BY updated_at DESC, id DESC", (project_id,)).fetchall()],
            "timeline": [
                normalize_row(row)
                for row in conn.execute(
                    """
                    SELECT * FROM timeline_events
                    WHERE project_id = ?
                    ORDER BY
                        CASE WHEN sort_order = 0 AND COALESCE(chapter, 0) > 0 THEN chapter ELSE sort_order END,
                        COALESCE(chapter, 999999),
                        year_label,
                        id
                    """,
                    (project_id,),
                ).fetchall()
            ],
            "chapter_summaries": [normalize_row(row) for row in conn.execute("SELECT * FROM chapter_summaries WHERE project_id = ? ORDER BY chapter", (project_id,)).fetchall()],
            "full_chapters": [normalize_row(row) for row in conn.execute("SELECT * FROM full_chapters WHERE project_id = ? ORDER BY chapter", (project_id,)).fetchall()],
        }


def import_project(data: dict[str, Any], target_project_id: int | None = None, target_project_title: str | None = None) -> dict[str, Any]:
    project = data.get("project", {})
    routed_title = normalize_project_title(target_project_title) or normalize_project_title(project.get("title"))
    if target_project_id is not None or routed_title:
        prepare_project_context(
            target_project_id,
            routed_title,
            create_missing=True,
            genre=project.get("genre", ""),
            premise=project.get("premise", ""),
        )
    init_project(
        ProjectInit(
            title=project.get("title") or routed_title or "未命名作品",
            genre=project.get("genre", ""),
            premise=project.get("premise", ""),
            rules=project.get("rules", []),
            world_profile=project.get("world_profile", data.get("world_profile", {})),
            power_system=project.get("power_system", data.get("power_system", {})),
            characters=data.get("characters", []),
            factions=data.get("factions", []),
            lore_entries=data.get("lore_entries", []),
            map_nodes=data.get("map_nodes", []),
            timeline=data.get("timeline", []),
        )
    )
    with get_connection() as conn:
        project_id = current_project_id(conn)
        conn.execute(
            """
            UPDATE projects
            SET current_chapter = ?, current_scene_goal = ?, current_conflict = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                project.get("current_chapter", 1),
                project.get("current_scene_goal", ""),
                project.get("current_conflict", ""),
                project_id,
            ),
        )
        for summary in data.get("chapter_summaries", []) or []:
            conn.execute(
                """
                INSERT INTO chapter_summaries (project_id, chapter, title, summary, facts_json, hooks_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(project_id, chapter) DO UPDATE SET
                    title = excluded.title,
                    summary = excluded.summary,
                    facts_json = excluded.facts_json,
                    hooks_json = excluded.hooks_json
                """,
                (
                    project_id,
                    summary.get("chapter"),
                    summary.get("title", ""),
                    summary.get("summary", ""),
                    dumps(summary.get("facts", [])),
                    dumps(summary.get("hooks", [])),
                ),
            )
        for image in data.get("map_images", []) or []:
            conn.execute(
                """
                INSERT INTO map_images (
                    project_id, title, layer, parent_name, scope, scale_label, real_width,
                    real_height, distance_unit, scale_kind, image_data, mime_type, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    project_id,
                    image.get("title", "世界地图"),
                    image.get("layer", "世界"),
                    image.get("parent_name", ""),
                    image.get("scope", ""),
                    image.get("scale_label", ""),
                    float(image.get("real_width", 0) or 0),
                    float(image.get("real_height", 0) or 0),
                    image.get("distance_unit", "里"),
                    image.get("scale_kind", ""),
                    image.get("image_data", ""),
                    image.get("mime_type", "image/png"),
                    image.get("notes", ""),
                ),
            )
        for chapter in data.get("full_chapters", data.get("chapters", [])) or []:
            content = chapter.get("content", chapter.get("text", ""))
            if not content:
                continue
            conn.execute(
                """
                INSERT INTO full_chapters (project_id, chapter, title, content, source)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(project_id, chapter) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    source = excluded.source,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    project_id,
                    chapter.get("chapter"),
                    chapter.get("title", ""),
                    content,
                    chapter.get("source", "project_import"),
                ),
            )
    dashboard = get_dashboard()
    dashboard["target_project"] = dashboard["project"]
    return dashboard


def export_sillytavern_world_info() -> dict[str, Any]:
    init_db()
    entries: dict[str, Any] = {}
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM lore_entries WHERE project_id = ? ORDER BY priority DESC, title",
            (current_project_id(conn),),
        ).fetchall()
    for row in rows:
        lore = normalize_row(row)
        uid = str(lore["id"])
        entries[uid] = {
            "uid": lore["id"],
            "key": lore.get("keys", []),
            "keysecondary": [],
            "comment": lore.get("title", ""),
            "content": lore.get("content", ""),
            "constant": False,
            "selective": False,
            "selectiveLogic": 0,
            "order": lore.get("priority", 50),
            "position": 0,
            "disable": not bool(lore.get("enabled", 1)),
            "extensions": {
                "novel_cockpit": {
                    "scope": lore.get("scope", ""),
                    "insertion_position": lore.get("insertion_position", "context"),
                }
            },
        }
    return {"entries": entries}


def import_sillytavern_world_info(data: dict[str, Any]) -> dict[str, Any]:
    raw_entries = data.get("entries", {})
    entries = raw_entries.values() if isinstance(raw_entries, dict) else raw_entries
    with get_connection() as conn:
        project_id = current_project_id(conn)
        for entry in entries:
            title = entry.get("comment") or entry.get("displayIndex") or (entry.get("key") or ["未命名词条"])[0]
            keys = entry.get("key", [])
            if isinstance(keys, str):
                keys = [keys]
            extensions = entry.get("extensions", {}).get("novel_cockpit", {})
            lore = {
                "title": str(title),
                "keys": keys,
                "content": entry.get("content", ""),
                "scope": extensions.get("scope", ""),
                "priority": int(entry.get("order", 50)),
                "insertion_position": extensions.get("insertion_position", "context"),
                "enabled": not bool(entry.get("disable", False)),
            }
            row = conn.execute("SELECT id FROM lore_entries WHERE project_id = ? AND title = ?", (project_id, lore["title"])).fetchone()
            if row:
                before_row = conn.execute("SELECT * FROM lore_entries WHERE id = ?", (row["id"],)).fetchone()
                conn.execute(
                    """
                    UPDATE lore_entries
                    SET keys_json = ?, content = ?, scope = ?, priority = ?, insertion_position = ?,
                        enabled = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        dumps(lore["keys"]),
                        lore["content"],
                        lore["scope"],
                        lore["priority"],
                        lore["insertion_position"],
                        1 if lore["enabled"] else 0,
                        row["id"],
                    ),
                )
                after_row = conn.execute("SELECT * FROM lore_entries WHERE id = ?", (row["id"],)).fetchone()
                log_history(
                    conn,
                    "lore_entry",
                    lore["title"],
                    lore,
                    "导入 SillyTavern World Info",
                    "user",
                    normalize_row(before_row),
                    normalize_row(after_row),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO lore_entries (project_id, title, keys_json, content, scope, priority, insertion_position, enabled)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        project_id,
                        lore["title"],
                        dumps(lore["keys"]),
                        lore["content"],
                        lore["scope"],
                        lore["priority"],
                        lore["insertion_position"],
                        1 if lore["enabled"] else 0,
                    ),
                )
                log_history(conn, "lore_entry", lore["title"], lore, "导入 SillyTavern World Info", "user", {}, lore)
    return get_dashboard()


def export_sillytavern_character_card(name: str) -> dict[str, Any]:
    character = get_character(name)
    if not character:
        raise ValueError("Character not found")
    public_facts = character.get("public_facts", []) or []
    locked_facts = character.get("locked_facts", []) or []
    description_lines = []
    if character.get("identity"):
        description_lines.append(f"身份：{character['identity']}")
    if character.get("role"):
        description_lines.append(f"角色身份：{character['role']}")
    if character.get("realm"):
        description_lines.append(f"当前境界：{character['realm']}")
    if character.get("faction"):
        description_lines.append(f"阵营：{character['faction']}")
    description_lines.extend(public_facts)
    description = "\n".join(line for line in description_lines if line)
    if locked_facts:
        description = f"{description}\n禁改事实：{'；'.join(locked_facts)}".strip()
    return {
        "spec": "chara_card_v2",
        "spec_version": "2.0",
        "data": {
            "name": character["name"],
            "description": description,
            "personality": character.get("personality", character.get("emotional_state", "")),
            "scenario": character.get("relationship_notes", ""),
            "first_mes": "",
            "mes_example": "",
            "creator_notes": "Exported from Novel Cockpit.",
            "system_prompt": "",
            "post_history_instructions": "",
            "tags": [tag for tag in (character.get("role", ""), character.get("faction", ""), character.get("realm", "")) if tag],
            "extensions": {
                "novel_cockpit": {
                    "aliases": character.get("aliases", []),
                    "role": character.get("role", ""),
                    "gender": character.get("gender", ""),
                    "personality": character.get("personality", ""),
                    "realm": character.get("realm", ""),
                    "identity": character.get("identity", ""),
                    "age": character.get("age", ""),
                    "status": character.get("status", ""),
                    "location": character.get("location", ""),
                    "emotional_state": character.get("emotional_state", ""),
                    "physical_state": character.get("physical_state", ""),
                    "faction": character.get("faction", ""),
                    "bloodline": character.get("bloodline", ""),
                    "abilities": character.get("abilities", []),
                    "equipment": character.get("equipment", []),
                    "relationship_notes": character.get("relationship_notes", ""),
                    "public_facts": character.get("public_facts", []),
                    "private_facts": character.get("private_facts", []),
                    "locked_facts": character.get("locked_facts", []),
                    "state_variables": character.get("state_variables", {}),
                }
            },
        },
    }


def import_sillytavern_character_card(
    data: dict[str, Any],
    target_project_id: int | None = None,
    target_project_title: str | None = None,
) -> dict[str, Any]:
    card = data.get("card", data)
    card = card.get("data", card)
    name = str(card.get("name", "")).strip()
    if not name:
        raise ValueError("Character card name is required")
    extension = card.get("extensions", {}).get("novel_cockpit", {})
    routed_title = normalize_project_title(target_project_title) or normalize_project_title(extension.get("project_title"))
    if target_project_id is not None or routed_title:
        prepare_project_context(target_project_id, routed_title, create_missing=True)
    existing = get_character(name) or {}

    def list_value(field: str) -> list[Any]:
        value = extension.get(field, existing.get(field, []))
        if value in (None, ""):
            return []
        return value if isinstance(value, list) else [value]

    public_facts = list_value("public_facts")
    for text_field in ("description", "personality", "scenario"):
        value = str(card.get(text_field, "")).strip()
        if value and value not in public_facts:
            public_facts.append(value)

    character = {
        "name": name,
        "aliases": list_value("aliases"),
        "role": extension.get("role", existing.get("role", "")),
        "gender": extension.get("gender", existing.get("gender", "")),
        "personality": extension.get("personality", card.get("personality", existing.get("personality", ""))),
        "realm": extension.get("realm", existing.get("realm", "")),
        "identity": extension.get("identity", existing.get("identity", "")),
        "age": str(extension.get("age", existing.get("age", ""))),
        "status": extension.get("status", existing.get("status", "存活")),
        "location": extension.get("location", existing.get("location", "")),
        "emotional_state": extension.get("emotional_state", existing.get("emotional_state", "")),
        "physical_state": extension.get("physical_state", existing.get("physical_state", "")),
        "faction": extension.get("faction", existing.get("faction", "")),
        "bloodline": extension.get("bloodline", existing.get("bloodline", "")),
        "abilities": list_value("abilities"),
        "equipment": list_value("equipment"),
        "relationship_notes": extension.get("relationship_notes", existing.get("relationship_notes", "")),
        "public_facts": public_facts,
        "private_facts": list_value("private_facts"),
        "locked_facts": list_value("locked_facts"),
        "state_variables": extension.get(
            "state_variables",
            extension.get("variables", existing.get("state_variables", {})),
        ),
    }

    init_db()
    with get_connection() as conn:
        project_id = current_project_id(conn)
        before_row = conn.execute(
            "SELECT * FROM characters WHERE project_id = ? AND name = ?",
            (project_id, name),
        ).fetchone()
        upsert_character(conn, character, project_id)
        after_row = conn.execute(
            "SELECT * FROM characters WHERE project_id = ? AND name = ?",
            (project_id, name),
        ).fetchone()
        log_history(
            conn,
            "character",
            name,
            character,
            "导入 SillyTavern Character Card",
            "user",
            normalize_row(before_row) if before_row else {},
            normalize_row(after_row),
        )
    return {"character": get_character(name), "dashboard": get_dashboard(), "target_project": get_project()}
