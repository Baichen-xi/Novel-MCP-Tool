import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ImagePlus, Layers3, Map as MapIcon, Pencil, Plus, RefreshCw, Shield, Trash2, Upload, UserRound } from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8765";
const MAP_SCENE = { width: 1600, height: 1000 };
const SCALE_BAR_TARGET_PX = 128;
const EMPTY_MAP_IMAGE_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const mapScaleKinds = ["总览", "世界", "区域", "城市", "建筑", "副本", "秘境", "星域", "其他"];

const roleOptions = ["主角", "配角", "男主", "女主", "重要配角", "其他"];

const viewMeta = {
  characters: {
    title: "人物信息",
    subtitle: "姓名、性别、性格、境界、身份、角色身份、存活状态，以及更完整的人物关系与装备信息。",
  },
  powerSystem: {
    title: "境界体系",
    subtitle: "大境界名称、说明和可选的小境界划分，全部按中文结构化保存。",
  },
  factions: {
    title: "势力结构",
    subtitle: "宗门、国家、家族、公司、教会、军团、避难所等组织的一等结构卡片。",
  },
  maps: {
    title: "世界图册",
    subtitle: "按真实尺度展示地图、范围、多边形区域和节点坐标，支持作者手动修正并同步数据库。",
  },
};

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers ?? {}) } : options.headers,
    body: options.body,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

function isAliveStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return true;
  }
  return ["存活", "活着", "alive", "active", "true", "on", "生存"].includes(text);
}

function splitLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|[，,；;、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value == null) {
    return [];
  }
  return [String(value).trim()].filter(Boolean);
}

function joinLines(value) {
  return splitLines(value).join("\n");
}

function normalizeStatusLabel(value) {
  return isAliveStatus(value) ? "存活" : "死亡";
}

function normalizeFactionStatusLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "活跃";
  }
  const lower = text.toLowerCase();
  if (["active", "activated", "活跃", "正常", "存在"].includes(lower)) {
    return "活跃";
  }
  if (["潜伏", "hidden", "covert", "蛰伏"].includes(lower)) {
    return "潜伏";
  }
  if (["衰落", "declining", "declined", "式微"].includes(lower)) {
    return "衰落";
  }
  if (["中立", "neutral"].includes(lower)) {
    return "中立";
  }
  if (["解散", "disbanded", "disband"].includes(lower)) {
    return "解散";
  }
  if (["覆灭", "destroyed", "ruined", "灭亡"].includes(lower)) {
    return "覆灭";
  }
  return text;
}

function factionStatusTone(value) {
  const label = normalizeFactionStatusLabel(value);
  if (["活跃", "潜伏", "中立"].includes(label)) {
    return "alive";
  }
  if (["衰落"].includes(label)) {
    return "warn";
  }
  return "dead";
}

function characterDraft(character = {}) {
  return {
    name: character.name || "",
    gender: character.gender || "",
    personality: character.personality || "",
    realm: character.realm || "",
    identity: character.identity || "",
    role: character.role || "",
    status: normalizeStatusLabel(character.status),
    relationship_notes: character.relationship_notes || "",
    abilities_text: joinLines(character.abilities || []),
    equipment_text: joinLines(character.equipment || []),
    faction: character.faction || "",
    bloodline: character.bloodline || "",
  };
}

function draftToPatch(draft) {
  return {
    gender: draft.gender,
    personality: draft.personality,
    realm: draft.realm,
    identity: draft.identity,
    relationship_notes: draft.relationship_notes,
    abilities: splitLines(draft.abilities_text),
    equipment: splitLines(draft.equipment_text),
    faction: draft.faction,
    bloodline: draft.bloodline,
  };
}

function factionDraft(faction = {}) {
  return {
    name: faction.name || "",
    aliases_text: joinLines(faction.aliases || []),
    type: faction.type || "",
    level: faction.level || "",
    status: normalizeFactionStatusLabel(faction.status),
    parent_name: faction.parent_name || "",
    leader: faction.leader || "",
    location: faction.location || "",
    sphere: faction.sphere || "",
    summary: faction.summary || "",
    ideology: faction.ideology || "",
    resources: faction.resources || "",
    plot_notes: faction.plot_notes || "",
    core_members_text: joinLines(faction.core_members || []),
    allies_text: joinLines(faction.allies || []),
    enemies_text: joinLines(faction.enemies || []),
    sub_factions_text: joinLines(faction.sub_factions || []),
    locked_facts_text: joinLines(faction.locked_facts || []),
    tags_text: joinLines(faction.tags || []),
  };
}

function draftToFactionPatch(draft) {
  return {
    name: draft.name,
    aliases: splitLines(draft.aliases_text),
    type: draft.type,
    level: draft.level,
    status: draft.status,
    parent_name: draft.parent_name,
    leader: draft.leader,
    location: draft.location,
    sphere: draft.sphere,
    summary: draft.summary,
    ideology: draft.ideology,
    resources: draft.resources,
    plot_notes: draft.plot_notes,
    core_members: splitLines(draft.core_members_text),
    allies: splitLines(draft.allies_text),
    enemies: splitLines(draft.enemies_text),
    sub_factions: splitLines(draft.sub_factions_text),
    locked_facts: splitLines(draft.locked_facts_text),
    tags: splitLines(draft.tags_text),
  };
}

function powerStageDraft(stage = {}) {
  return {
    name: stage.name || stage.title || stage.level || stage.rank || "",
    description: stage.description || stage.desc || stage.summary || "",
  };
}

function powerTierDraft(tier = {}) {
  const stages = tier.stages || tier.sub_stages || tier.levels || tier.ranks || [];
  return {
    name: tier.name || tier.title || tier.level || tier.rank || tier.境界 || "",
    description: tier.description || tier.desc || tier.summary || tier.说明 || "",
    stages: Array.isArray(stages) ? stages.map((stage) => powerStageDraft(stage)) : [],
  };
}

function powerSystemDraft(powerSystem = {}) {
  const tiers = powerSystem.tiers || powerSystem.stages || powerSystem.levels || powerSystem.ranks || [];
  return {
    summary: powerSystem.summary || powerSystem.overview || powerSystem.说明 || "",
    tiers: Array.isArray(tiers) ? tiers.map((tier) => powerTierDraft(tier)) : [],
  };
}

function draftToPowerSystemPatch(draft) {
  return {
    summary: draft.summary,
    tiers: (draft.tiers || []).map((tier) => ({
      name: tier.name,
      description: tier.description,
      stages: (tier.stages || []).map((stage) => ({
        name: stage.name,
        description: stage.description,
      })),
    })),
  };
}

function powerTierLabel(tier, index) {
  return tier?.name?.trim() || `第 ${index + 1} 个大境界`;
}

function powerStageLabel(stage, index) {
  return stage?.name?.trim() || `第 ${index + 1} 个小境界`;
}

function projectTitle(project) {
  return project?.title || "未命名作品";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function numberOr(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function percentToScene(value, axis) {
  const max = axis === "x" ? MAP_SCENE.width : MAP_SCENE.height;
  return (clamp(numberOr(value, 50), 0, 100) / 100) * max;
}

function sceneToPercent(value, axis) {
  const max = axis === "x" ? MAP_SCENE.width : MAP_SCENE.height;
  return Math.round((clamp(value, 0, max) / max) * 1000) / 10;
}

function normalizeNodeShape(value) {
  const text = String(value || "point").trim().toLowerCase();
  return ["polygon", "area", "region", "zone", "范围", "区域", "多边形"].includes(text) ? "polygon" : "point";
}

function mapImageSource(image) {
  if (!image?.image_data) {
    return "";
  }
  const data = String(image.image_data);
  if (data === EMPTY_MAP_IMAGE_DATA) {
    return "";
  }
  if (data.startsWith("data:")) {
    return data;
  }
  return `data:${image.mime_type || "image/png"};base64,${data}`;
}

function mapExtentLabel(map) {
  const width = numberOr(map.realWidth, 0);
  const height = numberOr(map.realHeight, 0);
  if (!width || !height) {
    return "未设定面积";
  }
  const unit = map.distanceUnit || "里";
  return `${width} ${unit} × ${height} ${unit}`;
}

function mapAreaLabel(map) {
  const width = numberOr(map.realWidth, 0);
  const height = numberOr(map.realHeight, 0);
  if (!width || !height) {
    return "约 未设定";
  }
  const area = width * height;
  const rounded = area >= 100 ? Math.round(area) : Math.round(area * 10) / 10;
  const unit = map.distanceUnit || "里";
  return `约 ${rounded} ${unit}²`;
}

function displayMapTitle(map) {
  return String(map?.title || "世界图册").replace(/^演示[·:：]\s*/, "");
}

function mapCardTags(map) {
  return [
    String(map?.title || "").startsWith("演示·") ? "演示" : "",
    map?.scaleKind || "",
    map?.layer && map.layer !== map.scaleKind ? map.layer : "",
  ].filter(Boolean).slice(0, 3);
}

function formatDistance(value, unit) {
  const distance = Math.max(0, numberOr(value, 0));
  if (!distance) {
    return `0 ${unit || "里"}`;
  }
  if (distance >= 100) {
    return `${Math.round(distance)} ${unit || "里"}`;
  }
  if (distance >= 10) {
    return `${Math.round(distance * 10) / 10} ${unit || "里"}`;
  }
  return `${Math.round(distance * 100) / 100} ${unit || "里"}`;
}

function pointToScene(point) {
  return {
    x: percentToScene(point?.x, "x"),
    y: percentToScene(point?.y, "y"),
  };
}

function formatPolygonPoints(points = []) {
  if (!Array.isArray(points)) {
    return "";
  }
  return points
    .map((point) => `${numberOr(point?.x, 0)}, ${numberOr(point?.y, 0)}`)
    .join("\n");
}

function parsePolygonPoints(value) {
  const text = String(value || "").trim();
  if (!text) {
    return [];
  }
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((point) => ({ x: clamp(numberOr(point?.x, NaN), 0, 100), y: clamp(numberOr(point?.y, NaN), 0, 100) }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      }
    } catch {
      return [];
    }
  }
  return text
    .split(/\r?\n|[；;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [x, y] = line.split(/[，,\s]+/).filter(Boolean);
      return { x: clamp(numberOr(x, NaN), 0, 100), y: clamp(numberOr(y, NaN), 0, 100) };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function normalizeRgbColor(value, fallback = "") {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }
  const hex = text.match(/^#?([0-9a-fA-F]{6})$/);
  if (hex) {
    const raw = hex[1];
    return [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)].map((part) => parseInt(part, 16)).join(",");
  }
  const parts = text
    .split(/[，,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    return fallback;
  }
  const rgb = parts.slice(0, 3).map((part) => clamp(Math.round(numberOr(part, NaN)), 0, 255));
  if (rgb.some((part) => !Number.isFinite(part))) {
    return fallback;
  }
  return rgb.join(",");
}

function rgbParts(value, fallback = "120,146,185") {
  return normalizeRgbColor(value, fallback)
    .split(",")
    .map((part) => numberOr(part, 0));
}

function rgbCss(value, alpha = 1, fallback = "120,146,185") {
  const [r, g, b] = rgbParts(value, fallback);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rgbHex(value, fallback = "120,146,185") {
  const [r, g, b] = rgbParts(value, fallback);
  return `#${[r, g, b].map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`;
}

function mapAreaColorStyle(node, active = false, hasImage = false) {
  const color = normalizeRgbColor(node?.color || "", "");
  if (!color) {
    return undefined;
  }
  return {
    fill: rgbCss(color, active ? (hasImage ? 0.16 : 0.3) : hasImage ? 0.1 : 0.22),
    stroke: active ? "#8a3f34" : rgbCss(color, 0.9),
  };
}

function MapColorControl({ value, onChange, inputClassName = "mapInlineInput" }) {
  const normalized = normalizeRgbColor(value, "120,146,185");
  return (
    <div className="mapColorControl">
      <input
        className={inputClassName}
        value={normalizeRgbColor(value, normalized)}
        onChange={(event) => onChange(event.target.value)}
        placeholder="120,146,185"
        aria-label="区域颜色"
      />
      <label className="mapColorPicker" title="选择区域颜色">
        <span className="mapColorSwatch" style={{ background: rgbCss(normalized, 1), borderColor: rgbCss(normalized, 0.9) }} aria-hidden="true" />
        <input
          type="color"
          aria-label="选择区域颜色"
          value={rgbHex(normalized)}
          onChange={(event) => onChange(normalizeRgbColor(event.target.value, normalized))}
        />
      </label>
    </div>
  );
}

function mapNodeDraft(node = {}, map = {}) {
  return {
    id: node.id || null,
    map_image_id: node.map_image_id ?? map.imageId ?? null,
    name: node.name || "",
    type: node.type || "地点",
    shape: normalizeNodeShape(node.shape),
    layer: node.layer || map.layer || map.title || "",
    plane: node.plane || "",
    parent_name: node.parent_name || "",
    faction: node.faction || "",
    color: normalizeNodeShape(node.shape) === "polygon" ? normalizeRgbColor(node.color || "", "120,146,185") : "",
    x: node.x ?? 50,
    y: node.y ?? 50,
    description: node.description || "",
    polygon_points_text: formatPolygonPoints(node.polygon_points || []),
  };
}

function mapImageDraft(map = {}) {
  const scaleKind = mapScaleKinds.includes(map.scaleKind) ? map.scaleKind : "其他";
  return {
    image_id: map.imageId || null,
    title: displayMapTitle(map) === "世界图册" ? "新建地图" : displayMapTitle(map),
    layer: map.layer || scaleKind || "世界",
    parent_name: map.parentName || "",
    scope: map.scope || "",
    scale_label: map.scaleLabel || "",
    real_width: map.realWidth || "",
    real_height: map.realHeight || "",
    distance_unit: map.distanceUnit || "里",
    scale_kind: scaleKind,
    image_data: map.imageData || "",
    mime_type: map.mimeType || "image/png",
    notes: map.summary || "",
    file_name: "",
  };
}

function draftToMapImagePayload(draft, options = {}) {
  const imageData = options.keepEmptyImageData ? draft.image_data || "" : draft.image_data || EMPTY_MAP_IMAGE_DATA;
  return {
    title: draft.title.trim() || "新建地图",
    layer: draft.layer.trim() || draft.scale_kind.trim() || "世界",
    parent_name: draft.parent_name.trim(),
    scope: draft.scope.trim(),
    scale_label: draft.scale_label.trim(),
    real_width: Math.max(0, numberOr(draft.real_width, 0)),
    real_height: Math.max(0, numberOr(draft.real_height, 0)),
    distance_unit: draft.distance_unit.trim() || "里",
    scale_kind: draft.scale_kind.trim() || "世界",
    image_data: imageData,
    mime_type: draft.mime_type || "image/png",
    notes: draft.notes.trim(),
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mapImportTemplate() {
  return {
    version: 1,
    map_image: {
      title: "示例地图名称",
      layer: "世界",
      parent_name: "",
      scope: "这张地图展示的范围",
      scale_label: "1 格 = 100 万里",
      real_width: 1200,
      real_height: 750,
      distance_unit: "万里",
      scale_kind: "总览",
      mime_type: "image/png",
      image_data: "data:image/png;base64,...",
      notes: "地图说明",
    },
    map_nodes: [
      {
        name: "示例区域",
        type: "区域",
        shape: "polygon",
        layer: "世界",
        plane: "示例地图名称",
        parent_name: "",
        description: "区域说明",
        faction: "所属势力",
        color: "120,146,185",
        x: 30,
        y: 40,
        polygon_points: [
          { x: 18, y: 25 },
          { x: 42, y: 25 },
          { x: 45, y: 52 },
          { x: 22, y: 58 },
        ],
      },
      {
        name: "示例城市",
        type: "城市",
        shape: "point",
        layer: "世界",
        plane: "示例地图名称",
        parent_name: "示例区域",
        description: "点位说明",
        faction: "",
        x: 55,
        y: 45,
        polygon_points: [],
      },
    ],
  };
}

function mapToExportJson(map = {}) {
  return {
    version: 1,
    map_image: {
      title: displayMapTitle(map),
      layer: map.layer || "",
      parent_name: map.parentName || "",
      scope: map.scope || "",
      scale_label: map.scaleLabel || "",
      real_width: numberOr(map.realWidth, 0),
      real_height: numberOr(map.realHeight, 0),
      distance_unit: map.distanceUnit || "里",
      scale_kind: map.scaleKind || "",
      mime_type: map.mimeType || "image/png",
      image_data: map.imageData || "",
      notes: map.summary || "",
    },
    map_nodes: (map.nodes || []).map((node) => ({
      name: node.name || "",
      type: node.type || "地点",
      shape: normalizeNodeShape(node.shape),
      layer: node.layer || map.layer || "",
      plane: node.plane || displayMapTitle(map),
      parent_name: node.parent_name || "",
      description: node.description || "",
      faction: node.faction || "",
      color: normalizeRgbColor(node.color || "", ""),
      x: clamp(numberOr(node.x, 50), 0, 100),
      y: clamp(numberOr(node.y, 50), 0, 100),
      polygon_points: normalizeNodeShape(node.shape) === "polygon" ? node.polygon_points || [] : [],
    })),
  };
}

function normalizeImportedMapJson(input = {}) {
  const data = input.map_image ? input : { version: 1, map_image: input, map_nodes: input.map_nodes || [] };
  const image = data.map_image || {};
  const title = String(image.title || image.name || "导入地图").trim() || "导入地图";
  const mapDraftValue = {
    title,
    layer: String(image.layer || image.scale_kind || "世界"),
    parent_name: String(image.parent_name || image.parentName || ""),
    scope: String(image.scope || ""),
    scale_label: String(image.scale_label || image.scaleLabel || ""),
    real_width: numberOr(image.real_width ?? image.realWidth, 0),
    real_height: numberOr(image.real_height ?? image.realHeight, 0),
    distance_unit: String(image.distance_unit || image.distanceUnit || "里"),
    scale_kind: String(image.scale_kind || image.scaleKind || "世界"),
    image_data: String(image.image_data || image.imageData || EMPTY_MAP_IMAGE_DATA),
    mime_type: String(image.mime_type || image.mimeType || "image/png"),
    notes: String(image.notes || image.summary || ""),
  };
  const nodeDrafts = (Array.isArray(data.map_nodes) ? data.map_nodes : []).map((node) => ({
    name: String(node.name || "未命名节点"),
    type: String(node.type || "地点"),
    shape: normalizeNodeShape(node.shape || node.type),
    layer: String(node.layer || mapDraftValue.layer || ""),
    plane: String(node.plane || title),
    parent_name: String(node.parent_name || node.parentName || ""),
    description: String(node.description || ""),
    faction: String(node.faction || ""),
    color: normalizeRgbColor(node.color || node.color_rgb || node.rgb || "", ""),
    x: clamp(numberOr(node.x, 50), 0, 100),
    y: clamp(numberOr(node.y, 50), 0, 100),
    polygon_points_text: formatPolygonPoints(node.polygon_points || node.polygonPoints || []),
  }));
  return { mapDraft: mapDraftValue, nodeDrafts };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

function draftToMapNodePayload(draft) {
  const shape = normalizeNodeShape(draft.shape);
  const payload = {
    name: draft.name.trim() || "未命名节点",
    type: draft.type.trim() || "地点",
    shape,
    map_image_id: draft.map_image_id || null,
    layer: draft.layer.trim(),
    plane: draft.plane.trim(),
    parent_name: draft.parent_name.trim(),
    description: draft.description.trim(),
    faction: draft.faction.trim(),
    color: shape === "polygon" ? normalizeRgbColor(draft.color, "120,146,185") : "",
    x: clamp(numberOr(draft.x, 50), 0, 100),
    y: clamp(numberOr(draft.y, 50), 0, 100),
    polygon_points: shape === "polygon" ? parsePolygonPoints(draft.polygon_points_text) : [],
  };
  return payload;
}

function buildMapAtlas(world = {}) {
  const images = Array.isArray(world.map_images) ? world.map_images : [];
  const nodes = Array.isArray(world.map_nodes) ? world.map_nodes : [];
  const maps = images.map((image) => ({
    id: `image-${image.id}`,
    imageId: image.id,
    title: image.title || "世界地图",
    layer: image.layer || image.scale_kind || "世界",
    parentName: image.parent_name || "",
    scaleKind: image.scale_kind || image.layer || "世界",
    scope: image.scope || "",
    summary: image.notes || image.scope || "",
    realWidth: numberOr(image.real_width, 0),
    realHeight: numberOr(image.real_height, 0),
    distanceUnit: image.distance_unit || "里",
    scaleLabel: image.scale_label || "",
    mimeType: image.mime_type || "image/png",
    imageData: image.image_data || "",
    imageSrc: mapImageSource(image),
    nodes: nodes.filter((node) => node.map_image_id === image.id),
  }));

  const assignedImageIds = new Set(images.map((image) => image.id));
  const unassignedNodes = nodes.filter((node) => !assignedImageIds.has(node.map_image_id));
  if (unassignedNodes.length) {
    const groups = new Map();
    for (const node of unassignedNodes) {
      const key = node.layer || node.plane || "未分配地图";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(node);
    }
    for (const [key, groupNodes] of groups.entries()) {
      maps.push({
        id: `group-${key}`,
        imageId: null,
        title: key,
        layer: key,
        scaleKind: "资料图",
        scope: "",
        summary: "这些节点还没有绑定到具体地图图片或图册。",
        realWidth: 0,
        realHeight: 0,
        distanceUnit: "里",
        scaleLabel: "",
        mimeType: "image/png",
        imageData: "",
        imageSrc: "",
        nodes: groupNodes,
      });
    }
  }

  if (!maps.length) {
    maps.push({
      id: "empty-map",
      imageId: null,
      title: "世界图册",
      layer: "世界",
      scaleKind: "总览",
      scope: "",
      summary: "",
      realWidth: 0,
      realHeight: 0,
      distanceUnit: "里",
      scaleLabel: "",
      mimeType: "image/png",
      imageData: "",
      imageSrc: "",
      nodes: [],
    });
  }
  return maps;
}

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [factions, setFactions] = useState([]);
  const [activeView, setActiveView] = useState("characters");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedCharacterName, setSelectedCharacterName] = useState("");
  const [selectedFactionName, setSelectedFactionName] = useState("");
  const [factionDraftRevision, setFactionDraftRevision] = useState(0);

  const load = async () => {
    setError("");
    try {
      const [nextDashboard, nextFactions] = await Promise.all([api("/api/dashboard"), api("/api/factions")]);
      setDashboard(nextDashboard);
      setFactions(nextFactions);
      setLoading(false);
      if (!selectedCharacterName && nextDashboard?.characters?.length) {
        setSelectedCharacterName(nextDashboard.characters[0].name);
      }
      if (!selectedFactionName && nextFactions?.length) {
        setSelectedFactionName(nextFactions[0].name);
      }
    } catch (err) {
      setLoading(false);
      setError("后端未连接，请先启动 FastAPI 后端。");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const characters = dashboard?.characters ?? [];
  const world = dashboard?.world ?? {};
  const powerSystem = world?.power_system ?? {};
  const currentCharacter = useMemo(
    () => characters.find((character) => character.name === selectedCharacterName) || characters[0] || null,
    [characters, selectedCharacterName]
  );
  const currentFaction = useMemo(
    () => factions.find((faction) => faction.name === selectedFactionName) || null,
    [factions, selectedFactionName]
  );

  useEffect(() => {
    if (!characters.length) {
      if (selectedCharacterName) {
        setSelectedCharacterName("");
      }
      return;
    }
    if (selectedCharacterName === "__new__") {
      return;
    }
    if (!characters.some((character) => character.name === selectedCharacterName)) {
      setSelectedCharacterName(characters[0].name);
    }
  }, [characters, selectedCharacterName]);

  useEffect(() => {
    if (!factions.length) {
      if (selectedFactionName && selectedFactionName !== "__new__") {
        setSelectedFactionName("");
      }
      return;
    }
    if (selectedFactionName === "__new__") {
      return;
    }
    if (!factions.some((faction) => faction.name === selectedFactionName)) {
      setSelectedFactionName(factions[0].name);
    }
  }, [factions, selectedFactionName]);

  const syncPowerSystem = async (patch, reason) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/api/world/power-system", {
        method: "PATCH",
        body: JSON.stringify({ patch, reason }),
      });
      await load();
      setNotice("已同步到数据库。");
    } catch (err) {
      setError("保存境界体系失败，请检查后端是否可用。");
    } finally {
      setSaving(false);
    }
  };

  const syncCharacter = async (name, patch, reason) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api(`/api/characters/${encodeURIComponent(name)}`, {
        method: "PATCH",
        body: JSON.stringify({ patch, reason }),
      });
      if (result?.character) {
        setDashboard((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            characters: current.characters.map((character) => (character.name === result.character.name ? result.character : character)),
          };
        });
      }
      await load();
      setNotice("已同步到数据库。");
    } catch (err) {
      setError("保存失败，请检查后端是否可用。");
    } finally {
      setSaving(false);
    }
  };

  const syncFaction = async (draft, currentName) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = draftToFactionPatch(draft);
      if (currentName) {
        await api(`/api/factions/${encodeURIComponent(currentName)}`, {
          method: "PATCH",
          body: JSON.stringify({ patch: payload, reason: "浏览器手动修正势力" }),
        });
      } else {
        await api("/api/factions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await load();
      setSelectedFactionName(draft.name);
      setActiveView("factions");
      setNotice(currentName ? "已同步势力资料。" : "已创建势力。");
    } catch (err) {
      setError("保存势力失败，请检查后端是否可用。");
    } finally {
      setSaving(false);
    }
  };

  const deleteFaction = async (name) => {
    if (!name) {
      return;
    }
    const confirmed = window.confirm(`确定删除势力「${name}」吗？删除后无法直接恢复。`);
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/factions/${encodeURIComponent(name)}`, { method: "DELETE" });
      await load();
      setSelectedFactionName("");
      setNotice("已删除势力。");
    } catch (err) {
      setError("删除失败，请检查后端是否可用。");
    } finally {
      setSaving(false);
    }
  };

  const saveCharacter = async (draft) => {
    if (!currentCharacter) {
      return;
    }
    await syncCharacter(currentCharacter.name, draftToPatch(draft), "浏览器手动修正角色信息");
  };

  const toggleCharacterStatus = async (alive) => {
    if (!currentCharacter) {
      return;
    }
    await syncCharacter(currentCharacter.name, { status: alive ? "存活" : "死亡" }, "浏览器切换存活状态");
  };

  const updateCharacterRole = async (role) => {
    if (!currentCharacter) {
      return;
    }
    await syncCharacter(currentCharacter.name, { role }, "浏览器切换角色身份");
  };

  const savePowerSystem = async (draft) => {
    await syncPowerSystem(draftToPowerSystemPatch(draft), "浏览器手动修正境界体系");
  };

  const saveFaction = async (draft) => {
    if (!draft.name.trim()) {
      setError("请先填写势力名称。");
      return;
    }
    await syncFaction(draft, currentFaction?.name || "");
  };

  const saveMapNode = async (draft, currentNodeId) => {
    const payload = draftToMapNodePayload(draft);
    if (!payload.name.trim()) {
      setError("请先填写节点名称。");
      return null;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = currentNodeId
        ? await api(`/api/world/map-nodes/${currentNodeId}`, {
            method: "PATCH",
            body: JSON.stringify({ patch: payload, reason: "浏览器手动修正地图节点" }),
          })
        : await api("/api/world/map-nodes", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      await load();
      setNotice(currentNodeId ? "已同步地图节点。" : "已新增地图节点。");
      return result?.map_node || null;
    } catch (err) {
      setError("保存地图节点失败，请检查后端是否可用。");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteMapNode = async (node) => {
    if (!node?.id) {
      return false;
    }
    const confirmed = window.confirm(`确定删除地图节点「${node.name}」吗？删除后无法直接恢复。`);
    if (!confirmed) {
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/world/map-nodes/${node.id}`, { method: "DELETE" });
      await load();
      setNotice("已删除地图节点。");
      return true;
    } catch (err) {
      setError("删除地图节点失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteMapImage = async (map) => {
    const nodeIds = (map?.nodes || []).map((node) => node.id).filter(Boolean);
    if (!map?.imageId && !nodeIds.length) {
      return false;
    }
    const title = displayMapTitle(map);
    const confirmed = map.imageId
      ? window.confirm(`确定删除地图「${title}」吗？\n这会同时删除该地图中的区域、点位和节点数据，删除后无法直接恢复。`)
      : window.confirm(`确定删除资料图「${title}」吗？\n这会删除该分组下的 ${nodeIds.length} 个区域、点位和节点数据，删除后无法直接恢复。`);
    if (!confirmed) {
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (map.imageId) {
        await api(`/api/world/map-images/${map.imageId}`, { method: "DELETE" });
      } else {
        for (const nodeId of nodeIds) {
          await api(`/api/world/map-nodes/${nodeId}`, { method: "DELETE" });
        }
      }
      await load();
      setNotice("已删除地图及其中的区域、点位和节点数据。");
      return true;
    } catch (err) {
      setError("删除地图失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveMapImage = async (draft) => {
    const payload = draftToMapImagePayload(draft);
    if (!payload.title.trim()) {
      setError("请先填写地图名称。");
      return null;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api("/api/world/map-image", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await load();
      setNotice(payload.image_data === EMPTY_MAP_IMAGE_DATA ? "已新建地图。" : "已导入地图图片。");
      return result?.map_image || null;
    } catch (err) {
      setError("保存地图失败，请检查后端是否可用，或图片是否过大。");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateMapImage = async (imageId, draft, reason = "浏览器手动修正地图图片") => {
    const payload = draftToMapImagePayload(draft, { keepEmptyImageData: true });
    if (!imageId) {
      return saveMapImage(draft);
    }
    if (!payload.title.trim()) {
      setError("请先填写地图名称。");
      return null;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api(`/api/world/map-images/${imageId}`, {
        method: "PATCH",
        body: JSON.stringify({ patch: payload, reason }),
      });
      await load();
      setNotice(!payload.image_data ? "已删除地图图片，地图信息和节点已保留。" : "已更新地图图片。");
      return result?.map_image || null;
    } catch (err) {
      setError("更新地图图片失败，请检查后端是否可用，或图片是否过大。");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const createFaction = () => {
    setSelectedFactionName("__new__");
    setFactionDraftRevision((value) => value + 1);
    setActiveView("factions");
    setError("");
    setNotice("");
  };

  const activeMeta = viewMeta[activeView];

  return (
    <div className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">小说知识库</p>
          <h1>{activeMeta.title}</h1>
          <p className="subtle">
            {projectTitle(dashboard?.project)}，浏览器优先，手动修改与 LLM 写入都同步到同一份数据库。
          </p>
          <p className="subtle subtleSecondary">{activeMeta.subtitle}</p>
        </div>
        <div className="topbarActions">
        <div className="viewTabs" role="tablist" aria-label="页面切换">
          <button
            type="button"
            className={activeView === "characters" ? "viewTab active" : "viewTab"}
            onClick={() => setActiveView("characters")}
            >
              <UserRound size={16} />
              人物信息
            </button>
            <button
              type="button"
              className={activeView === "powerSystem" ? "viewTab active" : "viewTab"}
              onClick={() => setActiveView("powerSystem")}
            >
              <BookOpen size={16} />
              境界体系
            </button>
            <button
              type="button"
              className={activeView === "factions" ? "viewTab active" : "viewTab"}
              onClick={() => setActiveView("factions")}
            >
              <Shield size={16} />
              势力结构
            </button>
            <button
              type="button"
              className={activeView === "maps" ? "viewTab active" : "viewTab"}
              onClick={() => setActiveView("maps")}
            >
              <MapIcon size={16} />
              世界图册
            </button>
          </div>
          {activeView === "factions" ? (
            <button className="ghostButton" onClick={createFaction} disabled={loading || saving}>
              <Plus size={16} />
              新建势力
            </button>
          ) : null}
          <button className="ghostButton" onClick={load} disabled={loading || saving}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </header>

      {error ? <div className="banner errorBanner">{error}</div> : null}
      {notice ? <div className="banner noticeBanner">{notice}</div> : null}

      {loading ? (
        <main className="emptyState">
          <h2>正在读取资料</h2>
          <p>浏览器会直接读取后端数据库中的最新信息。</p>
        </main>
      ) : activeView === "characters" ? (
        <CharacterWorkspace
          characters={characters}
          currentCharacter={currentCharacter}
          selectedCharacterName={selectedCharacterName}
          setSelectedCharacterName={setSelectedCharacterName}
          saving={saving}
          onSave={saveCharacter}
          onToggleStatus={toggleCharacterStatus}
          onUpdateRole={updateCharacterRole}
        />
      ) : activeView === "powerSystem" ? (
        <PowerSystemWorkspace powerSystem={powerSystem} saving={saving} onSave={savePowerSystem} />
      ) : activeView === "maps" ? (
        <MapWorkspace
          world={world}
          saving={saving}
          onSaveNode={saveMapNode}
          onDeleteNode={deleteMapNode}
          onDeleteMap={deleteMapImage}
          onSaveMap={saveMapImage}
          onUpdateMap={updateMapImage}
        />
      ) : (
        <FactionWorkspace
          factions={factions}
          currentFaction={currentFaction}
          selectedFactionName={selectedFactionName}
          setSelectedFactionName={setSelectedFactionName}
          saving={saving}
          draftRevision={factionDraftRevision}
          onSave={saveFaction}
          onDelete={deleteFaction}
          onNew={createFaction}
        />
      )}
    </div>
  );
}

function CharacterWorkspace({
  characters,
  currentCharacter,
  selectedCharacterName,
  setSelectedCharacterName,
  saving,
  onSave,
  onToggleStatus,
  onUpdateRole,
}) {
  return (
    <main className="workspace">
      <aside className="characterListPanel">
        <div className="panelTitle">
          <span>
            <UserRound size={17} />
            角色列表
          </span>
          <span className="countBadge">{characters.length}</span>
        </div>
        <div className="characterList">
          {characters.length ? (
            characters.map((character) => (
              <button
                key={character.name}
                className={character.name === currentCharacter?.name ? "characterItem active" : "characterItem"}
                onClick={() => setSelectedCharacterName(character.name)}
              >
                <strong>{character.name}</strong>
                <small>{[character.role, character.realm].filter(Boolean).join(" · ") || "未记录角色身份"}</small>
                <span className={isAliveStatus(character.status) ? "statusBadge alive" : "statusBadge dead"}>
                  {normalizeStatusLabel(character.status)}
                </span>
              </button>
            ))
          ) : (
            <p className="muted">当前项目还没有角色数据。</p>
          )}
        </div>
      </aside>

      <section className="characterEditorPanel">
        {currentCharacter ? (
          <CharacterEditor
            key={currentCharacter.name}
            character={currentCharacter}
            saving={saving}
            onSave={onSave}
            onToggleStatus={onToggleStatus}
            onUpdateRole={onUpdateRole}
          />
        ) : (
          <div className="emptyPanel">
            <h2>还没有可编辑的人物</h2>
            <p>先通过初始化项目、导入角色卡，或让 LLM 写入角色。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function PowerSystemWorkspace({ powerSystem, saving, onSave }) {
  const [draft, setDraft] = useState(() => powerSystemDraft(powerSystem));
  const [selectedTierIndex, setSelectedTierIndex] = useState(null);
  const [expandedTierIndexes, setExpandedTierIndexes] = useState([]);
  const [overviewEditing, setOverviewEditing] = useState(false);

  useEffect(() => {
    const nextDraft = powerSystemDraft(powerSystem);
    setDraft(nextDraft);
    setSelectedTierIndex((current) => {
      if (current === null) {
        return null;
      }
      if (!nextDraft.tiers.length) {
        return null;
      }
      return Math.min(current, nextDraft.tiers.length - 1);
    });
    setExpandedTierIndexes([]);
    setOverviewEditing(false);
  }, [powerSystem]);

  const tiers = draft.tiers;
  const currentTier = selectedTierIndex !== null ? tiers[selectedTierIndex] || null : null;
  const showingOverview = selectedTierIndex === null;
  const showingTierEditor = selectedTierIndex !== null && !!currentTier;

  const setSummary = (value) => {
    setDraft((prev) => ({ ...prev, summary: value }));
  };

  const updateTier = (index, field, value) => {
    setDraft((prev) => {
      const tiersList = prev.tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, [field]: value } : tier));
      return { ...prev, tiers: tiersList };
    });
  };

  const updateStage = (tierIndex, stageIndex, field, value) => {
    setDraft((prev) => {
      const tiersList = prev.tiers.map((tier, currentIndex) => {
        if (currentIndex !== tierIndex) {
          return tier;
        }
        const stages = (tier.stages || []).map((stage, currentStageIndex) =>
          currentStageIndex === stageIndex ? { ...stage, [field]: value } : stage
        );
        return { ...tier, stages };
      });
      return { ...prev, tiers: tiersList };
    });
  };

  const addTier = () => {
    setDraft((prev) => ({
      ...prev,
      tiers: [...prev.tiers, { name: "", description: "", stages: [] }],
    }));
    setSelectedTierIndex(tiers.length);
  };

  const removeTier = (index) => {
    const target = tiers[index];
    if (!target) {
      return;
    }
    const confirmed = window.confirm(`确定删除境界「${target.name || `第 ${index + 1} 个大境界`}」吗？`);
    if (!confirmed) {
      return;
    }
    const nextLength = Math.max(tiers.length - 1, 0);
    setDraft((prev) => {
      const nextTiers = prev.tiers.filter((_, tierIndex) => tierIndex !== index);
      return { ...prev, tiers: nextTiers };
    });
    setSelectedTierIndex((current) => {
      if (nextLength === 0) {
        return null;
      }
      if (current === null) {
        return null;
      }
      if (current > index) {
        return Math.min(current - 1, nextLength - 1);
      }
      if (current === index) {
        return Math.min(index, nextLength - 1);
      }
      return Math.min(current, nextLength - 1);
    });
  };

  const addStage = (tierIndex) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, index) =>
        index === tierIndex ? { ...tier, stages: [...(tier.stages || []), { name: "", description: "" }] } : tier
      ),
    }));
  };

  const removeStage = (tierIndex, stageIndex) => {
    setDraft((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, index) => {
        if (index !== tierIndex) {
          return tier;
        }
        return {
          ...tier,
          stages: (tier.stages || []).filter((_, currentStageIndex) => currentStageIndex !== stageIndex),
        };
      }),
    }));
  };

  const toggleTierOpen = (index) => {
    setExpandedTierIndexes((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
    );
  };

  return (
    <main className="workspace">
      <aside className="characterListPanel powerListPanel">
        <div className="panelTitle">
          <span>
            <Layers3 size={17} />
            境界列表
          </span>
          <span className="countBadge">{tiers.length}</span>
        </div>
        <button
          type="button"
          className={showingOverview ? "characterItem powerOverviewItem active" : "characterItem powerOverviewItem"}
          onClick={() => setSelectedTierIndex(null)}
        >
          <strong>总览</strong>
          <small>{draft.summary || "还没有填写境界体系总览。"}</small>
          <span className="overviewBadge">{tiers.length ? `${tiers.length} 个大境界` : "尚未设定"}</span>
        </button>
        <div className="characterList powerList">
          {tiers.length ? (
            tiers.map((tier, index) => (
                <button
                key={`${tier.name || "tier"}-${index}`}
                className={index === selectedTierIndex ? "characterItem powerItem active" : "characterItem powerItem"}
                onClick={() => setSelectedTierIndex(index)}
              >
                <strong>{powerTierLabel(tier, index)}</strong>
                <small>{tier.description || "未填写说明"}</small>
                <small>{tier.stages?.length ? `小境界 ${tier.stages.length} 个` : "未划分小境界"}</small>
              </button>
            ))
          ) : (
            <p className="muted">当前项目还没有境界体系条目。</p>
          )}
        </div>
        <button className="ghostButton" onClick={addTier} disabled={saving}>
          <Plus size={16} />
          新增大境界
        </button>
      </aside>

      <section className="characterEditorPanel powerEditorPanel">
        {showingOverview ? (
          <article className="editorCard powerOverviewCard">
            <div className="powerOverviewHead">
              <div>
                <p className="eyebrow">总览</p>
                <h2>{draft.summary || "未命名境界体系"}</h2>
              </div>
              <div className="heroMeta powerOverviewActions">
                <span className="heroChip">{tiers.length ? `${tiers.length} 个大境界` : "尚未设定大境界"}</span>
                <button
                  className={overviewEditing ? "editButton active" : "editButton"}
                  type="button"
                  onClick={() => setOverviewEditing((current) => !current)}
                  disabled={saving}
                >
                  {overviewEditing ? "完成" : "编辑"}
                </button>
              </div>
            </div>

            <div className="powerOverviewEditor">
              {overviewEditing ? (
                <div className="summaryBox editing">
                  <div className="summaryLabel">境界体系总览</div>
                  <textarea
                    value={draft.summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="例如：修行者先炼气，再筑基，之后依次凝丹、元婴..."
                  />
                </div>
              ) : (
                <div className="summaryBox">
                  <div className="summaryLabel">境界体系总览</div>
                  <div className="summaryView">{draft.summary || "还没有填写境界体系总览。"}</div>
                </div>
              )}

              <div className="powerTableCard">
                <table className="powerRealmTable" aria-label="境界体系总览表">
                  <thead>
                    <tr>
                      <th className="col-realm">境界</th>
                      <th className="col-name">名称</th>
                      <th className="col-desc">说明</th>
                    </tr>
                  </thead>
              <tbody>
                    {tiers.length ? (
                      tiers.flatMap((tier, index) => {
                        const open = expandedTierIndexes.includes(index);
                        const rows = [
                          <tr
                            key={`tier-${index}`}
                            className={open ? "realmRow open" : "realmRow"}
                            onClick={() => toggleTierOpen(index)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggleTierOpen(index);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={open}
                          >
                            <td className="col-realm">
                              <span className="realmLabel">大境界</span>
                            </td>
                            <td className="col-name">
                              <strong className="realmName">{tier.name || `第 ${index + 1} 个大境界`}</strong>
                            </td>
                            <td className="col-desc">
                              <span className="realmDesc">{tier.description || "未填写说明"}</span>
                            </td>
                          </tr>,
                        ];
                        if (open) {
                          for (const [stageIndex, stage] of (tier.stages || []).entries()) {
                            rows.push(
                              <tr key={`tier-${index}-stage-${stageIndex}`} className="minorRealmRow">
                                <td className="col-realm">
                                  <span className="realmLabel minor">小境界</span>
                                </td>
                                <td className="col-name">
                                  <span className="realmName minor">{stage.name || `第 ${stageIndex + 1} 个小境界`}</span>
                                </td>
                                <td className="col-desc">
                                  <span className="realmDesc minor">{stage.description || "未填写说明"}</span>
                                </td>
                              </tr>
                            );
                          }
                        }
                        return rows;
                      })
                    ) : (
                      <tr>
                        <td className="emptyTableCell" colSpan={3}>
                          还没有境界体系条目。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        ) : showingTierEditor ? (
          <article className="editorCard">
            <div className="sectionHeader">
              <h3>当前大境界</h3>
              <p>名称、说明，以及可选的小境界划分。</p>
            </div>
            <div className="fieldGrid detailGrid powerTierGrid">
              <label>
                <span>大境界名称</span>
                <input value={currentTier.name} onChange={(event) => updateTier(selectedTierIndex, "name", event.target.value)} placeholder="如：炼气境" />
              </label>
              <label className="spanTwo">
                <span>大境界说明</span>
                <textarea
                  value={currentTier.description}
                  onChange={(event) => updateTier(selectedTierIndex, "description", event.target.value)}
                  placeholder="说明这个大境界的作用、修成后变化、进入条件等。"
                />
              </label>
            </div>

            <div className="sectionHeader sectionHeaderNested">
              <h3>小境界</h3>
              <p>可按初期、中期、后期，或者九重、十重这样的形式来写。</p>
            </div>
            <div className="stageList">
              {(currentTier.stages || []).length ? (
                currentTier.stages.map((stage, stageIndex) => (
                  <div className="stageRow" key={`${currentTier.name || "tier"}-${stageIndex}`}>
                    <div className="stageIndex">{stageIndex + 1}</div>
                    <label>
                      <span>名称</span>
                      <input
                        value={stage.name}
                        onChange={(event) => updateStage(selectedTierIndex, stageIndex, "name", event.target.value)}
                        placeholder="如：初期"
                      />
                    </label>
                    <label className="spanTwo">
                      <span>说明</span>
                      <textarea
                        value={stage.description}
                        onChange={(event) => updateStage(selectedTierIndex, stageIndex, "description", event.target.value)}
                        placeholder="写这一小境界的特点、突破节点、限制等。"
                      />
                    </label>
                    <button className="iconButton dangerIconButton" type="button" onClick={() => removeStage(selectedTierIndex, stageIndex)} disabled={saving}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">这个大境界还没有小境界划分。</p>
              )}
            </div>
            <button className="ghostButton" type="button" onClick={() => addStage(selectedTierIndex)} disabled={saving}>
              <Plus size={16} />
              新增小境界
            </button>

            <div className="saveBar">
              <button className="dangerButton" type="button" onClick={() => removeTier(selectedTierIndex)} disabled={saving}>
                <Trash2 size={16} />
                删除大境界
              </button>
              <button className="saveButton" type="button" onClick={() => onSave(draft)} disabled={saving}>
                保存境界体系
              </button>
            </div>
          </article>
        ) : (
          <article className="editorCard">
            <div className="emptyPanel nestedEmptyPanel">
              <h2>还没有可编辑的大境界</h2>
              <p>先在左侧新增或选择一个大境界。</p>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

function MapWorkspace({ world, saving, onSaveNode, onDeleteNode, onDeleteMap, onSaveMap, onUpdateMap = async () => null }) {
  const baseMaps = useMemo(() => buildMapAtlas(world), [world]);
  const viewportRef = useRef(null);
  const jsonInputRef = useRef(null);
  const toolbarImageInputRef = useRef(null);
  const mapImageEditPanelRef = useRef(null);
  const dragRef = useRef(null);
  const wheelHandlerRef = useRef(null);
  const [selectedMapId, setSelectedMapId] = useState(baseMaps[0]?.id || "");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [camera, setCamera] = useState({ x: 0, y: 0, w: MAP_SCENE.width, h: MAP_SCENE.height });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => mapNodeDraft({}, baseMaps[0]));
  const [editMessage, setEditMessage] = useState("");
  const [mapEditing, setMapEditing] = useState(false);
  const [mapDraft, setMapDraft] = useState(() => mapImageDraft());
  const [mapEditMessage, setMapEditMessage] = useState("");
  const [showAreas, setShowAreas] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showNodes, setShowNodes] = useState(true);
  const draftMapId = "draft-new-map";

  const maps = useMemo(() => {
    if (!mapEditing || mapDraft.image_id || selectedMapId !== draftMapId) {
      return baseMaps;
    }
    return [
      ...baseMaps,
      {
        id: draftMapId,
        imageId: null,
        title: mapDraft.title || "新建地图",
        layer: mapDraft.layer || mapDraft.scale_kind || "世界",
        parentName: mapDraft.parent_name || "",
        scaleKind: mapDraft.scale_kind || "世界",
        scope: mapDraft.scope || "",
        summary: mapDraft.notes || mapDraft.scope || "正在编辑新地图。",
        realWidth: numberOr(mapDraft.real_width, 0),
        realHeight: numberOr(mapDraft.real_height, 0),
        distanceUnit: mapDraft.distance_unit || "里",
        scaleLabel: mapDraft.scale_label || "",
        mimeType: mapDraft.mime_type || "image/png",
        imageData: mapDraft.image_data || "",
        imageSrc: mapImageSource({ image_data: mapDraft.image_data, mime_type: mapDraft.mime_type }),
        nodes: [],
      },
    ];
  }, [baseMaps, mapDraft, mapEditing, selectedMapId]);

  const activeMap = useMemo(() => maps.find((map) => map.id === selectedMapId) || maps[0], [maps, selectedMapId]);
  const nodes = activeMap?.nodes || [];
  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId) || nodes[0] || null, [nodes, selectedNodeId]);

  useEffect(() => {
    if (!maps.some((map) => map.id === selectedMapId)) {
      setSelectedMapId(maps[0]?.id || "");
    }
  }, [maps, selectedMapId]);

  useEffect(() => {
    if (!nodes.length) {
      setSelectedNodeId("");
      return;
    }
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    setCamera({ x: 0, y: 0, w: MAP_SCENE.width, h: MAP_SCENE.height });
    setEditing(false);
    setEditMessage("");
  }, [activeMap?.id]);

  useEffect(() => {
    if (!mapEditing) {
      return;
    }
    window.setTimeout(() => {
      mapImageEditPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  }, [mapEditing]);

  const viewportSize = () => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { width: rect?.width || 960, height: rect?.height || 600 };
  };

  const clampCamera = (next) => {
    const w = clamp(next.w, MAP_SCENE.width / 5, MAP_SCENE.width);
    const h = clamp(next.h, MAP_SCENE.height / 5, MAP_SCENE.height);
    return {
      x: clamp(next.x, 0, MAP_SCENE.width - w),
      y: clamp(next.y, 0, MAP_SCENE.height - h),
      w,
      h,
    };
  };

  const zoomAt = (factor, clientX, clientY) => {
    setCamera((current) => {
      const size = viewportSize();
      const rect = viewportRef.current?.getBoundingClientRect();
      const anchorX =
        rect && clientX != null ? current.x + ((clientX - rect.left) / size.width) * current.w : current.x + current.w / 2;
      const anchorY =
        rect && clientY != null ? current.y + ((clientY - rect.top) / size.height) * current.h : current.y + current.h / 2;
      const nextW = clamp(current.w * factor, MAP_SCENE.width / 5, MAP_SCENE.width);
      const nextH = clamp(current.h * factor, MAP_SCENE.height / 5, MAP_SCENE.height);
      const ratioX = nextW / current.w;
      const ratioY = nextH / current.h;
      return clampCamera({
        x: anchorX - (anchorX - current.x) * ratioX,
        y: anchorY - (anchorY - current.y) * ratioY,
        w: nextW,
        h: nextH,
      });
    });
  };

  wheelHandlerRef.current = (event) => {
    event.preventDefault();
    event.stopPropagation();
    zoomAt(event.deltaY > 0 ? 1.08 : 0.92, event.clientX, event.clientY);
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return undefined;
    }
    const handleWheel = (event) => {
      wheelHandlerRef.current?.(event);
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [activeMap?.id]);

  const resetCamera = () => {
    setCamera({ x: 0, y: 0, w: MAP_SCENE.width, h: MAP_SCENE.height });
  };

  const startEditing = () => {
    setDraft(mapNodeDraft(selectedNode || {}, activeMap));
    setEditing(true);
    setEditMessage("");
  };

  const cancelNodeEditing = () => {
    setEditing(false);
    setEditMessage("");
  };

  const startNewNode = () => {
    const node = {
      name: "新建节点",
      type: "地点",
      shape: "point",
      map_image_id: activeMap?.imageId ?? null,
      layer: activeMap?.layer || activeMap?.title || "",
      x: sceneToPercent(camera.x + camera.w / 2, "x"),
      y: sceneToPercent(camera.y + camera.h / 2, "y"),
      description: "作者手动新增的地图节点。",
    };
    setDraft(mapNodeDraft(node, activeMap));
    setEditing(true);
    setEditMessage("正在新增节点");
    setMapEditing(false);
  };

  const setDraftField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const startNewMap = () => {
    setMapDraft(mapImageDraft({ title: "新建地图", layer: "世界", scaleKind: "世界" }));
    setSelectedMapId(draftMapId);
    setMapEditing(true);
    setEditing(false);
    setMapEditMessage("正在新建地图，可先填写资料，也可选择图片。");
  };

  const selectMap = (mapId) => {
    setSelectedMapId(mapId);
    setEditing(false);
    if (mapId !== selectedMapId) {
      setMapEditing(false);
      setMapEditMessage("");
      setMapDraft(mapImageDraft());
    }
  };

  const startMapEditing = () => {
    setMapDraft(mapImageDraft(activeMap || { title: "新建地图", layer: "世界", scaleKind: "世界" }));
    setMapEditing(true);
    setEditing(false);
    setMapEditMessage(activeMap?.imageId ? "正在编辑当前地图资料。" : "这是一组未绑定图片的地图资料，保存后会生成正式地图卡片。");
  };

  const cancelMapEditing = () => {
    const wasNewMapDraft = selectedMapId === draftMapId && !mapDraft.image_id;
    setMapEditing(false);
    setMapEditMessage("");
    setMapDraft(mapImageDraft());
    if (wasNewMapDraft) {
      setSelectedMapId(baseMaps[0]?.id || "");
    }
  };

  const startImportMapImage = () => {
    setMapDraft(mapImageDraft(activeMap || { title: "导入地图图片", layer: "世界", scaleKind: "世界" }));
    setMapEditing(true);
    setEditing(false);
    setMapEditMessage(activeMap?.imageId ? "请选择本地图片，保存后会替换当前地图图片，节点和区域会保留。" : "请先选择本地图片，再填写这张地图的尺度与说明。");
  };

  const triggerToolbarMapImageInput = () => {
    startImportMapImage();
    toolbarImageInputRef.current?.click();
  };

  const setMapDraftField = (field, value) => {
    setMapDraft((current) => ({ ...current, [field]: value }));
  };

  const applySelectedMapFile = async (file, baseDraft = mapDraft) => {
    if (!file) {
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setMapDraft((current) => ({
      ...baseDraft,
      ...current,
      title:
        current.title === "新建地图" || current.title === "导入地图图片"
          ? file.name.replace(/\.[^.]+$/, "")
          : current.title || baseDraft.title || file.name.replace(/\.[^.]+$/, ""),
      image_data: dataUrl,
      mime_type: file.type || "image/png",
      file_name: file.name,
    }));
    setMapEditMessage(`已选择图片：${file.name}`);
  };

  const handleToolbarMapFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const baseDraft = mapImageDraft(activeMap || { title: "导入地图图片", layer: "世界", scaleKind: "世界" });
    setMapDraft(baseDraft);
    setMapEditing(true);
    setEditing(false);
    await applySelectedMapFile(file, baseDraft);
  };

  const handleMapFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    await applySelectedMapFile(file);
  };

  const saveMapDraft = async () => {
    const isDraftNewMap = selectedMapId === draftMapId && !mapDraft.image_id;
    const shouldBindCurrentGroup = !isDraftNewMap && !mapDraft.image_id && !activeMap?.imageId && nodes.length > 0;
    const savedMap = mapDraft.image_id ? await onUpdateMap(mapDraft.image_id, mapDraft, "浏览器导入或替换地图图片") : await onSaveMap(mapDraft);
    if (savedMap?.id) {
      if (shouldBindCurrentGroup) {
        for (const node of nodes) {
          await onSaveNode(
            {
              ...mapNodeDraft(node, { ...activeMap, imageId: savedMap.id }),
              map_image_id: savedMap.id,
              layer: node.layer || mapDraft.layer,
              plane: node.plane || mapDraft.title,
            },
            node.id
          );
        }
      }
      setSelectedMapId(`image-${savedMap.id}`);
      setMapEditing(false);
      setMapEditMessage("");
      setMapDraft(mapImageDraft());
    }
  };

  const clearActiveMapImage = async () => {
    if (!activeMap?.imageId) {
      return;
    }
    const confirmed = window.confirm(`确定只删除「${displayMapTitle(activeMap)}」的图片吗？\n地图名称、尺度、区域和节点都会保留。`);
    if (!confirmed) {
      return;
    }
    const draftValue = {
      ...mapImageDraft(activeMap),
      image_data: "",
      mime_type: "image/png",
    };
    await onUpdateMap(activeMap.imageId, draftValue, "浏览器删除地图图片但保留地图资料");
  };

  const saveDraft = async () => {
    const savedNode = await onSaveNode(draft, draft.id);
    if (savedNode?.id) {
      setSelectedNodeId(savedNode.id);
      setDraft(mapNodeDraft(savedNode, activeMap));
    }
    if (draft.id) {
      setEditing(false);
      setEditMessage("已保存地图信息。");
    } else {
      setEditMessage("已保存");
    }
  };

  const deleteSelectedNode = async () => {
    if (!selectedNode) {
      return;
    }
    const deleted = await onDeleteNode(selectedNode);
    if (deleted) {
      setSelectedNodeId("");
      setEditing(false);
      setEditMessage("");
    }
  };

  const deleteActiveMap = async () => {
    if (!activeMap?.imageId && !nodes.length) {
      return;
    }
    const deleted = await onDeleteMap(activeMap);
    if (deleted) {
      setSelectedMapId("");
      setSelectedNodeId("");
      setEditing(false);
      setEditMessage("");
    }
  };

  const exportActiveMapJson = () => {
    if (!activeMap) {
      return;
    }
    downloadJson(`${displayMapTitle(activeMap)}-地图.json`, mapToExportJson(activeMap));
  };

  const downloadMapTemplateJson = () => {
    downloadJson("地图导入模板.json", mapImportTemplate());
  };

  const triggerMapJsonImport = () => {
    jsonInputRef.current?.click();
  };

  const handleMapJsonImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    try {
      const json = await readJsonFile(file);
      const { mapDraft: importedMapDraft, nodeDrafts } = normalizeImportedMapJson(json);
      const savedMap = await onSaveMap(importedMapDraft);
      if (!savedMap?.id) {
        setMapEditMessage("导入地图失败，未能创建地图。");
        return;
      }
      for (const nodeDraft of nodeDrafts) {
        await onSaveNode({ ...nodeDraft, map_image_id: savedMap.id }, null);
      }
      setSelectedMapId(`image-${savedMap.id}`);
      setMapEditing(false);
      setEditing(false);
      setMapEditMessage(`已导入 JSON：${file.name}`);
    } catch (error) {
      setMapEditMessage("导入 JSON 失败，请检查文件格式。");
    }
  };

  const onViewportPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onViewportPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    const size = viewportSize();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setCamera(
      clampCamera({
        ...drag.camera,
        x: drag.camera.x - (dx / size.width) * drag.camera.w,
        y: drag.camera.y - (dy / size.height) * drag.camera.h,
      })
    );
  };

  const onViewportPointerEnd = () => {
    dragRef.current = null;
  };

  const gridLines = useMemo(() => {
    const minor = [];
    const major = [];
    for (let x = 0; x <= MAP_SCENE.width; x += 20) {
      (x % 40 === 0 ? major : minor).push({ key: `x-${x}`, x1: x, y1: 0, x2: x, y2: MAP_SCENE.height });
    }
    for (let y = 0; y <= MAP_SCENE.height; y += 20) {
      (y % 40 === 0 ? major : minor).push({ key: `y-${y}`, x1: 0, y1: y, x2: MAP_SCENE.width, y2: y });
    }
    return { minor, major };
  }, []);

  const viewportWidth = viewportRef.current?.getBoundingClientRect().width || 960;
  const zoom = MAP_SCENE.width / camera.w;
  const scaleDistance = activeMap?.realWidth
    ? activeMap.realWidth * (camera.w / MAP_SCENE.width) * (SCALE_BAR_TARGET_PX / viewportWidth)
    : 0;
  const polygonNodes = nodes.filter((node) => normalizeNodeShape(node.shape) === "polygon" && node.polygon_points?.length);
  const pointNodes = nodes.filter((node) => normalizeNodeShape(node.shape) !== "polygon" || !node.polygon_points?.length);
  const routePairs = pointNodes.slice(0, 8).flatMap((node, index, list) => (list[index + 1] ? [[node, list[index + 1]]] : []));
  const selectedIsArea = Boolean(selectedNode && normalizeNodeShape(selectedNode.shape) === "polygon");
  const hasMapImage = Boolean(activeMap?.imageId && activeMap?.imageData && activeMap.imageData !== EMPTY_MAP_IMAGE_DATA);

  return (
    <main className="workspace mapWorkspace">
      <aside className="characterListPanel mapAtlasPanel">
        <div className="panelTitle">
          <span>
            <MapIcon size={17} />
            图册列表
          </span>
          <span className="countBadge">{maps.length}</span>
        </div>
        <div className="characterList mapAtlasList">
          {maps.map((map) => (
            <button
              key={map.id}
              type="button"
              className={map.id === activeMap?.id ? "characterItem mapAtlasItem active" : "characterItem mapAtlasItem"}
              onClick={() => selectMap(map.id)}
            >
              <span className="mapAtlasChips">
                {mapCardTags(map).map((tag) => (
                  <span key={`${map.id}-${tag}`} className="chip">
                    {tag}
                  </span>
                ))}
              </span>
              <strong>{displayMapTitle(map)}</strong>
              <small>{mapExtentLabel(map)}</small>
              <span className="overviewBadge">{mapAreaLabel(map)}</span>
              <small className="mapAtlasSummary">{map.summary || map.scope || "这张地图还没有说明。"}</small>
            </button>
          ))}
        </div>
        <button className="ghostButton mapNewButton" type="button" onClick={startNewNode} disabled={saving}>
          <Plus size={16} />
          新增节点
        </button>
        <button className="saveButton mapNewButton" type="button" onClick={startNewMap} disabled={saving}>
          <ImagePlus size={16} />
          新建地图
        </button>
        <button className="ghostButton mapNewButton" type="button" onClick={triggerMapJsonImport} disabled={saving}>
          <Upload size={16} />
          导入JSON
        </button>
        <button className="ghostButton mapNewButton" type="button" onClick={downloadMapTemplateJson} disabled={saving}>
          模板JSON
        </button>
        <input ref={jsonInputRef} className="hiddenFileInput" type="file" accept="application/json,.json" onChange={handleMapJsonImport} />
      </aside>

      <section className="characterEditorPanel mapEditorPanel">
        <article className="editorCard mapCanvasCard">
          <div className="mapHeader">
            <div>
              <p className="eyebrow">
                {[activeMap?.scaleKind || "世界图册", activeMap?.scope, mapExtentLabel(activeMap)].filter(Boolean).join(" · ")}
              </p>
              <h2>{displayMapTitle(activeMap)}</h2>
              <p className="subtle">{activeMap?.summary || "当前地图还没有说明。"}</p>
            </div>
            <div className="mapToolbar">
              <button className="ghostButton" type="button" onClick={() => zoomAt(1.14)} disabled={saving}>
                缩小
              </button>
              <button className="ghostButton" type="button" onClick={() => zoomAt(0.86)} disabled={saving}>
                放大
              </button>
              <button className="ghostButton" type="button" onClick={resetCamera} disabled={saving}>
                复位
              </button>
              <button className="ghostButton" type="button" onClick={triggerToolbarMapImageInput} disabled={saving}>
                <Upload size={16} />
                导入图片
              </button>
              <input ref={toolbarImageInputRef} className="hiddenFileInput" type="file" accept="image/*" onChange={handleToolbarMapFileChange} />
              <button className="ghostButton" type="button" onClick={exportActiveMapJson} disabled={saving || !activeMap}>
                导出JSON
              </button>
              {hasMapImage ? (
                <button className="ghostButton mapClearImageButton" type="button" onClick={clearActiveMapImage} disabled={saving}>
                  <Trash2 size={16} />
                  删除图片
                </button>
              ) : null}
              {activeMap?.imageId || nodes.length ? (
                <button className="dangerButton mapDeleteButton" type="button" onClick={deleteActiveMap} disabled={saving}>
                  <Trash2 size={16} />
                  删除地图
                </button>
              ) : null}
            </div>
          </div>

          <div className="mapLayerSwitches" aria-label="地图显示控制">
            <button
              type="button"
              className={showAreas ? "mapLayerButton active" : "mapLayerButton inactive"}
              onClick={() => setShowAreas((value) => !value)}
              aria-pressed={showAreas}
            >
              势力范围
            </button>
            <button type="button" className="mapLayerButton displayOnly" aria-disabled="true">
              路线
            </button>
            <button type="button" className="mapLayerButton displayOnly" aria-disabled="true">
              节点
            </button>
          </div>

          <div
            className={activeMap?.imageSrc ? "mapViewport hasImage" : "mapViewport"}
            ref={viewportRef}
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={onViewportPointerEnd}
            onPointerLeave={onViewportPointerEnd}
          >
            <svg className="mapSvg" viewBox={`${camera.x} ${camera.y} ${camera.w} ${camera.h}`} role="img" aria-label="世界图册地图">
              <rect width={MAP_SCENE.width} height={MAP_SCENE.height} className="mapBackdrop" />
              {activeMap?.imageSrc ? (
                <image
                  href={activeMap.imageSrc}
                  x="0"
                  y="0"
                  width={MAP_SCENE.width}
                  height={MAP_SCENE.height}
                  preserveAspectRatio="xMidYMid slice"
                  className="mapBackgroundImage"
                />
              ) : null}
              <g className="mapGridLayer">
                {gridLines.minor.map((line) => (
                  <line key={line.key} {...line} className="minorGridLine" />
                ))}
                {gridLines.major.map((line) => (
                  <line key={line.key} {...line} className="majorGridLine" />
                ))}
              </g>
              {showAreas ? (
                <g className="mapPolygonLayer">
                  {polygonNodes.map((node) => {
                    const points = (node.polygon_points || []).map(pointToScene);
                    const pointText = points.map((point) => `${point.x},${point.y}`).join(" ");
                    const center = pointToScene({ x: node.x, y: node.y });
                    const active = node.id === selectedNode?.id;
                    return (
                      <g
                        key={node.id}
                        className={active ? "mapArea active" : "mapArea"}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setEditing(false);
                        }}
                      >
                        <polygon points={pointText} style={mapAreaColorStyle(node, active, hasMapImage)} />
                        <text x={center.x} y={center.y}>{node.name}</text>
                      </g>
                    );
                  })}
                </g>
              ) : null}
              {showRoutes ? (
                <g className="mapRouteLayer">
                  {routePairs.map(([from, to]) => {
                    const start = pointToScene(from);
                    const end = pointToScene(to);
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2 - 90;
                    return (
                      <path
                        key={`${from.id}-${to.id}`}
                        d={`M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`}
                      />
                    );
                  })}
                </g>
              ) : null}
              {showNodes ? (
                <g className="mapNodeLayer">
                  {pointNodes.map((node) => {
                    const point = pointToScene(node);
                    const active = node.id === selectedNode?.id;
                    return (
                      <g
                        key={node.id}
                        className={active ? "mapNode active" : "mapNode"}
                        transform={`translate(${point.x} ${point.y})`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setEditing(false);
                        }}
                      >
                        <circle r={active ? 13 : 10} />
                        <text x="16" y="5">{node.name}</text>
                      </g>
                    );
                  })}
                </g>
              ) : null}
            </svg>
            <div className="mapScaleHud">
              <div className="scaleBarLine" style={{ width: SCALE_BAR_TARGET_PX }} />
              <strong>{scaleDistance ? formatDistance(scaleDistance, activeMap?.distanceUnit || "里") : "未设定比例"}</strong>
              <span>{Math.round(zoom * 100)}% 缩放</span>
            </div>
          </div>
        </article>

        <article className="editorCard mapDetailCard">
          <div className="mapInfoGrid">
            <section className={mapEditing ? "mapInfoCard mapImageEditPanel editing" : "mapInfoCard"} ref={mapEditing ? mapImageEditPanelRef : null}>
              <div className="panelTitle">
                <h3>当前地图说明</h3>
                <span className="cardActions">
                  {!mapEditing ? (
                    <button className="ghostButton compactButton" type="button" onClick={startMapEditing} disabled={saving || !activeMap} aria-label="编辑地图信息">
                      <Pencil size={15} />
                      编辑
                    </button>
                  ) : null}
                </span>
              </div>
              {mapEditing ? (
                <>
                  {mapEditMessage ? <p className="inlineSaveNotice">{mapEditMessage}</p> : null}
                  <div className="fieldGrid detailGrid compactMapForm">
                    <label>
                      <span>地图名称</span>
                      <input value={mapDraft.title} onChange={(event) => setMapDraftField("title", event.target.value)} placeholder="如：东玄道域局部图" />
                    </label>
                    <label>
                      <span>层级</span>
                      <select value={mapDraft.scale_kind} onChange={(event) => setMapDraftField("scale_kind", event.target.value)}>
                        {mapScaleKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>图册分类</span>
                      <input value={mapDraft.layer} onChange={(event) => setMapDraftField("layer", event.target.value)} placeholder="世界 / 区域 / 城市" />
                    </label>
                    <label>
                      <span>上级地图</span>
                      <input value={mapDraft.parent_name} onChange={(event) => setMapDraftField("parent_name", event.target.value)} placeholder="可选" />
                    </label>
                    <label>
                      <span>横向范围</span>
                      <input type="number" min="0" step="1" value={mapDraft.real_width} onChange={(event) => setMapDraftField("real_width", event.target.value)} />
                    </label>
                    <label>
                      <span>纵向范围</span>
                      <input type="number" min="0" step="1" value={mapDraft.real_height} onChange={(event) => setMapDraftField("real_height", event.target.value)} />
                    </label>
                    <label>
                      <span>距离单位</span>
                      <input value={mapDraft.distance_unit} onChange={(event) => setMapDraftField("distance_unit", event.target.value)} placeholder="里 / 万里 / 公里" />
                    </label>
                    <label>
                      <span>标度文字</span>
                      <input value={mapDraft.scale_label} onChange={(event) => setMapDraftField("scale_label", event.target.value)} placeholder="可选，如：1 格 = 10 万里" />
                    </label>
                    <label className="spanTwo">
                      <span>地图范围说明</span>
                      <input value={mapDraft.scope} onChange={(event) => setMapDraftField("scope", event.target.value)} placeholder="这张地图覆盖的区域" />
                    </label>
                    <label className="spanTwo">
                      <span>导入图片</span>
                      <span className="mapUploadBox">
                        <Upload size={18} />
                        <strong>{mapDraft.file_name || (mapDraft.image_data ? "已有地图图片" : "选择本地图片")}</strong>
                        <small>图片只作为背景，节点、区域和 JSON 数据都会保留。</small>
                        <input type="file" accept="image/*" onChange={handleMapFileChange} />
                      </span>
                    </label>
                    {mapDraft.image_data ? (
                      <div className="mapImagePreview spanTwo">
                        <img src={mapDraft.image_data} alt="地图预览" />
                        <span>{mapDraft.mime_type}</span>
                      </div>
                    ) : null}
                    <label className="spanTwo">
                      <span>说明</span>
                      <textarea value={mapDraft.notes} onChange={(event) => setMapDraftField("notes", event.target.value)} placeholder="写这张地图展示的范围、用途和注意事项。" />
                    </label>
                  </div>
                  <div className="saveBar inlineSaveBar">
                    <button className="ghostButton" type="button" onClick={cancelMapEditing} disabled={saving}>
                      取消
                    </button>
                    <button className="saveButton" type="button" onClick={saveMapDraft} disabled={saving || !mapDraft.title.trim()}>
                      保存地图
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="note">{activeMap?.summary || "当前地图还没有说明。"}</p>
                  <div className="keyValueList">
                    <div className="kv">
                      <span>地图名称</span>
                      <strong>{displayMapTitle(activeMap)}</strong>
                    </div>
                    <div className="kv">
                      <span>真实尺度</span>
                      <strong>
                        {mapExtentLabel(activeMap)}
                        {activeMap?.realWidth && activeMap?.realHeight ? `（${mapAreaLabel(activeMap)}）` : ""}
                      </strong>
                    </div>
                    <div className="kv">
                      <span>图层提示</span>
                      <div>
                        {[activeMap?.layer, activeMap?.scope, `当前层级显示 ${nodes.length} 个节点`, polygonNodes.length ? `${polygonNodes.length} 个范围` : ""]
                          .filter(Boolean)
                          .join("、")}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className={editing && draft.id ? "mapInfoCard editing" : "mapInfoCard"}>
              <div className="panelTitle">
                <h3>{selectedIsArea ? "选中区域" : "选中节点"}</h3>
                <span className="cardActions">
                  {selectedNode && !editing ? (
                    <button
                      className="ghostButton compactButton"
                      type="button"
                      onClick={startEditing}
                      disabled={saving}
                      aria-label={selectedIsArea ? "编辑区域" : "编辑节点"}
                    >
                      <Pencil size={15} />
                      编辑
                    </button>
                  ) : null}
                </span>
              </div>
              {editMessage && !editing ? <p className="inlineSaveNotice">{editMessage}</p> : null}
              {selectedNode ? (
                <>
                  <div className="keyValueList">
                    <div className="kv">
                      <span>名称</span>
                      {editing && draft.id ? (
                        <input className="mapInlineInput" value={draft.name} onChange={(event) => setDraftField("name", event.target.value)} />
                      ) : (
                        <strong>{selectedNode.name}</strong>
                      )}
                    </div>
                    {!selectedIsArea || editing ? (
                      <div className="kv">
                        <span>{selectedIsArea ? "中心位置" : "位置"}</span>
                        {editing && draft.id ? (
                          <div className="mapInlinePair">
                            <input
                              className="mapInlineInput"
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={draft.x}
                              onChange={(event) => setDraftField("x", event.target.value)}
                              aria-label="横向坐标 x"
                            />
                            <input
                              className="mapInlineInput"
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={draft.y}
                              onChange={(event) => setDraftField("y", event.target.value)}
                              aria-label="纵向坐标 y"
                            />
                          </div>
                        ) : (
                          <strong>
                            x {selectedNode.x ?? "-"}，y {selectedNode.y ?? "-"}
                          </strong>
                        )}
                      </div>
                    ) : null}
                    {selectedIsArea || (editing && draft.id && draft.shape === "polygon") ? (
                      <div className="kv">
                        <span>所属势力</span>
                        {editing && draft.id ? (
                          <input className="mapInlineInput" value={draft.faction} onChange={(event) => setDraftField("faction", event.target.value)} />
                        ) : (
                          <div>{selectedNode.faction || "未记录"}</div>
                        )}
                      </div>
                    ) : null}
                    {selectedIsArea || (editing && draft.id && draft.shape === "polygon") ? (
                      <div className="kv">
                        <span>区域颜色</span>
                        {editing && draft.id ? (
                          <MapColorControl value={draft.color} onChange={(value) => setDraftField("color", value)} />
                        ) : (
                          <div className="mapColorReadout">
                            <span
                              className="mapColorSwatch"
                              style={{ background: rgbCss(selectedNode.color, 1), borderColor: rgbCss(selectedNode.color, 0.9) }}
                              aria-hidden="true"
                            />
                            <strong>{normalizeRgbColor(selectedNode.color, "120,146,185")}</strong>
                          </div>
                        )}
                      </div>
                    ) : null}
                    {selectedIsArea ? (
                      <div className="kv">
                        <span>区域顶点</span>
                        {editing && draft.id ? (
                          <textarea
                            className="mapInlineTextarea"
                            value={draft.polygon_points_text}
                            onChange={(event) => setDraftField("polygon_points_text", event.target.value)}
                            placeholder={"每行一个点：x, y\n例如：20, 30\n45, 25\n60, 50"}
                          />
                        ) : (
                          <div className="vertexList">
                            {(selectedNode.polygon_points || []).length ? (
                              (selectedNode.polygon_points || []).map((point, index) => (
                                <span key={`${selectedNode.id}-vertex-${index}`}>
                                  顶点 {index + 1}: x {point.x}，y {point.y}
                                </span>
                              ))
                            ) : (
                              <span>还没有记录区域顶点。</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {editing && draft.id ? (
                      <div className="kv">
                        <span>显示方式</span>
                        <select className="mapInlineInput" value={draft.shape} onChange={(event) => setDraftField("shape", event.target.value)}>
                          <option value="point">点位</option>
                          <option value="polygon">范围多边形</option>
                        </select>
                      </div>
                    ) : null}
                    {editing && draft.id && draft.shape === "polygon" && !selectedIsArea ? (
                      <div className="kv">
                        <span>区域顶点</span>
                        <textarea
                          className="mapInlineTextarea"
                          value={draft.polygon_points_text}
                          onChange={(event) => setDraftField("polygon_points_text", event.target.value)}
                          placeholder={"每行一个点：x, y\n例如：20, 30\n45, 25\n60, 50"}
                        />
                      </div>
                    ) : null}
                    <div className="kv">
                      <span>说明</span>
                      {editing && draft.id ? (
                        <textarea className="mapInlineTextarea" value={draft.description} onChange={(event) => setDraftField("description", event.target.value)} />
                      ) : (
                        <div>{selectedNode.description || "还没有说明。"}</div>
                      )}
                    </div>
                  </div>
                  {editing && draft.id ? (
                    <div className="saveBar inlineSaveBar">
                      <button className="dangerButton" type="button" onClick={deleteSelectedNode} disabled={saving} aria-label={selectedIsArea ? "删除区域" : "删除节点"}>
                        <Trash2 size={16} />
                        {selectedIsArea ? "删除区域" : "删除节点"}
                      </button>
                      <button className="ghostButton" type="button" onClick={cancelNodeEditing} disabled={saving}>
                        取消
                      </button>
                      <button className="saveButton" type="button" onClick={saveDraft} disabled={saving || !draft.name.trim()}>
                        保存
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="note">点击地图中的节点查看详情。</p>
              )}
            </section>
          </div>

          {editing && !draft.id ? (
            <section className="mapEditPanel">
              <div className="sectionHeader">
                <h3>{draft.id ? "手动编辑节点" : "手动新增节点"}</h3>
                <p>{editMessage || "作者修正会直接写回数据库。"}</p>
              </div>
              <div className="fieldGrid detailGrid">
                <label>
                  <span>节点名称</span>
                  <input value={draft.name} onChange={(event) => setDraftField("name", event.target.value)} />
                </label>
                <label>
                  <span>显示方式</span>
                  <select value={draft.shape} onChange={(event) => setDraftField("shape", event.target.value)}>
                    <option value="point">点位</option>
                    <option value="polygon">范围多边形</option>
                  </select>
                </label>
                <label>
                  <span>所属势力（可选）</span>
                  <input value={draft.faction} onChange={(event) => setDraftField("faction", event.target.value)} placeholder="没有就留空" />
                </label>
                <label>
                  <span>横向坐标 x</span>
                  <input type="number" min="0" max="100" step="0.1" value={draft.x} onChange={(event) => setDraftField("x", event.target.value)} />
                </label>
                <label>
                  <span>纵向坐标 y</span>
                  <input type="number" min="0" max="100" step="0.1" value={draft.y} onChange={(event) => setDraftField("y", event.target.value)} />
                </label>
                {draft.shape === "polygon" ? (
                  <>
                    <label>
                      <span>区域颜色</span>
                      <MapColorControl value={draft.color} onChange={(value) => setDraftField("color", value)} inputClassName="" />
                    </label>
                    <label className="spanTwo">
                      <span>多边形坐标</span>
                      <textarea
                        value={draft.polygon_points_text}
                        onChange={(event) => setDraftField("polygon_points_text", event.target.value)}
                        placeholder={"每行一个点：x, y\n例如：20, 30\n45, 25\n60, 50\n30, 65"}
                      />
                    </label>
                  </>
                ) : null}
                <label className="spanTwo">
                  <span>说明</span>
                  <textarea value={draft.description} onChange={(event) => setDraftField("description", event.target.value)} />
                </label>
              </div>
              <div className="saveBar">
                <button className="ghostButton" type="button" onClick={cancelNodeEditing} disabled={saving}>
                  取消
                </button>
                <button className="saveButton" type="button" onClick={saveDraft} disabled={saving || !draft.name.trim()}>
                  保存地图节点
                </button>
              </div>
            </section>
          ) : null}
        </article>
      </section>
    </main>
  );
}

function FactionWorkspace({
  factions,
  currentFaction,
  selectedFactionName,
  setSelectedFactionName,
  saving,
  draftRevision,
  onSave,
  onDelete,
  onNew,
}) {
  const draftKey = selectedFactionName === "__new__" ? `new-${draftRevision}` : currentFaction?.name || "empty";
  const showEditor = currentFaction || selectedFactionName === "__new__";

  return (
    <main className="workspace">
      <aside className="factionListPanel characterListPanel">
        <div className="panelTitle">
          <span>
            <Shield size={17} />
            势力列表
          </span>
          <span className="countBadge">{factions.length}</span>
        </div>
        <div className="factionList characterList">
          {factions.length ? (
            factions.map((faction) => (
              <button
                key={faction.name}
                className={faction.name === currentFaction?.name ? "factionItem characterItem active" : "factionItem characterItem"}
                onClick={() => setSelectedFactionName(faction.name)}
              >
                <strong>{faction.name}</strong>
                <small>{[faction.type, faction.level].filter(Boolean).join(" · ") || "未记录类型"}</small>
                <small>{faction.leader || faction.location || faction.summary || "暂无简介"}</small>
                <span className={`statusBadge ${factionStatusTone(faction.status)}`}>{normalizeFactionStatusLabel(faction.status)}</span>
              </button>
            ))
          ) : (
            <div className="emptyListState">
              <p className="muted">当前项目还没有势力数据。</p>
              <button className="ghostButton" onClick={onNew} disabled={saving}>
                <Plus size={16} />
                新建势力
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="factionEditorPanel characterEditorPanel">
        {showEditor ? (
          <FactionEditor
            key={draftKey}
            faction={currentFaction}
            resetKey={draftKey}
            saving={saving}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : (
          <div className="emptyPanel">
            <h2>还没有可编辑的势力</h2>
            <p>先创建一个势力，或从项目 JSON / LLM 写入中导入。</p>
          </div>
        )}
      </section>
    </main>
  );
}

function CharacterEditor({ character, saving, onSave, onToggleStatus, onUpdateRole }) {
  const [draft, setDraft] = useState(() => characterDraft(character));

  useEffect(() => {
    setDraft(characterDraft(character));
  }, [character]);

  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <article className="editorCard">
      <div className="heroRow">
        <div>
          <p className="eyebrow">{character.identity || "书中身份未记录"}</p>
          <h2>{character.name}</h2>
        </div>
        <div className="heroMeta">
          <span className="heroChip">{character.realm || "当前境界未记录"}</span>
          <span className={isAliveStatus(draft.status) ? "statusBadge alive" : "statusBadge dead"}>
            {normalizeStatusLabel(draft.status)}
          </span>
        </div>
      </div>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <h3>基本资料</h3>
          <p>姓名、性别、性格、境界、身份、角色身份、存活状态。</p>
        </div>
        <div className="fieldGrid basicGrid">
          <label>
            <span>姓名</span>
            <input value={draft.name} readOnly />
          </label>
          <label>
            <span>性别</span>
            <select value={draft.gender} onChange={(event) => setField("gender", event.target.value)}>
              <option value="">未选择</option>
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="其他">其他</option>
            </select>
          </label>
          <label>
            <span>性格</span>
            <input value={draft.personality} onChange={(event) => setField("personality", event.target.value)} />
          </label>
          <label>
            <span>当前境界</span>
            <input value={draft.realm} onChange={(event) => setField("realm", event.target.value)} />
          </label>
          <label>
            <span>身份</span>
            <input value={draft.identity} onChange={(event) => setField("identity", event.target.value)} />
          </label>
          <label className="statusField">
            <span>存活状态</span>
            <button
              className={isAliveStatus(draft.status) ? "switchButton on" : "switchButton off"}
              type="button"
              aria-label="切换存活状态"
              aria-pressed={isAliveStatus(draft.status)}
              onClick={() => {
                const nextAlive = !isAliveStatus(draft.status);
                setDraft((prev) => ({ ...prev, status: nextAlive ? "存活" : "死亡" }));
                onToggleStatus(nextAlive);
              }}
              disabled={saving}
            >
              <span className="switchTrack">
                <span className="switchKnob" />
              </span>
              {normalizeStatusLabel(draft.status)}
            </button>
          </label>
        </div>

        <div className="pillGroupWrap">
          <span className="inlineLabel">角色身份</span>
          <div className="pillGroup" role="group" aria-label="角色身份">
            {roleOptions.map((role) => (
              <button
                key={role}
                type="button"
                className={draft.role === role ? "pill activePill" : "pill"}
                onClick={() => {
                  setDraft((prev) => ({ ...prev, role }));
                  onUpdateRole(role);
                }}
                disabled={saving}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <h3>详细信息</h3>
          <p>人物关系、所修功法、拥有的装备、阵营、血脉。</p>
        </div>
        <div className="fieldGrid detailGrid">
          <label className="spanTwo">
            <span>人物关系</span>
            <textarea value={draft.relationship_notes} onChange={(event) => setField("relationship_notes", event.target.value)} />
          </label>
          <label>
            <span>所修功法</span>
            <textarea
              value={draft.abilities_text}
              onChange={(event) => setField("abilities_text", event.target.value)}
              placeholder="每行一条功法"
            />
          </label>
          <label>
            <span>拥有的装备</span>
            <textarea
              value={draft.equipment_text}
              onChange={(event) => setField("equipment_text", event.target.value)}
              placeholder="每行一件装备"
            />
          </label>
          <label>
            <span>阵营</span>
            <input value={draft.faction} onChange={(event) => setField("faction", event.target.value)} />
          </label>
          <label>
            <span>血脉</span>
            <input value={draft.bloodline} onChange={(event) => setField("bloodline", event.target.value)} />
          </label>
        </div>
      </section>

      <div className="saveBar">
        <button className="saveButton" onClick={() => onSave(draft)} disabled={saving}>
          保存人物信息
        </button>
      </div>
    </article>
  );
}

function FactionEditor({ faction, resetKey, saving, onSave, onDelete }) {
  const [draft, setDraft] = useState(() => factionDraft(faction));

  useEffect(() => {
    setDraft(factionDraft(faction));
  }, [faction, resetKey]);

  const setField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const existingName = faction?.name || "";

  return (
    <article className="editorCard">
      <div className="heroRow">
        <div>
          <p className="eyebrow">{draft.type || "势力结构未记录"}</p>
          <h2>{draft.name || "未命名势力"}</h2>
        </div>
        <div className="heroMeta">
          <span className="heroChip">{draft.level || "层级未记录"}</span>
          <span className={`statusBadge ${factionStatusTone(draft.status)}`}>{normalizeFactionStatusLabel(draft.status)}</span>
        </div>
      </div>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <h3>基本资料</h3>
          <p>名称、别名、类型、层级、状态、上级、领袖、所在地、势力范围。</p>
        </div>
        <div className="fieldGrid basicGrid">
          <label>
            <span>势力名称</span>
            <input value={draft.name} onChange={(event) => setField("name", event.target.value)} placeholder="如：天元宗" />
          </label>
          <label>
            <span>类型</span>
            <input value={draft.type} onChange={(event) => setField("type", event.target.value)} placeholder="宗门 / 国家 / 公司 / 教会" />
          </label>
          <label>
            <span>层级</span>
            <input value={draft.level} onChange={(event) => setField("level", event.target.value)} placeholder="总览 / 统辖 / 分部 / 地方" />
          </label>
          <label>
            <span>状态</span>
            <input value={draft.status} onChange={(event) => setField("status", event.target.value)} placeholder="活跃 / 潜伏 / 衰落 / 覆灭" />
          </label>
          <label>
            <span>上级势力</span>
            <input value={draft.parent_name} onChange={(event) => setField("parent_name", event.target.value)} />
          </label>
          <label>
            <span>领袖</span>
            <input value={draft.leader} onChange={(event) => setField("leader", event.target.value)} />
          </label>
          <label>
            <span>所在地</span>
            <input value={draft.location} onChange={(event) => setField("location", event.target.value)} />
          </label>
          <label>
            <span>势力范围</span>
            <input value={draft.sphere} onChange={(event) => setField("sphere", event.target.value)} />
          </label>
          <label className="spanTwo">
            <span>别名</span>
            <textarea
              value={draft.aliases_text}
              onChange={(event) => setField("aliases_text", event.target.value)}
              placeholder="每行一个别名"
            />
          </label>
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <h3>核心设定</h3>
          <p>简介、理念、资源与剧情作用。</p>
        </div>
        <div className="fieldGrid detailGrid">
          <label className="spanTwo">
            <span>简介</span>
            <textarea value={draft.summary} onChange={(event) => setField("summary", event.target.value)} placeholder="这一势力在故事里的简述。" />
          </label>
          <label>
            <span>理念 / 目标</span>
            <textarea value={draft.ideology} onChange={(event) => setField("ideology", event.target.value)} />
          </label>
          <label>
            <span>资源 / 底蕴</span>
            <textarea value={draft.resources} onChange={(event) => setField("resources", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <h3>关系网络</h3>
          <p>核心成员、盟友、敌对方、下属势力与标签。</p>
        </div>
        <div className="fieldGrid detailGrid">
          <label>
            <span>核心成员</span>
            <textarea
              value={draft.core_members_text}
              onChange={(event) => setField("core_members_text", event.target.value)}
              placeholder="每行一个名字"
            />
          </label>
          <label>
            <span>盟友</span>
            <textarea
              value={draft.allies_text}
              onChange={(event) => setField("allies_text", event.target.value)}
              placeholder="每行一个名字"
            />
          </label>
          <label>
            <span>敌对方</span>
            <textarea
              value={draft.enemies_text}
              onChange={(event) => setField("enemies_text", event.target.value)}
              placeholder="每行一个名字"
            />
          </label>
          <label>
            <span>下属势力</span>
            <textarea
              value={draft.sub_factions_text}
              onChange={(event) => setField("sub_factions_text", event.target.value)}
              placeholder="每行一个名字"
            />
          </label>
          <label className="spanTwo">
            <span>标签</span>
            <textarea value={draft.tags_text} onChange={(event) => setField("tags_text", event.target.value)} placeholder="每行一个标签" />
          </label>
        </div>
      </section>

      <section className="sectionBlock">
        <div className="sectionHeader">
          <h3>设定备注</h3>
          <p>剧情备注与禁改事实，供作者和 LLM 做安全约束。</p>
        </div>
        <div className="fieldGrid detailGrid">
          <label className="spanTwo">
            <span>剧情备注</span>
            <textarea value={draft.plot_notes} onChange={(event) => setField("plot_notes", event.target.value)} />
          </label>
          <label className="spanTwo">
            <span>禁改事实</span>
            <textarea
              value={draft.locked_facts_text}
              onChange={(event) => setField("locked_facts_text", event.target.value)}
              placeholder="每行一条不能轻易改写的事实"
            />
          </label>
        </div>
      </section>

      <div className="saveBar">
        {existingName ? (
          <button className="dangerButton" onClick={() => onDelete(existingName)} disabled={saving}>
            <Trash2 size={16} />
            删除势力
          </button>
        ) : null}
        <button className="saveButton" onClick={() => onSave(draft)} disabled={saving || !draft.name.trim()}>
          保存势力
        </button>
      </div>
    </article>
  );
}

export {
  PowerSystemWorkspace,
  App,
  CharacterEditor,
  FactionEditor,
  MapWorkspace,
  buildMapAtlas,
  characterDraft,
  draftToMapImagePayload,
  draftToMapNodePayload,
  draftToFactionPatch,
  draftToPowerSystemPatch,
  draftToPatch,
  factionDraft,
  factionStatusTone,
  isAliveStatus,
  joinLines,
  mapImportTemplate,
  mapToExportJson,
  normalizeImportedMapJson,
  powerStageDraft,
  powerSystemDraft,
  powerTierDraft,
  powerTierLabel,
  powerStageLabel,
  normalizeFactionStatusLabel,
  normalizeStatusLabel,
  roleOptions,
  splitLines,
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
