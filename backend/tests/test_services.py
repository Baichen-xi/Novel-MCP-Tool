import os
import tempfile

os.environ["NOVEL_COCKPIT_DB"] = os.path.join(tempfile.mkdtemp(prefix="novel-cockpit-"), "test.db")

from app.db import get_connection, init_db
from app.schemas import ChapterSummaryIn, ContextRequest, FactionIn, FullChapterIn, MapImageIn, MapNodeCreate, ProjectInit
from app.services import (
    add_chapter_summary,
    approve_change,
    create_map_node,
    create_faction,
    create_project,
    delete_character,
    delete_chapter_summary,
    delete_project,
    delete_map_image,
    delete_map_node,
    delete_faction,
    export_project,
    export_sillytavern_character_card,
    export_sillytavern_world_info,
    get_character,
    get_context_pack,
    get_full_chapter,
    get_faction,
    get_schema,
    list_factions,
    get_power_system,
    get_world_profile,
    init_project,
    import_full_chapter,
    import_project,
    import_sillytavern_character_card,
    import_sillytavern_world_info,
    list_change_history,
    list_chapter_summaries,
    list_full_chapters,
    list_pending_changes,
    propose_delete_character,
    propose_delete_project,
    propose_delete_faction,
    propose_faction_update,
    propose_chapter_overview_update,
    propose_map_node_update,
    switch_project,
    propose_character_update,
    propose_character_create,
    propose_power_system_update,
    propose_timeline_event_create,
    propose_world_update,
    propose_world_profile_update,
    rollback_change,
    save_map_image,
    update_character_direct,
    update_lore_entry_direct,
    update_map_image_direct,
    update_map_node_direct,
    update_project,
    update_power_system_direct,
    update_world_profile_direct,
    validate_payload,
    world_entries_to_patch,
)


def setup_function():
    init_db()
    with get_connection() as conn:
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
            conn.execute(f"DELETE FROM {table}")
        conn.execute(
            """
            UPDATE projects
            SET title = '未命名作品',
                genre = '',
                premise = '',
                current_chapter = 1,
                current_scene_goal = '',
                current_conflict = '',
                rules_json = '[]',
                world_profile_json = '{}',
                power_system_json = '{}',
                is_active = 1
            WHERE id = 1
            """
        )
        conn.execute("DELETE FROM projects WHERE id != 1")


def test_init_and_context_pack():
    init_project(
        ProjectInit(
            title="青霜纪",
            genre="玄幻",
            world_profile={"summary": "灵气与宗门并存的世界", "world_type": "玄幻", "core_rules": ["灵气可修炼"]},
            power_system={"summary": "九层修炼体系", "system_name": "修炼境界", "tiers": [{"name": "炼气", "description": "打基础"}, {"name": "筑基", "description": "凝聚道基"}]},
            factions=[{"name": "天元宗", "type": "宗门", "leader": "陆玄", "summary": "东洲第一宗门"}],
            characters=[
                {"name": "林夜", "role": "男主", "age": "18", "location": "天元宗"},
                {"name": "苏璃", "role": "女主", "age": "19", "location": "天元宗"},
            ],
            lore_entries=[{"title": "天元宗", "keys": ["天元宗"], "content": "东洲第一宗门"}],
            map_nodes=[{"name": "天元宗", "type": "宗门", "x": 35, "y": 40}],
        )
    )
    pack = get_context_pack(ContextRequest(scene_goal="林夜在天元宗寻找苏璃", keywords=["天元宗"]))
    assert pack["project"]["title"] == "青霜纪"
    assert len(pack["characters"]) == 2
    assert pack["relevant_lore"][0]["title"] == "天元宗"
    assert pack["world_profile"]["world_type"] == "玄幻"
    assert "灵气" in pack["world_profile_summary"]
    assert pack["power_system"]["tiers"][0]["name"] == "炼气"
    assert "炼气" in pack["power_system_summary"]
    assert pack["world"]["factions"][0]["name"] == "天元宗"


def test_init_project_accepts_llm_chinese_field_names():
    dashboard = init_project(
        ProjectInit.model_validate(
            {
                "作品": {
                    "标题": "万界淫尊",
                    "类型": "玄幻重肉",
                    "当前章节": "第1章（待撰写）",
                    "世界观": {"summary": "万界交汇，诸天并立"},
                    "境界": {"summary": "凡俗到至高的通用阶位", "tiers": [{"name": "凡人"}, {"name": "超凡"}]},
                },
                "角色": [
                    {
                        "姓名": "林玄",
                        "角色身份": "男主",
                        "身份": "宗门圣子",
                        "性格": "冷静",
                        "当前境界": "筑基中期",
                        "存活状态": "存活",
                    },
                    {
                        "姓名": "苏清寒",
                        "角色身份": "女主",
                        "身份": "天机阁传人",
                        "性格": "克制",
                        "当前境界": "金丹初期",
                    },
                ],
                "世界书": "万界：诸天世界交汇。",
                "势力划分": [{"名称": "太一宗", "类型": "宗门", "领袖": "太一真人"}],
                "地图": "- 三千道域总图（同心圆结构） 已建立",
                "时间线": "- 第1章：林玄登场",
            }
        )
    )

    assert dashboard["project"]["title"] == "万界淫尊"
    assert dashboard["project"]["genre"] == "玄幻重肉"
    assert dashboard["project"]["current_chapter"] == 1
    assert dashboard["characters"][0]["name"] == "林玄"
    assert dashboard["characters"][0]["role"] == "男主"
    assert dashboard["characters"][0]["identity"] == "宗门圣子"
    assert dashboard["characters"][0]["personality"] == "冷静"
    assert dashboard["characters"][0]["realm"] == "筑基中期"
    assert dashboard["characters"][0]["status"] == "存活"
    assert dashboard["project"]["world_profile"]["summary"] == "万界交汇，诸天并立"
    assert dashboard["project"]["power_system"]["tiers"][0]["name"] == "凡人"
    assert dashboard["world"]["factions"][0]["name"] == "太一宗"


def test_world_profile_and_power_system_roundtrip_via_pending_updates():
    init_project(ProjectInit(title="设定项目"))
    profile_pending = propose_world_profile_update({"summary": "都市异能世界", "world_type": "都市"}, "补充世界观")
    system_pending = propose_power_system_update({"summary": "觉醒体系", "tiers": [{"name": "觉醒者", "description": "获得异能"}]}, "补充力量体系")

    assert profile_pending["mode"] == "pending"
    assert system_pending["mode"] == "pending"

    approve_change(profile_pending["change"]["id"])
    approve_change(system_pending["change"]["id"])

    world_profile = get_world_profile()
    power_system = get_power_system()
    assert world_profile["world_type"] == "都市"
    assert power_system["tiers"][0]["name"] == "觉醒者"
    pack = get_context_pack(ContextRequest(scene_goal="查看设定"))
    assert "都市" in pack["world_profile_summary"]
    assert "觉醒者" in pack["power_system_summary"]


def test_export_import_preserves_world_profile_and_power_system():
    init_project(
        ProjectInit(
            title="导出项目",
            world_profile={"summary": "万界并行", "main_stage": "中州"},
            power_system={"summary": "修炼体系", "tiers": [{"name": "炼气", "order": 1}]},
        )
    )
    exported = export_project()
    init_project(ProjectInit(title="空项目"))
    imported = import_project(exported)

    assert imported["project"]["world_profile"]["main_stage"] == "中州"
    assert imported["project"]["power_system"]["tiers"][0]["name"] == "炼气"


def test_direct_world_profile_and_power_system_updates_roundtrip():
    init_project(
        ProjectInit(
            title="直改项目",
            world_profile={"summary": "旧世界观", "world_type": "玄幻"},
            power_system={"summary": "旧境界", "tiers": [{"name": "炼气"}]},
        )
    )
    profile_result = update_world_profile_direct({"summary": "废土城市", "world_type": "末日"}, "作者修正世界观")
    system_result = update_power_system_direct({"summary": "异能阶位", "tiers": [{"name": "觉醒者"}]}, "作者修正境界")

    assert profile_result["world_profile"]["world_type"] == "末日"
    assert system_result["power_system"]["tiers"][0]["name"] == "觉醒者"

    history = list_change_history()
    assert any(item["target_type"] == "world_profile" for item in history)
    assert any(item["target_type"] == "power_system" for item in history)

    rollback_change(history[0]["id"])


def test_character_list_fields_are_normalized_from_string_payloads():
    init_project(
        ProjectInit(
            title="列表归一化",
            characters=[
                {
                    "name": "林天衍",
                    "role": "主角",
                    "identity": "林家少主",
                    "personality": "冷静",
                    "realm": "金丹后期",
                    "bloodline": "龙族血脉",
                    "abilities": "吞天圣体完整版，实力碾压九域",
                    "equipment": "神秘戒指",
                    "locked_facts": "穿越者身份暂时保密",
                }
            ],
        )
    )
    character = get_character("林天衍")
    assert character["abilities"] == ["吞天圣体完整版", "实力碾压九域"]
    assert character["equipment"] == ["神秘戒指"]
    assert character["locked_facts"] == ["穿越者身份暂时保密"]
    assert character["identity"] == "林家少主"
    assert character["personality"] == "冷静"
    assert character["realm"] == "金丹后期"
    assert character["bloodline"] == "龙族血脉"


def test_safe_character_update_goes_pending_for_core_fields():
    init_project(ProjectInit(characters=[{"name": "林夜", "role": "男主", "age": "18"}]))
    result = propose_character_update("林夜", {"status": "dead"}, "剧情冲突")
    assert result["mode"] == "pending"
    assert get_character("林夜")["status"] == "存活"
    assert len(list_pending_changes()) == 1


def test_llm_character_update_goes_pending_even_for_light_fields():
    init_project(ProjectInit(characters=[{"name": "林夜", "role": "男主", "location": "酒馆"}]))
    result = propose_character_update("林夜", {"location": "黑市", "emotional_state": "紧张"}, "场景移动")
    assert result["mode"] == "pending"
    assert result["change"]["module_type"] == "characters"
    character = get_character("林夜")
    assert character["location"] == "酒馆"
    approve_change(result["change"]["id"])
    character = get_character("林夜")
    assert character["location"] == "黑市"
    assert character["emotional_state"] == "紧张"


def test_schema_and_validation_reject_bad_payload_without_pending_change():
    init_project(ProjectInit(title="校验项目"))
    schema = get_schema("map_node")
    assert schema["valid_kind"] is True
    assert "x" in schema["schema"]["必填"]

    invalid = propose_map_node_update("东玄道域", "黑水城", {"说明": "缺少坐标"}, "坐标缺失")
    assert invalid["mode"] == "invalid"
    assert "x" in "；".join(invalid["validation"]["errors"])
    assert list_pending_changes() == []

    direct_validation = validate_payload("timeline_event", {"事件标题": "旧事重提", "事件说明": "缺少时间和排序"})
    assert direct_validation["valid"] is False
    assert any("故事时间" in item for item in direct_validation["errors"])


def test_dedicated_proposals_preview_and_approve_into_right_tables():
    init_project(ProjectInit(title="专用工具项目"))
    character = propose_character_create({"姓名": "苏璃", "角色身份": "女主", "性格": "清冷"}, "新增人物")
    assert character["mode"] == "pending"
    assert character["change"]["module_type"] == "characters"
    assert character["change"]["preview"]["name"] == "苏璃"
    approve_change(character["change"]["id"])
    assert get_character("苏璃")["personality"] == "清冷"

    chapter = propose_chapter_overview_update(3, {"标题": "秘境开启", "摘要": "龙渊秘境开启。", "事实": ["秘境入口出现"]}, "章节概览")
    assert chapter["change"]["module_type"] == "chapters"
    approve_change(chapter["change"]["id"])
    assert list_chapter_summaries()[0]["chapter"] == 3

    timeline = propose_timeline_event_create(
        {"事件标题": "龙渊秘境开启", "故事时间": "新星纪元 1032 年 夏", "排序值": 1032.6, "事件说明": "各宗弟子进入秘境。"},
        "时间线",
    )
    assert timeline["change"]["module_type"] == "timeline"
    approve_change(timeline["change"]["id"])
    assert get_context_pack(ContextRequest(scene_goal="检查时间线"))["timeline"][0]["title"] == "龙渊秘境开启"


def test_approve_pending_change_updates_character():
    init_project(ProjectInit(characters=[{"name": "苏璃", "role": "女主", "age": "19"}]))
    change = propose_character_update("苏璃", {"age": "20"}, "时间跳跃")["change"]
    approve_change(change["id"])
    assert get_character("苏璃")["age"] == "20"


def test_direct_character_update_can_fix_core_fields():
    init_project(ProjectInit(characters=[{"name": "林夜", "role": "男主", "age": "18", "status": "存活"}]))
    result = update_character_direct("林夜", {"age": "19", "status": "死亡", "realm": "元婴初期"}, "作者修正设定")
    assert result["mode"] == "applied"
    assert list_pending_changes() == []
    character = get_character("林夜")
    assert character["age"] == "19"
    assert character["status"] == "死亡"
    assert character["realm"] == "元婴初期"


def test_character_change_history_can_rollback():
    init_project(ProjectInit(characters=[{"name": "林夜", "role": "男主", "age": "18", "status": "存活"}]))
    update_character_direct("林夜", {"age": "19", "status": "死亡"}, "误改测试")
    history = list_change_history()
    assert history[0]["target_type"] == "character"
    assert history[0]["before"]["age"] == "18"
    rollback_change(history[0]["id"])
    character = get_character("林夜")
    assert character["age"] == "18"
    assert character["status"] == "存活"


def test_direct_map_node_update_changes_world_state():
    dashboard = init_project(ProjectInit(map_nodes=[{"name": "天元宗", "type": "宗门", "x": 20, "y": 30}]))
    node_id = dashboard["world"]["map_nodes"][0]["id"]
    result = update_map_node_direct(node_id, {"name": "天元剑宗", "x": 45, "description": "东洲剑修祖庭", "color": "120,146,185"})
    assert result["mode"] == "applied"
    assert result["map_node"]["name"] == "天元剑宗"
    assert result["map_node"]["x"] == 45
    assert result["map_node"]["description"] == "东洲剑修祖庭"
    assert result["map_node"]["color"] == "120,146,185"


def test_delete_map_node_removes_only_target_node():
    dashboard = init_project(
        ProjectInit(
            map_nodes=[
                {"name": "天元宗", "type": "宗门", "x": 20, "y": 30},
                {"name": "黑水城", "type": "城市", "x": 62, "y": 44},
            ]
        )
    )
    node_id = next(node["id"] for node in dashboard["world"]["map_nodes"] if node["name"] == "天元宗")
    result = delete_map_node(node_id)
    names = [node["name"] for node in result["dashboard"]["world"]["map_nodes"]]
    assert "天元宗" not in names
    assert "黑水城" in names


def test_map_image_and_annotations_are_visible_but_llm_gets_structured_nodes():
    init_project(ProjectInit(title="地图项目"))
    image = save_map_image(
        MapImageIn(
            title="三千道域总图",
            layer="三千道域",
            parent_name="大千世界",
            scope="道域总览",
            scale_label="1 格 = 10 万里",
            real_width=3000,
            real_height=1800,
            distance_unit="万里",
            scale_kind="宏观",
            image_data="data:image/png;base64,AAAA",
            mime_type="image/png",
            notes="同心圆结构",
        )
    )["map_image"]
    created = create_map_node(
        MapNodeCreate(
            name="外环道域",
            type="道域",
            map_image_id=image["id"],
            layer="三千道域",
            plane="大千世界",
            x=72,
            y=41,
            description="外层区域",
        )
    )
    update_map_node_direct(created["map_node"]["id"], {"x": 64, "y": 38})

    world = get_context_pack(ContextRequest(scene_goal="确认外环道域路线", keywords=["外环道域"]))["world"]
    assert world["map_images"][0]["title"] == "三千道域总图"
    assert world["map_images"][0]["layer"] == "三千道域"
    assert world["map_images"][0]["parent_name"] == "大千世界"
    assert world["map_images"][0]["scale_label"] == "1 格 = 10 万里"
    assert world["map_images"][0]["real_width"] == 3000
    assert world["map_images"][0]["distance_unit"] == "万里"
    assert world["map_images"][0]["scale_kind"] == "宏观"
    assert "image_data" not in world["map_images"][0]
    assert save_map_image(MapImageIn(title="临时图", image_data="data:image/png;base64,BBBB"))["dashboard"]["world"]["map_images"][0]["image_data"].startswith("data:image")
    assert any(
        node["name"] == "外环道域"
        and node["x"] == 64
        and node["map_image_id"] == image["id"]
        and node["layer"] == "三千道域"
        and node["plane"] == "大千世界"
        for node in world["map_nodes"]
    )
    delete_map_image()
    assert get_context_pack(ContextRequest(scene_goal="地图检查"))["world"]["map_images"] == []


def test_map_image_scale_metadata_survives_project_export_import():
    init_project(ProjectInit(title="尺度项目"))
    save_map_image(
        MapImageIn(
            title="天元宗局部图",
            layer="宗门",
            parent_name="东玄道域",
            scope="宗门局部",
            scale_label="1 格 = 30 里",
            real_width=300,
            real_height=180,
            distance_unit="里",
            scale_kind="宗门",
            image_data="data:image/png;base64,CCCC",
        )
    )
    exported = export_project()
    assert exported["map_images"][0]["scale_label"] == "1 格 = 30 里"

    imported = import_project(exported)
    image = imported["world"]["map_images"][0]
    assert image["title"] == "天元宗局部图"
    assert image["scale_label"] == "1 格 = 30 里"
    assert image["real_width"] == 300
    assert image["scale_kind"] == "宗门"


def test_delete_map_image_removes_bound_nodes_but_keeps_other_maps():
    init_project(ProjectInit(title="地图删除项目"))
    first = save_map_image(MapImageIn(title="东玄道域", image_data="data:image/png;base64,AAAA"))["map_image"]
    second = save_map_image(MapImageIn(title="北境雪原", image_data="data:image/png;base64,BBBB"))["map_image"]
    create_map_node(MapNodeCreate(name="天元宗", type="宗门", map_image_id=first["id"], x=30, y=40))
    create_map_node(MapNodeCreate(name="黑水城", type="城市", map_image_id=first["id"], x=55, y=52))
    create_map_node(MapNodeCreate(name="雪原营地", type="据点", map_image_id=second["id"], x=22, y=18))
    create_map_node(MapNodeCreate(name="未绑定资料", type="地点", x=80, y=20))

    dashboard = delete_map_image(first["id"])
    remaining_images = {image["title"] for image in dashboard["world"]["map_images"]}
    remaining_nodes = {node["name"] for node in dashboard["world"]["map_nodes"]}

    assert remaining_images == {"北境雪原"}
    assert "天元宗" not in remaining_nodes
    assert "黑水城" not in remaining_nodes
    assert "雪原营地" in remaining_nodes
    assert "未绑定资料" in remaining_nodes


def test_clearing_map_image_keeps_map_and_bound_nodes():
    init_project(ProjectInit(title="地图清图项目"))
    image = save_map_image(
        MapImageIn(
            title="四域总览",
            layer="世界",
            real_width=1200,
            real_height=750,
            distance_unit="万里",
            image_data="data:image/png;base64,AAAA",
        )
    )["map_image"]
    create_map_node(MapNodeCreate(name="青岚洲", type="区域", shape="polygon", map_image_id=image["id"], x=22, y=32))

    dashboard = update_map_image_direct(image["id"], {"image_data": "data:image/png;base64,EMPTY", "mime_type": "image/png"})
    images = dashboard["dashboard"]["world"]["map_images"]
    nodes = dashboard["dashboard"]["world"]["map_nodes"]

    assert any(item["id"] == image["id"] and item["title"] == "四域总览" for item in images)
    assert any(node["name"] == "青岚洲" and node["map_image_id"] == image["id"] for node in nodes)
    assert next(item for item in images if item["id"] == image["id"])["image_data"] == "data:image/png;base64,EMPTY"


def test_approving_world_change_with_null_parent_name_maps_nodes_successfully():
    init_project(ProjectInit(title="审批修复"))
    change = propose_world_update(
        {
            "map_nodes": [
                {
                    "name": "主位面",
                    "type": "region",
                    "shape": "point",
                    "layer": "主位面",
                    "plane": "主位面",
                    "parent_name": None,
                    "description": "核心大陆",
                    "faction": "林氏圣族",
                    "x": 50,
                    "y": 50,
                }
            ]
        },
        "审批测试",
    )["change"]
    result = approve_change(change["id"])
    assert result["status"] == "approved"
    assert any(node["name"] == "主位面" and node["parent_name"] == "" for node in result["dashboard"]["world"]["map_nodes"])


def test_map_node_color_survives_project_init_world_update_and_export():
    dashboard = init_project(
        ProjectInit(
            title="区域颜色项目",
            map_nodes=[
                {
                    "name": "青岚洲",
                    "type": "区域",
                    "shape": "polygon",
                    "faction": "青岚盟",
                    "color": "120,146,185",
                    "polygon_points": [{"x": 8, "y": 22}, {"x": 32, "y": 12}, {"x": 36, "y": 40}],
                }
            ],
        )
    )
    first_node = dashboard["world"]["map_nodes"][0]
    assert first_node["color"] == "120,146,185"
    assert first_node["shape"] == "polygon"

    change = propose_world_update(
        {
            "map_nodes": [
                {
                    "name": "赤霄岭",
                    "type": "区域",
                    "shape": "polygon",
                    "color": "180,80,60",
                    "polygon_points": [{"x": 40, "y": 42}, {"x": 58, "y": 38}, {"x": 62, "y": 55}],
                }
            ]
        },
        "补充区域颜色",
    )["change"]
    approve_change(change["id"])

    nodes = {node["name"]: node for node in export_project()["map_nodes"]}
    assert nodes["青岚洲"]["color"] == "120,146,185"
    assert nodes["赤霄岭"]["color"] == "180,80,60"


def test_direct_lore_entry_update_changes_context_pack():
    dashboard = init_project(
        ProjectInit(lore_entries=[{"title": "龙渊秘境", "keys": ["龙渊"], "content": "每十年开启一次"}])
    )
    entry_id = dashboard["world"]["lore_entries"][0]["id"]
    update_lore_entry_direct(entry_id, {"keys": ["龙渊秘境", "龙魂"], "content": "元婴以上无法进入", "priority": 95})
    pack = get_context_pack(ContextRequest(scene_goal="调查龙魂", keywords=["龙魂"]))
    assert pack["relevant_lore"][0]["title"] == "龙渊秘境"
    assert pack["relevant_lore"][0]["content"] == "元婴以上无法进入"
    assert pack["relevant_lore"][0]["priority"] == 95


def test_approved_world_change_applies_map_lore_timeline_and_rules():
    init_project(ProjectInit(title="青霜纪", rules=["旧规则"]))
    pending = propose_world_update(
        {
            "rules": ["新规则"],
            "map_nodes": [{"name": "黑水城", "type": "城市", "description": "边境商贸城", "x": 66, "y": 25}],
            "lore_entries": [{"title": "黑水城", "keys": ["黑水城"], "content": "边境情报汇集之处", "priority": 70}],
            "timeline": [{"chapter": 5, "event": "林夜抵达黑水城", "location": "黑水城"}],
        },
        "构思助手补充世界设定",
    )["change"]
    approve_change(pending["id"])
    pack = get_context_pack(ContextRequest(scene_goal="黑水城交易", keywords=["黑水城"]))
    assert "新规则" in pack["project"]["rules"]
    assert any(node["name"] == "黑水城" for node in pack["world"]["map_nodes"])
    assert pack["relevant_lore"][0]["title"] == "黑水城"
    assert any(event["event"] == "林夜抵达黑水城" for event in pack["timeline"])


def test_timeline_events_preserve_story_chronology_fields():
    init_project(
        ProjectInit(
            title="时间树项目",
            timeline=[
                {
                    "era": "新星纪元",
                    "year_label": "新星纪元 1032 年 春",
                    "time_note": "天元宗收徒日，午后",
                    "sort_order": 1032.2,
                    "side": "right",
                    "event_type": "正序事件",
                    "title": "林玄登上问心阶",
                    "summary": "林玄在问心阶停步。",
                    "narrative": "第 1 章正序讲述",
                    "chapter": 1,
                    "location": "天元宗山门",
                    "involved_characters": ["林玄", "苏璃"],
                    "factions": ["天元宗"],
                    "consequences": "林玄获得入门资格。",
                    "hooks": ["问心阶异象"],
                },
                {
                    "era": "前星纪",
                    "year": "前星纪末年",
                    "timeNote": "距主线约一千年",
                    "sort": -1000,
                    "side": "left",
                    "type": "前史",
                    "title": "龙门沉入虚空海",
                    "summary": "上古龙门沉入虚空海。",
                    "characters": ["龙门守将"],
                    "factions": ["古龙族"],
                    "hooks": ["虚空海龙门"],
                },
            ],
        )
    )

    timeline = get_context_pack(ContextRequest(scene_goal="检查时间树"))["timeline"]
    assert timeline[0]["title"] == "龙门沉入虚空海"
    assert timeline[0]["year_label"] == "前星纪末年"
    assert timeline[0]["time_note"] == "距主线约一千年"
    assert timeline[0]["event_type"] == "前史"
    assert timeline[0]["involved_characters"] == ["龙门守将"]
    assert timeline[0]["factions"] == ["古龙族"]
    assert timeline[0]["hooks"] == ["虚空海龙门"]
    assert timeline[1]["title"] == "林玄登上问心阶"
    assert timeline[1]["side"] == "right"

    exported = export_project()
    init_project(ProjectInit(title="空项目"))
    imported = import_project(exported)
    assert imported["timeline"][0]["title"] == "龙门沉入虚空海"
    assert imported["timeline"][1]["year_label"] == "新星纪元 1032 年 春"


def test_add_chapter_summary_does_not_create_timeline_event():
    init_project(ProjectInit(title="青霜纪"))
    result = add_chapter_summary(
        ChapterSummaryIn(chapter=3, summary="林夜得到玉佩。", facts=["玉佩会发光"], hooks=["玉佩来历"])
    )
    assert result["summary"]["chapter"] == 3
    assert result["timeline"] == []
    summaries = list_chapter_summaries()
    assert summaries[0]["facts"] == ["玉佩会发光"]
    assert summaries[0]["hooks"] == ["玉佩来历"]


def test_chapter_summary_update_keeps_timeline_empty():
    init_project(ProjectInit(title="章节编辑项目"))
    add_chapter_summary(ChapterSummaryIn(chapter=2, title="旧标题", summary="旧摘要", hooks=["旧伏笔"]))
    result = add_chapter_summary(ChapterSummaryIn(chapter=2, title="新标题", summary="新摘要", hooks=["新伏笔"]))

    assert result["summary"]["title"] == "新标题"
    assert result["timeline"] == []


def test_delete_chapter_summary_removes_only_auto_summary_signal():
    init_project(ProjectInit(title="章节删除项目", timeline=[{"chapter": 4, "title": "普通章节事件", "summary": "普通事件"}]))
    add_chapter_summary(ChapterSummaryIn(chapter=4, title="章节摘要", summary="摘要内容", hooks=["摘要伏笔"]))

    result = delete_chapter_summary(4)
    assert result["deleted"] == 1
    assert not list_chapter_summaries()
    chapter_events = [event for event in get_context_pack(ContextRequest(scene_goal="检查"))["timeline"] if event["chapter"] == 4]
    assert [event["title"] for event in chapter_events] == ["普通章节事件"]


def test_full_chapter_import_is_not_added_to_context_pack_memory():
    init_project(ProjectInit(title="正文项目", characters=[{"name": "林夜", "role": "男主"}]))
    imported = import_full_chapter(FullChapterIn(chapter=8, title="裂隙", content="完整正文内容" * 80))
    assert imported["chapter"]["content"].startswith("完整正文内容")
    assert list_full_chapters()[0]["content_length"] > 100
    assert get_full_chapter(8)["title"] == "裂隙"

    pack = get_context_pack(ContextRequest(scene_goal="下一章开场", characters=["林夜"]))
    assert "full_chapters" not in pack
    assert "完整正文内容" not in str(pack)


def test_project_export_import_roundtrip():
    init_project(
        ProjectInit(
            title="青霜纪",
            genre="玄幻",
            rules=["秘境规则"],
            characters=[{"name": "林夜", "role": "男主", "age": "18"}],
            lore_entries=[{"title": "天元宗", "keys": ["天元宗"], "content": "东洲第一宗"}],
            map_nodes=[{"name": "天元宗", "type": "宗门"}],
            timeline=[{"chapter": 1, "event": "林夜穿越"}],
        )
    )
    add_chapter_summary(ChapterSummaryIn(chapter=1, title="开端", summary="林夜醒来", facts=["穿越"], hooks=["玉佩"]))
    exported = export_project()
    init_project(ProjectInit(title="空项目"))
    imported = import_project(exported)
    assert imported["project"]["title"] == "青霜纪"
    assert imported["characters"][0]["name"] == "林夜"
    assert imported["chapter_summaries"][0]["facts"] == ["穿越"]


def test_faction_crud_pending_and_export_import_roundtrip():
    init_project(ProjectInit(title="势力项目"))
    created = create_faction(
        FactionIn(
            name="青霜盟",
            type="联盟",
            level="区域级",
            leader="林夜",
            core_members=["苏璃"],
            allies=["天元宗"],
            summary="主角临时组建的同盟。",
        )
    )
    assert created["faction"]["name"] == "青霜盟"
    assert list_factions()[0]["leader"] == "林夜"

    light = propose_faction_update("青霜盟", {"summary": "主角同盟扩张中。"}, "补充简介")
    assert light["mode"] == "pending"
    assert light["change"]["module_type"] == "factions"
    approve_change(light["change"]["id"])
    assert get_faction("青霜盟")["summary"] == "主角同盟扩张中。"

    pending = propose_faction_update("青霜盟", {"leader": "苏璃"}, "修改领袖")
    assert pending["mode"] == "pending"
    approve_change(pending["change"]["id"])
    assert get_faction("青霜盟")["leader"] == "苏璃"

    exported = export_project()
    init_project(ProjectInit(title="空项目"))
    imported = import_project(exported)
    assert imported["world"]["factions"][0]["name"] == "青霜盟"

    delete_pending = propose_delete_faction("青霜盟", "删除势力")
    assert delete_pending["mode"] == "pending"
    approve_change(delete_pending["change"]["id"])
    assert get_faction("青霜盟") is None


def test_sillytavern_world_info_export_import_roundtrip():
    init_project(
        ProjectInit(
            lore_entries=[
                {
                    "title": "龙渊秘境",
                    "keys": ["龙渊秘境", "龙魂"],
                    "content": "每十年开启一次",
                    "priority": 90,
                }
            ]
        )
    )
    exported = export_sillytavern_world_info()
    first_entry = next(iter(exported["entries"].values()))
    assert first_entry["comment"] == "龙渊秘境"
    assert first_entry["key"] == ["龙渊秘境", "龙魂"]
    init_project(ProjectInit(title="空项目"))
    dashboard = import_sillytavern_world_info(exported)
    assert dashboard["world"]["lore_entries"][0]["title"] == "龙渊秘境"
    pack = get_context_pack(ContextRequest(scene_goal="调查龙魂", keywords=["龙魂"]))
    assert pack["relevant_lore"][0]["content"] == "每十年开启一次"


def test_sillytavern_character_card_export_import_roundtrip():
    init_project(
        ProjectInit(
            characters=[
                {
                    "name": "林夜",
                    "role": "男主",
                    "gender": "男",
                    "age": "18",
                    "location": "天元宗",
                    "emotional_state": "戒备",
                    "faction": "天元宗",
                    "abilities": ["剑术"],
                    "equipment": ["玉佩"],
                    "relationship_notes": "与苏璃互相试探",
                    "public_facts": ["穿越者"],
                    "locked_facts": ["玉佩不可丢失"],
                }
            ]
        )
    )
    exported = export_sillytavern_character_card("林夜")
    assert exported["spec"] == "chara_card_v2"
    assert exported["data"]["name"] == "林夜"
    assert exported["data"]["extensions"]["novel_cockpit"]["abilities"] == ["剑术"]

    init_project(ProjectInit(title="空项目"))
    imported = import_sillytavern_character_card(exported)
    character = imported["character"]
    assert character["name"] == "林夜"
    assert character["location"] == "天元宗"
    assert character["locked_facts"] == ["玉佩不可丢失"]
    pack = get_context_pack(ContextRequest(scene_goal="林夜检查玉佩", characters=["林夜"]))
    assert pack["characters"][0]["equipment"] == ["玉佩"]


def test_project_switch_filters_dashboard_context_and_export():
    init_project(ProjectInit(title="甲项目", characters=[{"name": "甲主角", "role": "男主"}]))
    project_a = export_project()["project"]
    create_project("乙项目")
    init_project(ProjectInit(title="乙项目", characters=[{"name": "乙主角", "role": "男主"}]))
    project_b = export_project()["project"]

    pack_b = get_context_pack(ContextRequest(scene_goal="乙主角登场"))
    assert pack_b["project"]["title"] == "乙项目"
    assert pack_b["characters"][0]["name"] == "乙主角"

    switch_project(project_a["id"])
    pack_a = get_context_pack(ContextRequest(scene_goal="甲主角登场"))
    exported_a = export_project()
    assert pack_a["project"]["title"] == "甲项目"
    assert pack_a["characters"][0]["name"] == "甲主角"
    assert exported_a["characters"][0]["name"] == "甲主角"

    switch_project(project_b["id"])
    assert export_project()["characters"][0]["name"] == "乙主角"


def test_projects_allow_same_character_map_node_and_chapter_numbers():
    init_project(
        ProjectInit(
            title="甲项目",
            characters=[{"name": "林夜", "role": "男主", "location": "青霜城"}],
            map_nodes=[{"name": "天元宗", "type": "宗门", "description": "甲项目宗门"}],
        )
    )
    add_chapter_summary(ChapterSummaryIn(chapter=1, title="甲一", summary="甲项目第一章"))
    project_a = export_project()["project"]

    create_project("乙项目")
    init_project(
        ProjectInit(
            title="乙项目",
            characters=[{"name": "林夜", "role": "男主", "location": "黑水城"}],
            map_nodes=[{"name": "天元宗", "type": "废墟", "description": "乙项目旧址"}],
        )
    )
    add_chapter_summary(ChapterSummaryIn(chapter=1, title="乙一", summary="乙项目第一章"))
    project_b = export_project()["project"]

    exported_b = export_project()
    assert exported_b["characters"][0]["location"] == "黑水城"
    assert exported_b["map_nodes"][0]["description"] == "乙项目旧址"
    assert exported_b["chapter_summaries"][0]["title"] == "乙一"

    switch_project(project_a["id"])
    exported_a = export_project()
    pack_a = get_context_pack(ContextRequest(scene_goal="林夜回到天元宗", characters=["林夜"], keywords=["天元宗"]))
    assert exported_a["characters"][0]["location"] == "青霜城"
    assert exported_a["map_nodes"][0]["description"] == "甲项目宗门"
    assert exported_a["chapter_summaries"][0]["title"] == "甲一"
    assert pack_a["characters"][0]["location"] == "青霜城"

    switch_project(project_b["id"])
    pack_b = get_context_pack(ContextRequest(scene_goal="林夜调查天元宗", characters=["林夜"], keywords=["天元宗"]))
    assert pack_b["characters"][0]["location"] == "黑水城"


def test_delete_project_removes_scoped_data_and_switches_active_project():
    init_project(
        ProjectInit(
            title="甲项目",
            characters=[{"name": "甲主角", "role": "男主"}],
            map_nodes=[{"name": "甲地图", "type": "地点"}],
        )
    )
    project_a = export_project()["project"]

    create_project("乙项目")
    init_project(ProjectInit(title="乙项目", characters=[{"name": "乙主角", "role": "男主"}]))
    project_b = export_project()["project"]

    dashboard = delete_project(project_b["id"])
    assert dashboard["project"]["id"] == project_a["id"]
    assert dashboard["projects"][0]["id"] == project_a["id"]
    assert dashboard["characters"][0]["name"] == "甲主角"
    assert dashboard["world"]["map_nodes"][0]["name"] == "甲地图"

    with get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM characters WHERE project_id = ?", (project_b["id"],)).fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM projects WHERE id = ?", (project_b["id"],)).fetchone()[0] == 0


def test_delete_last_project_creates_fallback_project():
    init_project(ProjectInit(title="孤本", characters=[{"name": "林夜", "role": "男主"}]))
    project = export_project()["project"]

    dashboard = delete_project(project["id"])

    assert dashboard["project"]["title"] == "未命名作品"
    assert dashboard["project"]["is_active"] == 1
    assert dashboard["projects"] == [dashboard["project"]]
    assert dashboard["characters"] == []


def test_update_project_edits_basic_book_fields():
    project = create_project("旧书名", "玄幻", "旧简介")

    updated = update_project(project["id"], {"title": "新书名", "genre": "仙侠", "premise": "新简介"})

    assert updated["title"] == "新书名"
    assert updated["genre"] == "仙侠"
    assert updated["premise"] == "新简介"
    assert updated["is_active"] == 1


def test_delete_character_is_project_scoped_and_pending_delete_requires_approval():
    init_project(ProjectInit(title="甲项目", characters=[{"name": "林夜", "role": "男主", "location": "甲地"}]))
    project_a = export_project()["project"]
    create_project("乙项目")
    init_project(ProjectInit(title="乙项目", characters=[{"name": "林夜", "role": "男主", "location": "乙地"}]))
    project_b = export_project()["project"]

    pending = propose_delete_character("林夜", project_title="乙项目", reason="测试删除")
    assert pending["mode"] == "pending"
    assert get_character("林夜")["location"] == "乙地"
    approve_change(pending["change"]["id"])
    assert get_character("林夜") is None

    switch_project(project_a["id"])
    assert get_character("林夜")["location"] == "甲地"

    switch_project(project_b["id"])
    create_project("丙项目")
    init_project(ProjectInit(title="丙项目", characters=[{"name": "苏璃", "role": "女主"}]))
    delete_character("苏璃")
    assert get_character("苏璃") is None


def test_propose_delete_project_uses_pending_queue():
    init_project(ProjectInit(title="甲项目"))
    project_a = export_project()["project"]
    create_project("乙项目")
    project_b = export_project()["project"]

    pending = propose_delete_project(project_title="乙项目", reason="测试删除项目")
    assert pending["mode"] == "pending"
    assert export_project()["project"]["id"] == project_b["id"]

    approve_change(pending["change"]["id"])
    assert export_project()["project"]["id"] == project_a["id"]
    with get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM projects WHERE id = ?", (project_b["id"],)).fetchone()[0] == 0


def test_import_project_routes_by_book_title_without_polluting_current_project():
    init_project(ProjectInit(title="甲项目", characters=[{"name": "甲主角", "role": "男主"}]))
    create_project("乙项目")
    init_project(ProjectInit(title="乙项目", characters=[{"name": "乙主角", "role": "男主"}]))
    project_b = export_project()["project"]

    imported = import_project({"project": {"title": "甲项目"}, "characters": [{"name": "新增甲角", "role": "配角"}]})

    assert imported["project"]["title"] == "甲项目"
    assert {item["name"] for item in imported["characters"]} == {"新增甲角"}
    switch_project(project_b["id"])
    assert export_project()["project"]["title"] == "乙项目"
    assert export_project()["characters"][0]["name"] == "乙主角"


def test_import_project_accepts_chapters_as_full_text_alias():
    init_project(ProjectInit(title="旧项目"))

    imported = import_project(
        {
            "project": {"title": "正文书"},
            "chapters": [{"chapter": 9, "title": "归墟", "text": "第九章完整正文"}],
        }
    )

    assert imported["project"]["title"] == "正文书"
    assert imported["full_chapters"][0]["chapter"] == 9
    assert get_full_chapter(9)["content"] == "第九章完整正文"


def test_character_state_variables_roundtrip_and_context_pack():
    init_project(
        ProjectInit(
            title="变量项目",
            characters=[
                {
                    "name": "林夜",
                    "role": "男主",
                    "state_variables": {
                        "identity": {"public_identity": "外门弟子", "hidden_identity": "穿越者"},
                        "emotion": {"mood": "警觉", "pressure": "宗门追查"},
                    },
                }
            ],
        )
    )

    character = get_character("林夜")
    assert character["state_variables"]["identity"]["hidden_identity"] == "穿越者"

    pending = propose_character_update("林夜", {"state_variables": {"plot": {"current_goal": "调查玉佩"}}}, "核心变量更新")
    assert pending["mode"] == "pending"
    approve_change(pending["change"]["id"])

    pack = get_context_pack(ContextRequest(scene_goal="林夜调查玉佩", characters=["林夜"]))
    assert pack["characters"][0]["state_variables"]["plot"]["current_goal"] == "调查玉佩"

    exported = export_project()
    init_project(ProjectInit(title="空项目"))
    imported = import_project(exported)
    assert imported["characters"][0]["state_variables"]["plot"]["current_goal"] == "调查玉佩"


def test_world_coordinate_entries_are_normalized_to_canvas_positions():
    init_project(ProjectInit(title="坐标项目"))
    patch = world_entries_to_patch(
        "势力范围坐标表",
        [
            {"name": "云氏", "content": "核心坐标（200, 200, 180）中州"},
            {"name": "殷氏", "content": "核心坐标（12000, 8000, -50）东荒"},
            {"name": "九幽魔渊", "content": "核心坐标（-5000, 3000, -8500）西漠"},
        ],
    )

    pending = propose_world_update(patch, "坐标上传")
    assert pending["mode"] == "pending"
    approve_change(pending["change"]["id"])
    nodes = {node["name"]: node for node in export_project()["map_nodes"]}

    assert 0 < nodes["云氏"]["x"] < 100
    assert 0 < nodes["殷氏"]["x"] < 100
    assert len({nodes["云氏"]["x"], nodes["殷氏"]["x"], nodes["九幽魔渊"]["x"]}) == 3
    assert "原始坐标" in nodes["殷氏"]["description"]


def test_world_nodes_without_coordinates_are_auto_laid_out():
    init_project(ProjectInit(title="缺坐标项目"))
    pending = propose_world_update(
        {
            "map_nodes": [
                {"name": "主城", "type": "城市", "description": "没有坐标"},
                {"name": "废土", "type": "区域", "description": "没有坐标"},
                {"name": "研究所", "type": "设施", "description": "没有坐标"},
                {"name": "避难所", "type": "设施", "description": "没有坐标"},
            ]
        },
        "模型未提供坐标",
    )
    assert pending["mode"] == "pending"
    approve_change(pending["change"]["id"])
    nodes = export_project()["map_nodes"]
    positions = {(node["x"], node["y"]) for node in nodes}

    assert len(positions) == 4
    assert all(0 < node["x"] < 100 and 0 < node["y"] < 100 for node in nodes)


def test_polygon_world_nodes_preserve_points_and_center():
    init_project(ProjectInit(title="多边形项目"))
    pending = propose_world_update(
        {
            "map_nodes": [
                {
                    "name": "天机商盟",
                    "type": "势力",
                    "shape": "polygon",
                    "polygon_points": [
                        {"x": 10, "y": 20},
                        {"x": 30, "y": 18},
                        {"x": 38, "y": 35},
                        {"x": 16, "y": 42},
                    ],
                    "description": "商业势力范围",
                }
            ]
        },
        "提交多边形势力范围",
    )
    assert pending["mode"] == "pending"
    approve_change(pending["change"]["id"])
    node = export_project()["map_nodes"][0]

    assert node["shape"] == "polygon"
    assert len(node["polygon_points"]) == 4
    assert 0 < node["x"] < 100
    assert 0 < node["y"] < 100
