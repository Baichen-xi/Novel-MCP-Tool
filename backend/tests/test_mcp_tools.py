import os
import tempfile

os.environ["NOVEL_COCKPIT_DB"] = os.path.join(tempfile.mkdtemp(prefix="novel-cockpit-mcp-"), "test.db")

import pytest
from fastmcp import Client

from app.db import get_connection, init_db
from app.mcp_server import mcp


@pytest.fixture
def anyio_backend():
    return "asyncio"


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


def unwrap(result):
    return result.data


@pytest.mark.anyio
async def test_mcp_tools_are_callable_end_to_end():
    async with Client(mcp) as client:
        tools = await client.list_tools()
        names = {tool.name for tool in tools}
        assert {
            "init_project",
            "list_projects",
            "create_project",
            "switch_project",
            "propose_delete_project",
            "healthcheck",
            "get_context_pack",
            "get_world_profile",
            "propose_world_profile_update",
            "get_power_system",
            "propose_power_system_update",
            "get_character",
            "propose_character_update",
            "propose_delete_character",
            "get_factions",
            "get_faction",
            "propose_faction_update",
            "propose_delete_faction",
            "add_chapter_summary",
            "list_full_chapters",
            "get_full_chapter",
            "save_full_chapter",
            "get_pending_changes",
        }.issubset(names)

        health = unwrap(await client.call_tool("healthcheck", {}))
        assert health["status"] == "ok"
        assert health["service"] == "novel-cockpit-mcp"

        dashboard = unwrap(
            await client.call_tool(
                "init_project",
                {
                    "payload": {
                        "title": "青霜纪",
                        "genre": "玄幻",
                        "characters": [{"name": "林夜", "role": "男主", "age": "18"}],
                        "factions": [{"name": "天元宗", "type": "宗门", "leader": "陆玄"}],
                        "lore_entries": [{"title": "天元宗", "keys": ["天元宗"], "content": "东洲第一宗门"}],
                        "map_nodes": [{"name": "天元宗", "type": "宗门"}],
                    }
                },
            )
        )
        assert dashboard["project"]["title"] == "青霜纪"

        character = unwrap(await client.call_tool("get_character", {"name": "林夜"}))
        assert character["age"] == "18"

        factions = unwrap(await client.call_tool("get_factions", {}))
        assert factions[0]["name"] == "天元宗"
        faction = unwrap(await client.call_tool("get_faction", {"name": "天元宗"}))
        assert faction["leader"] == "陆玄"
        faction_update = unwrap(await client.call_tool("propose_faction_update", {"name": "天元宗", "patch": {"leader": "新宗主"}, "reason": "MCP 测试势力保护"}))
        assert faction_update["mode"] == "pending"

        pending = unwrap(
            await client.call_tool(
                "propose_character_update",
                {"name": "林夜", "patch": {"status": "dead"}, "reason": "MCP 测试核心字段保护"},
            )
        )
        assert pending["mode"] == "pending"

        pending_changes = unwrap(await client.call_tool("get_pending_changes", {}))
        assert pending_changes[0]["target_name"] == "林夜"

        summary = unwrap(
            await client.call_tool(
                "add_chapter_summary",
                {
                    "chapter": 1,
                    "title": "开端",
                    "summary": "林夜醒来并发现玉佩。",
                    "facts": ["林夜持有玉佩"],
                    "hooks": ["玉佩来源"],
                },
            )
        )
        assert summary["summary"]["chapter"] == 1

        context = unwrap(await client.call_tool("get_context_pack", {"scene_goal": "林夜调查天元宗", "keywords": ["天元宗"]}))
        assert context["characters"][0]["name"] == "林夜"
        assert context["relevant_lore"][0]["title"] == "天元宗"
        assert context["world_profile"] == {}
        assert context["power_system"] == {}

        world_profile = unwrap(await client.call_tool("get_world_profile", {}))
        assert world_profile["world_profile"] == {}
        power_system = unwrap(await client.call_tool("get_power_system", {}))
        assert power_system["power_system"] == {}

        profile_pending = unwrap(
            await client.call_tool(
                "propose_world_profile_update",
                {"patch": {"summary": "玄幻世界", "world_type": "玄幻"}, "reason": "补充世界观"},
            )
        )
        assert profile_pending["mode"] == "pending"

        system_pending = unwrap(
            await client.call_tool(
                "propose_power_system_update",
                {"patch": {"summary": "境界体系", "tiers": [{"name": "炼气"}]}, "reason": "补充境界"},
            )
        )
        assert system_pending["mode"] == "pending"

        created = unwrap(await client.call_tool("create_project", {"title": "乙项目"}))
        assert created["project"]["title"] == "乙项目"
        projects = unwrap(await client.call_tool("list_projects", {}))
        assert {item["title"] for item in projects["projects"]} >= {"青霜纪", "乙项目"}

        routed = unwrap(
            await client.call_tool(
                "init_project",
                {
                    "project_title": "MCP新书",
                    "payload": {"title": "MCP新书", "characters": [{"name": "新主角", "role": "男主"}]},
                },
            )
        )
        assert routed["project"]["title"] == "MCP新书"
        context = unwrap(await client.call_tool("get_context_pack", {"scene_goal": "新主角登场", "project_title": "MCP新书"}))
        assert context["characters"][0]["name"] == "新主角"

        saved_chapter = unwrap(
            await client.call_tool(
                "save_full_chapter",
                {"chapter": 2, "title": "新章", "content": "林夜在天元宗发现新的伏笔。", "project_title": "MCP新书"},
            )
        )
        assert saved_chapter["chapter"]["title"] == "新章"
        full_chapter = unwrap(await client.call_tool("get_full_chapter", {"chapter": 2, "project_title": "MCP新书"}))
        assert "新的伏笔" in full_chapter["content"]
        chapter_list = unwrap(await client.call_tool("list_full_chapters", {"project_title": "MCP新书"}))
        assert chapter_list[0]["chapter"] == 2

        world_update = unwrap(
            await client.call_tool(
                "propose_world_update",
                {
                    "project_title": "MCP新书",
                    "title": "势力坐标",
                    "entries": [{"name": "殷氏", "content": "核心坐标（12000, 8000, -50）"}],
                },
            )
        )
        assert world_update["mode"] == "pending"
        assert world_update["change"]["patch"]["map_nodes"][0]["name"] == "殷氏"

        faction_pending = unwrap(
            await client.call_tool(
                "propose_faction_update",
                {
                    "project_title": "MCP新书",
                    "name": "殷氏",
                    "patch": {"type": "世家", "summary": "东荒世家"},
                    "reason": "新增势力",
                },
            )
        )
        assert faction_pending["mode"] == "pending"

        delete_request = unwrap(await client.call_tool("propose_delete_character", {"name": "新主角", "project_title": "MCP新书"}))
        assert delete_request["mode"] == "pending"
        assert delete_request["change"]["target_type"] == "character_delete"
