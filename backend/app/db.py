from __future__ import annotations

import os
import sqlite3
from pathlib import Path


def default_db_path() -> Path:
    roaming = os.getenv("APPDATA")
    if roaming:
        return Path(roaming) / "local.novel.cockpit" / "novel.db"
    return Path.home() / "AppData" / "Roaming" / "local.novel.cockpit" / "novel.db"


DB_PATH = Path(os.getenv("NOVEL_COCKPIT_DB", default_db_path()))


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT '',
                genre TEXT NOT NULL DEFAULT '',
                premise TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 0,
                current_chapter INTEGER NOT NULL DEFAULT 1,
                current_scene_goal TEXT NOT NULL DEFAULT '',
                current_conflict TEXT NOT NULL DEFAULT '',
                rules_json TEXT NOT NULL DEFAULT '[]',
                world_profile_json TEXT NOT NULL DEFAULT '{}',
                power_system_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                name TEXT NOT NULL,
                aliases_json TEXT NOT NULL DEFAULT '[]',
                role TEXT NOT NULL DEFAULT '',
                gender TEXT NOT NULL DEFAULT '',
                personality TEXT NOT NULL DEFAULT '',
                realm TEXT NOT NULL DEFAULT '',
                identity TEXT NOT NULL DEFAULT '',
                age TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                location TEXT NOT NULL DEFAULT '',
                emotional_state TEXT NOT NULL DEFAULT '',
                physical_state TEXT NOT NULL DEFAULT '',
                faction TEXT NOT NULL DEFAULT '',
                bloodline TEXT NOT NULL DEFAULT '',
                abilities_json TEXT NOT NULL DEFAULT '[]',
                equipment_json TEXT NOT NULL DEFAULT '[]',
                relationship_notes TEXT NOT NULL DEFAULT '',
                public_facts_json TEXT NOT NULL DEFAULT '[]',
                private_facts_json TEXT NOT NULL DEFAULT '[]',
                locked_facts_json TEXT NOT NULL DEFAULT '[]',
                state_variables_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS lore_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                title TEXT NOT NULL,
                keys_json TEXT NOT NULL DEFAULT '[]',
                content TEXT NOT NULL DEFAULT '',
                scope TEXT NOT NULL DEFAULT '',
                priority INTEGER NOT NULL DEFAULT 50,
                insertion_position TEXT NOT NULL DEFAULT 'context',
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS map_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                map_image_id INTEGER,
                layer TEXT NOT NULL DEFAULT '',
                plane TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'place',
                shape TEXT NOT NULL DEFAULT 'point',
                parent_name TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                faction TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '',
                x REAL NOT NULL DEFAULT 0,
                y REAL NOT NULL DEFAULT 0,
                polygon_points_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS map_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                title TEXT NOT NULL DEFAULT '世界地图',
                layer TEXT NOT NULL DEFAULT '世界',
                parent_name TEXT NOT NULL DEFAULT '',
                scope TEXT NOT NULL DEFAULT '',
                scale_label TEXT NOT NULL DEFAULT '',
                real_width REAL NOT NULL DEFAULT 0,
                real_height REAL NOT NULL DEFAULT 0,
                distance_unit TEXT NOT NULL DEFAULT '里',
                scale_kind TEXT NOT NULL DEFAULT '',
                image_data TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT 'image/png',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS factions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                name TEXT NOT NULL,
                aliases_json TEXT NOT NULL DEFAULT '[]',
                type TEXT NOT NULL DEFAULT '',
                level TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active',
                parent_name TEXT NOT NULL DEFAULT '',
                location TEXT NOT NULL DEFAULT '',
                sphere TEXT NOT NULL DEFAULT '',
                leader TEXT NOT NULL DEFAULT '',
                core_members_json TEXT NOT NULL DEFAULT '[]',
                allies_json TEXT NOT NULL DEFAULT '[]',
                enemies_json TEXT NOT NULL DEFAULT '[]',
                sub_factions_json TEXT NOT NULL DEFAULT '[]',
                summary TEXT NOT NULL DEFAULT '',
                ideology TEXT NOT NULL DEFAULT '',
                resources TEXT NOT NULL DEFAULT '',
                plot_notes TEXT NOT NULL DEFAULT '',
                locked_facts_json TEXT NOT NULL DEFAULT '[]',
                tags_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS timeline_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                chapter INTEGER,
                date_label TEXT NOT NULL DEFAULT '',
                event TEXT NOT NULL,
                involved_characters_json TEXT NOT NULL DEFAULT '[]',
                location TEXT NOT NULL DEFAULT '',
                consequences TEXT NOT NULL DEFAULT '',
                tags_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chapter_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                chapter INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                summary TEXT NOT NULL,
                facts_json TEXT NOT NULL DEFAULT '[]',
                hooks_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS full_chapters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                chapter INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'user_import',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pending_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                target_type TEXT NOT NULL,
                target_name TEXT NOT NULL DEFAULT '',
                patch_json TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT 'llm',
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resolved_at TEXT
            );

            CREATE TABLE IF NOT EXISTS change_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL DEFAULT 1,
                target_type TEXT NOT NULL,
                target_name TEXT NOT NULL DEFAULT '',
                patch_json TEXT NOT NULL,
                before_json TEXT NOT NULL DEFAULT '{}',
                after_json TEXT NOT NULL DEFAULT '{}',
                reason TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        migrations = {
            "projects": {
                "is_active": "INTEGER NOT NULL DEFAULT 0",
                "world_profile_json": "TEXT NOT NULL DEFAULT '{}'",
                "power_system_json": "TEXT NOT NULL DEFAULT '{}'",
            },
            "characters": {
                "project_id": "INTEGER NOT NULL DEFAULT 1",
                "state_variables_json": "TEXT NOT NULL DEFAULT '{}'",
                "personality": "TEXT NOT NULL DEFAULT ''",
                "realm": "TEXT NOT NULL DEFAULT ''",
                "identity": "TEXT NOT NULL DEFAULT ''",
                "bloodline": "TEXT NOT NULL DEFAULT ''",
            },
            "lore_entries": {"project_id": "INTEGER NOT NULL DEFAULT 1"},
            "map_nodes": {
                "project_id": "INTEGER NOT NULL DEFAULT 1",
                "map_image_id": "INTEGER",
                "layer": "TEXT NOT NULL DEFAULT ''",
                "plane": "TEXT NOT NULL DEFAULT ''",
                "shape": "TEXT NOT NULL DEFAULT 'point'",
                "color": "TEXT NOT NULL DEFAULT ''",
                "polygon_points_json": "TEXT NOT NULL DEFAULT '[]'",
            },
            "timeline_events": {"project_id": "INTEGER NOT NULL DEFAULT 1"},
            "chapter_summaries": {"project_id": "INTEGER NOT NULL DEFAULT 1"},
            "map_images": {
                "project_id": "INTEGER NOT NULL DEFAULT 1",
                "layer": "TEXT NOT NULL DEFAULT '世界'",
                "parent_name": "TEXT NOT NULL DEFAULT ''",
                "scope": "TEXT NOT NULL DEFAULT ''",
                "scale_label": "TEXT NOT NULL DEFAULT ''",
                "real_width": "REAL NOT NULL DEFAULT 0",
                "real_height": "REAL NOT NULL DEFAULT 0",
                "distance_unit": "TEXT NOT NULL DEFAULT '里'",
                "scale_kind": "TEXT NOT NULL DEFAULT ''",
                "notes": "TEXT NOT NULL DEFAULT ''",
            },
            "full_chapters": {
                "project_id": "INTEGER NOT NULL DEFAULT 1",
                "source": "TEXT NOT NULL DEFAULT 'user_import'",
            },
            "factions": {
                "project_id": "INTEGER NOT NULL DEFAULT 1",
                "aliases_json": "TEXT NOT NULL DEFAULT '[]'",
                "level": "TEXT NOT NULL DEFAULT ''",
                "status": "TEXT NOT NULL DEFAULT 'active'",
                "parent_name": "TEXT NOT NULL DEFAULT ''",
                "location": "TEXT NOT NULL DEFAULT ''",
                "sphere": "TEXT NOT NULL DEFAULT ''",
                "leader": "TEXT NOT NULL DEFAULT ''",
                "core_members_json": "TEXT NOT NULL DEFAULT '[]'",
                "allies_json": "TEXT NOT NULL DEFAULT '[]'",
                "enemies_json": "TEXT NOT NULL DEFAULT '[]'",
                "sub_factions_json": "TEXT NOT NULL DEFAULT '[]'",
                "ideology": "TEXT NOT NULL DEFAULT ''",
                "resources": "TEXT NOT NULL DEFAULT ''",
                "plot_notes": "TEXT NOT NULL DEFAULT ''",
                "locked_facts_json": "TEXT NOT NULL DEFAULT '[]'",
                "tags_json": "TEXT NOT NULL DEFAULT '[]'",
            },
            "pending_changes": {"project_id": "INTEGER NOT NULL DEFAULT 1"},
            "change_history": {
                "project_id": "INTEGER NOT NULL DEFAULT 1",
                "before_json": "TEXT NOT NULL DEFAULT '{}'",
                "after_json": "TEXT NOT NULL DEFAULT '{}'",
            },
        }
        for table, columns in migrations.items():
            existing = conn.execute(f"PRAGMA table_info({table})").fetchall()
            existing_names = {row["name"] for row in existing}
            for column, definition in columns.items():
                if column not in existing_names:
                    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        migrate_project_scoped_uniques(conn)
        conn.execute(
            """
            INSERT OR IGNORE INTO projects (id, title, genre, premise, is_active)
            VALUES (1, '未命名作品', '', '', 1)
            """
        )
        active_count = conn.execute("SELECT COUNT(*) AS count FROM projects WHERE is_active = 1").fetchone()["count"]
        if active_count == 0:
            conn.execute("UPDATE projects SET is_active = 1 WHERE id = (SELECT MIN(id) FROM projects)")


def migrate_project_scoped_uniques(conn: sqlite3.Connection) -> None:
    ensure_table_is_project_scoped(
        conn,
        "characters",
        """
        CREATE TABLE characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL DEFAULT 1,
            name TEXT NOT NULL,
            aliases_json TEXT NOT NULL DEFAULT '[]',
            role TEXT NOT NULL DEFAULT '',
            gender TEXT NOT NULL DEFAULT '',
            personality TEXT NOT NULL DEFAULT '',
            realm TEXT NOT NULL DEFAULT '',
            identity TEXT NOT NULL DEFAULT '',
            age TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            location TEXT NOT NULL DEFAULT '',
            emotional_state TEXT NOT NULL DEFAULT '',
            physical_state TEXT NOT NULL DEFAULT '',
            faction TEXT NOT NULL DEFAULT '',
            bloodline TEXT NOT NULL DEFAULT '',
            abilities_json TEXT NOT NULL DEFAULT '[]',
            equipment_json TEXT NOT NULL DEFAULT '[]',
            relationship_notes TEXT NOT NULL DEFAULT '',
            public_facts_json TEXT NOT NULL DEFAULT '[]',
            private_facts_json TEXT NOT NULL DEFAULT '[]',
            locked_facts_json TEXT NOT NULL DEFAULT '[]',
            state_variables_json TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "name TEXT NOT NULL UNIQUE",
    )
    ensure_table_is_project_scoped(
        conn,
        "map_nodes",
        """
        CREATE TABLE map_nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL DEFAULT 1,
            map_image_id INTEGER,
            layer TEXT NOT NULL DEFAULT '',
            plane TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'place',
            shape TEXT NOT NULL DEFAULT 'point',
            parent_name TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            faction TEXT NOT NULL DEFAULT '',
            color TEXT NOT NULL DEFAULT '',
            x REAL NOT NULL DEFAULT 0,
            y REAL NOT NULL DEFAULT 0,
            polygon_points_json TEXT NOT NULL DEFAULT '[]',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "name TEXT NOT NULL UNIQUE",
    )
    ensure_table_is_project_scoped(
        conn,
        "chapter_summaries",
        """
        CREATE TABLE chapter_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL DEFAULT 1,
            chapter INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL,
            facts_json TEXT NOT NULL DEFAULT '[]',
            hooks_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        "chapter INTEGER NOT NULL UNIQUE",
    )
    conn.executescript(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_project_name ON characters(project_id, name);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_map_nodes_project_name ON map_nodes(project_id, name);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_chapter_summaries_project_chapter ON chapter_summaries(project_id, chapter);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_full_chapters_project_chapter ON full_chapters(project_id, chapter);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_factions_project_name ON factions(project_id, name);
        CREATE INDEX IF NOT EXISTS idx_map_images_project_updated ON map_images(project_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_lore_entries_project_title ON lore_entries(project_id, title);
        """
    )


def ensure_table_is_project_scoped(
    conn: sqlite3.Connection,
    table: str,
    create_sql: str,
    legacy_unique_fragment: str,
) -> None:
    row = conn.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", (table,)).fetchone()
    if not row or legacy_unique_fragment not in (row["sql"] or ""):
        return
    columns = [column["name"] for column in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    column_list = ", ".join(columns)
    legacy_table = f"{table}_legacy_global_unique"
    conn.execute(f"ALTER TABLE {table} RENAME TO {legacy_table}")
    conn.execute(create_sql)
    conn.execute(f"INSERT INTO {table} ({column_list}) SELECT {column_list} FROM {legacy_table}")
    conn.execute(f"DROP TABLE {legacy_table}")
