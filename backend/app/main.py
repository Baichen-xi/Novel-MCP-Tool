from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .schemas import ChapterSummaryIn, CharacterDeleteProposal, CharacterUpdate, ContextRequest, DirectCharacterUpdate, FactionDeleteProposal, FactionIn, FactionUpdate, FullChapterIn, LoreEntryUpdate, MapImageIn, MapImageUpdate, MapNodeCreate, MapNodeUpdate, ProjectCreate, ProjectDeleteProposal, ProjectInit, ResolveChangeIn, WorldUpdate
from .services import (
    add_chapter_summary,
    approve_change,
    create_map_node,
    create_project,
    create_faction,
    delete_character,
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
    get_dashboard,
    get_faction,
    list_factions,
    get_timeline,
    get_world_state,
    get_world_profile,
    get_power_system,
    init_project,
    import_project,
    import_full_chapter,
    import_sillytavern_character_card,
    list_projects,
    import_sillytavern_world_info,
    list_change_history,
    list_chapter_summaries,
    list_full_chapters,
    list_pending_changes,
    propose_delete_character,
    propose_delete_project,
    propose_delete_faction,
    propose_faction_update,
    propose_character_update,
    propose_world_update,
    reject_change,
    rollback_change,
    save_map_image,
    switch_project,
    update_character_direct,
    update_faction_direct,
    update_lore_entry_direct,
    update_map_image_direct,
    update_map_node_direct,
    update_world_profile_direct,
    update_power_system_direct,
)

app = FastAPI(title="Novel Cockpit", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/dashboard")
def dashboard() -> dict:
    return get_dashboard()


@app.get("/api/projects")
def projects() -> list[dict]:
    return list_projects()


@app.post("/api/projects")
def project_create(payload: ProjectCreate) -> dict:
    return {"project": create_project(payload.title, payload.genre, payload.premise), "dashboard": get_dashboard()}


@app.post("/api/projects/{project_id}/switch")
def project_switch(project_id: int) -> dict:
    try:
        return switch_project(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/projects/delete-proposals")
def project_delete_proposal(payload: ProjectDeleteProposal) -> dict:
    try:
        return propose_delete_project(payload.project_id, payload.project_title, payload.reason, "user")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/projects/{project_id}")
def project_delete(project_id: int) -> dict:
    try:
        return delete_project(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/project/init")
def project_init(payload: ProjectInit) -> dict:
    return init_project(payload)


@app.get("/api/project/export")
def project_export() -> dict:
    return export_project()


@app.post("/api/project/import")
def project_import(payload: dict) -> dict:
    data = payload.get("data", payload)
    dashboard = import_project(data, payload.get("target_project_id"), payload.get("target_project_title", ""))
    return {"dashboard": dashboard, "target_project": dashboard.get("target_project", dashboard.get("project"))}


@app.get("/api/integrations/sillytavern/world-info/export")
def sillytavern_world_info_export() -> dict:
    return export_sillytavern_world_info()


@app.post("/api/integrations/sillytavern/world-info/import")
def sillytavern_world_info_import(payload: dict) -> dict:
    return import_sillytavern_world_info(payload)


@app.get("/api/integrations/sillytavern/character-card/{name}/export")
def sillytavern_character_card_export(name: str) -> dict:
    try:
        return export_sillytavern_character_card(name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/integrations/sillytavern/character-card/import")
def sillytavern_character_card_import(payload: dict) -> dict:
    try:
        data = payload.get("card", payload)
        return import_sillytavern_character_card(data, payload.get("target_project_id"), payload.get("target_project_title", ""))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/context-pack")
def context_pack(payload: ContextRequest) -> dict:
    return get_context_pack(payload)


@app.get("/api/characters/{name}")
def character(name: str) -> dict:
    item = get_character(name)
    if not item:
        raise HTTPException(status_code=404, detail="Character not found")
    return item


@app.post("/api/characters/{name}/propose")
def character_update(name: str, payload: CharacterUpdate) -> dict:
    return propose_character_update(name, payload.patch, payload.reason, payload.source)


@app.patch("/api/characters/{name}")
def character_direct_update(name: str, payload: DirectCharacterUpdate) -> dict:
    try:
        return update_character_direct(name, payload.patch, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/characters/{name}")
def character_delete(name: str) -> dict:
    try:
        return delete_character(name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/characters/{name}/delete-proposals")
def character_delete_proposal(name: str, payload: CharacterDeleteProposal) -> dict:
    try:
        return propose_delete_character(name, payload.project_id, payload.project_title, payload.reason, "user")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/factions")
def factions() -> list[dict]:
    return list_factions()


@app.get("/api/factions/{name}")
def faction(name: str) -> dict:
    item = get_faction(name)
    if not item:
        raise HTTPException(status_code=404, detail="Faction not found")
    return item


@app.post("/api/factions")
def faction_create(payload: FactionIn) -> dict:
    return create_faction(payload)


@app.patch("/api/factions/{name}")
def faction_direct_update(name: str, payload: FactionUpdate) -> dict:
    try:
        return update_faction_direct(name, payload.patch, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/factions/{name}")
def faction_delete(name: str) -> dict:
    try:
        return delete_faction(name)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/factions/{name}/delete-proposals")
def faction_delete_proposal(name: str, payload: FactionDeleteProposal) -> dict:
    try:
        return propose_delete_faction(name, payload.reason, "user")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/factions/{name}/propose")
def faction_update_proposal(name: str, payload: FactionUpdate) -> dict:
    return propose_faction_update(name, payload.patch, payload.reason, payload.source)


@app.get("/api/world")
def world(scope: str | None = None) -> dict:
    return get_world_state(scope)


@app.get("/api/world/profile")
def world_profile() -> dict:
    return get_world_profile()


@app.patch("/api/world/profile")
def world_profile_update(payload: WorldUpdate) -> dict:
    return update_world_profile_direct(payload.patch, payload.reason)


@app.get("/api/world/power-system")
def power_system() -> dict:
    return get_power_system()


@app.patch("/api/world/power-system")
def power_system_update(payload: WorldUpdate) -> dict:
    return update_power_system_direct(payload.patch, payload.reason)


@app.post("/api/world/propose")
def world_update(payload: WorldUpdate) -> dict:
    return propose_world_update(payload.patch, payload.reason, payload.source)


@app.post("/api/world/map-nodes")
def map_node_create(payload: MapNodeCreate) -> dict:
    return create_map_node(payload)


@app.patch("/api/world/map-nodes/{node_id}")
def map_node_direct_update(node_id: int, payload: MapNodeUpdate) -> dict:
    try:
        return update_map_node_direct(node_id, payload.patch, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/world/map-nodes/{node_id}")
def map_node_delete(node_id: int) -> dict:
    try:
        return delete_map_node(node_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/world/map-image")
def map_image_save(payload: MapImageIn) -> dict:
    return save_map_image(payload)


@app.patch("/api/world/map-images/{image_id}")
def map_image_direct_update(image_id: int, payload: MapImageUpdate) -> dict:
    try:
        return update_map_image_direct(image_id, payload.patch, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.delete("/api/world/map-image")
def map_image_delete() -> dict:
    return delete_map_image()


@app.delete("/api/world/map-images/{image_id}")
def map_image_delete_one(image_id: int) -> dict:
    return delete_map_image(image_id)


@app.patch("/api/world/lore-entries/{entry_id}")
def lore_entry_direct_update(entry_id: int, payload: LoreEntryUpdate) -> dict:
    try:
        return update_lore_entry_direct(entry_id, payload.patch, payload.reason)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/timeline")
def timeline(chapter_range: str | None = None) -> list[dict]:
    return get_timeline(chapter_range)


@app.post("/api/chapters/summary")
def chapter_summary(payload: ChapterSummaryIn) -> dict:
    return add_chapter_summary(payload)


@app.get("/api/chapters/summaries")
def chapter_summaries() -> list[dict]:
    return list_chapter_summaries()


@app.post("/api/chapters/full")
def full_chapter_import(payload: FullChapterIn) -> dict:
    return import_full_chapter(payload)


@app.get("/api/chapters/full")
def full_chapters() -> list[dict]:
    return list_full_chapters()


@app.get("/api/chapters/full/{chapter}")
def full_chapter(chapter: int) -> dict:
    item = get_full_chapter(chapter)
    if not item:
        raise HTTPException(status_code=404, detail="Full chapter not found")
    return item


@app.get("/api/pending-changes")
def pending_changes() -> list[dict]:
    return list_pending_changes()


@app.get("/api/history")
def history(limit: int = 50) -> list[dict]:
    return list_change_history(limit)


@app.post("/api/history/{history_id}/rollback")
def rollback_history(history_id: int) -> dict:
    try:
        return rollback_change(history_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/pending-changes/{change_id}/approve")
def approve_pending_change(change_id: int, payload: ResolveChangeIn | None = None) -> dict:
    try:
        return approve_change(change_id, payload.patch if payload else None)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/pending-changes/{change_id}/reject")
def reject_pending_change(change_id: int) -> dict:
    return reject_change(change_id)
