import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Clock3, Eye, EyeOff, FileText, ImagePlus, Layers3, Map as MapIcon, Pencil, Plus, RefreshCw, Shield, Trash2, Upload, UserRound, XCircle } from "lucide-react";
import { gsap } from "gsap";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8765";
const MAP_SCENE = { width: 1600, height: 1000 };
const SCALE_BAR_TARGET_PX = 128;
const EMPTY_MAP_IMAGE_DATA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const mapScaleKinds = ["总览", "世界", "区域", "城市", "建筑", "副本", "秘境", "星域", "其他"];

const roleOptions = ["主角", "配角", "男主", "女主", "重要配角", "其他"];

const moduleLabels = {
  characters: "人物信息",
  powerSystem: "境界体系",
  factions: "势力结构",
  maps: "世界图册",
  timeline: "故事时间线",
  chapters: "章节概览",
  world: "世界设定",
  projects: "小说项目",
};

const viewMeta = {
  bookshelf: {
    title: "小说书架",
    subtitle: "选择一本小说进入资料页，或手动新增一个小说项目。",
  },
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
  timeline: {
    title: "故事时间线",
    subtitle: "以小说世界内真实纪年排序，章节只作为叙述或揭示来源，适合整理插叙、倒叙、回忆和预言。",
  },
  chapters: {
    title: "章节概览",
    subtitle: "按章节保存已经讲述、揭示、补完的关键事实，帮助作者核对读者获得信息的过程。",
  },
  pending: {
    title: "待审核",
    subtitle: "集中查看 LLM 提交但尚未进入正式资料库的草稿，批准后才会写入对应页面。",
  },
};

const timelineFilters = [
  { id: "全部", label: "全部" },
  { id: "正序事件", label: "正序" },
  { id: "前史", label: "前史" },
  { id: "插叙/回忆", label: "插叙/回忆" },
  { id: "梦境/预言", label: "梦境/预言" },
  { id: "未知时间", label: "未知" },
];

const timelineTypeClass = {
  正序事件: "normal",
  前史: "past",
  "插叙/回忆": "memory",
  "梦境/预言": "vision",
  未知时间: "unknown",
};

const chapterOverviewFilters = [
  { id: "全部", label: "全部" },
  { id: "主线推进", label: "主线" },
  { id: "人物变化", label: "人物" },
  { id: "势力变化", label: "势力" },
  { id: "伏笔", label: "伏笔" },
  { id: "死亡失踪", label: "死亡失踪" },
  { id: "设定补充", label: "设定" },
];

const chapterOverviewTypeClass = {
  主线推进: "main",
  人物变化: "character",
  势力变化: "faction",
  伏笔: "hook",
  死亡失踪: "danger",
  设定补充: "setting",
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

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

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return splitLines(value);
}

function itemLabel(item) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return String(item.title || item.name || item.fact || item.hook || item.event || item.summary || item.description || "").trim();
  }
  return String(item || "").trim();
}

function textList(value) {
  return asArray(value).map(itemLabel).filter(Boolean);
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

function normalizeTimelineTextList(value) {
  return splitLines(value);
}

function isChapterSummaryTimelineSignal(event = {}) {
  return textList(event.tags).includes("chapter_summary");
}

function normalizeTimelineSide(value, index) {
  const text = String(value || "").trim().toLowerCase();
  if (["left", "左", "左侧"].includes(text)) {
    return "left";
  }
  if (["right", "右", "右侧"].includes(text)) {
    return "right";
  }
  return index % 2 === 0 ? "left" : "right";
}

function normalizeTimelineEvent(event = {}, index = 0) {
  const chapter = event.chapter || "";
  const title = event.title || event.event || event.summary || "未命名事件";
  const summary = event.summary || event.event || title;
  const year = event.year_label || event.year || event.date_label || (chapter ? `第 ${chapter} 章` : "时间未定");
  const timeNote = event.time_note || event.timeNote || "";
  const sortValue = Number(event.sort_order ?? event.sort ?? 0);
  return {
    id: String(event.id || `timeline-${index}`),
    era: event.era || "未定纪年",
    year,
    timeNote,
    sort: Number.isFinite(sortValue) && sortValue !== 0 ? sortValue : Number(chapter || index + 1),
    side: normalizeTimelineSide(event.side, index),
    type: event.event_type || event.type || "未知时间",
    title,
    summary,
    narrative: event.narrative || (chapter ? `第 ${chapter} 章` : "叙述来源未记载"),
    location: event.location || "地点未记载",
    characters: normalizeTimelineTextList(event.involved_characters || event.characters),
    factions: normalizeTimelineTextList(event.factions),
    consequences: event.consequences || "影响结果未记录",
    hooks: normalizeTimelineTextList(event.hooks || event.tags),
  };
}

function timelineEventMatches(event, activeFilter, keyword) {
  const typeOk = activeFilter === "全部" || event.type === activeFilter;
  const text = [
    event.era,
    event.year,
    event.timeNote,
    event.title,
    event.summary,
    event.narrative,
    event.location,
    event.characters.join(" "),
    event.factions.join(" "),
    event.hooks.join(" "),
  ].join(" ");
  return typeOk && (!keyword || text.includes(keyword));
}

function groupTimelineByEra(list) {
  return list.reduce((groups, event) => {
    const last = groups[groups.length - 1];
    if (last && last.era === event.era) {
      last.events.push(event);
    } else {
      groups.push({ era: event.era, events: [event] });
    }
    return groups;
  }, []);
}

function normalizeChapterNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeChapterFactType(value, fallback = "设定补充") {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }
  if (["主线", "主线事件", "剧情推进", "当前线事件"].includes(text)) {
    return "主线推进";
  }
  if (["人物", "角色", "角色变化"].includes(text)) {
    return "人物变化";
  }
  if (["势力", "组织", "阵营"].includes(text)) {
    return "势力变化";
  }
  if (["伏笔埋设", "伏笔回收", "钩子"].includes(text)) {
    return "伏笔";
  }
  if (["死亡", "失踪", "死亡/失踪"].includes(text)) {
    return "死亡失踪";
  }
  return chapterOverviewTypeClass[text] ? text : fallback;
}

function normalizeChapterTextItem(item, index, chapter, sourcePrefix, fallbackType = "设定补充") {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const title = item.title || item.name || item.fact || item.hook || item.event || item.summary || `${sourcePrefix} ${index + 1}`;
    const summary = item.summary || item.description || item.content || item.fact || item.hook || item.event || title;
    return {
      id: `${sourcePrefix}-${chapter}-${index}`,
      chapter,
      order: String(index + 1).padStart(2, "0"),
      type: normalizeChapterFactType(item.type || item.category || item.kind, fallbackType),
      title: String(title),
      time: item.time || item.time_note || item.year_label || "本章内",
      location: item.location || "地点未记录",
      summary: String(summary),
      characters: textList(item.characters || item.involved_characters),
      factions: textList(item.factions),
      consequences: item.consequences || item.result || item.impact || "影响结果未记录",
      hooks: textList(item.hooks || item.tags || item.related_hooks || item.hook),
      status: item.status || (fallbackType === "伏笔" ? "待回收" : "已确认"),
      source: item.source || `第 ${chapter} 章`,
    };
  }
  const text = String(item || "").trim();
  return {
    id: `${sourcePrefix}-${chapter}-${index}`,
    chapter,
    order: String(index + 1).padStart(2, "0"),
    type: fallbackType,
    title: text || `${sourcePrefix} ${index + 1}`,
    time: "本章内",
    location: "地点未记录",
    summary: text || "未填写说明。",
    characters: [],
    factions: [],
    consequences: fallbackType === "伏笔" ? "伏笔进入章节事实册，后续需要追踪。" : "影响结果未记录",
    hooks: fallbackType === "伏笔" && text ? [text] : [],
    status: fallbackType === "伏笔" ? "待回收" : "已确认",
    source: `第 ${chapter} 章`,
  };
}

function normalizeChapterOverviewEvent(event = {}, index = 0) {
  const chapter = normalizeChapterNumber(event.chapter);
  const title = event.title || event.event || event.summary || `章节事实 ${index + 1}`;
  return {
    id: String(event.id || `chapter-event-${chapter || "unknown"}-${index}`),
    chapter,
    order: String(event.order || event.sort_order || index + 1).padStart(2, "0"),
    type: normalizeChapterFactType(event.chapter_fact_type || event.event_type || event.type, "主线推进"),
    title: String(title),
    time: event.time || event.time_note || event.year_label || "本章内",
    location: event.location || "地点未记录",
    summary: event.summary || event.event || title,
    characters: textList(event.involved_characters || event.characters),
    factions: textList(event.factions),
    consequences: event.consequences || "影响结果未记录",
    hooks: textList(event.hooks || event.tags),
    status: event.status || "已确认",
    source: event.source || event.narrative || `第 ${chapter || "未知"} 章`,
  };
}

function buildChapterOverview(chapterSummaries = [], timeline = []) {
  const chapterMap = new Map();
  const events = [];
  const ensureChapter = (chapter, patch = {}) => {
    if (!chapter) {
      return null;
    }
    const current = chapterMap.get(chapter) || {
      id: `chapter-${chapter}`,
      chapter,
      label: `第 ${chapter} 章`,
      title: `第 ${chapter} 章`,
      note: "章节资料待补充",
    };
    chapterMap.set(chapter, { ...current, ...patch });
    return chapterMap.get(chapter);
  };

  chapterSummaries.forEach((summary, summaryIndex) => {
    const chapter = normalizeChapterNumber(summary.chapter);
    if (!chapter) {
      return;
    }
    ensureChapter(chapter, {
      title: summary.title || `第 ${chapter} 章摘要`,
      note: summary.summary || "本章摘要待补充",
    });
    if (summary.summary) {
      events.push({
        id: `summary-${chapter}`,
        chapter,
        order: "00",
        type: "主线推进",
        title: summary.title || `第 ${chapter} 章摘要`,
        time: "本章概述",
        location: "章节整体",
        summary: summary.summary,
        characters: [],
        factions: [],
        consequences: "本章摘要已保存。",
        hooks: textList(summary.hooks),
        status: "已确认",
        source: `章节摘要 ${summaryIndex + 1}`,
      });
    }
    asArray(summary.facts).forEach((fact, index) => {
      events.push(normalizeChapterTextItem(fact, index, chapter, "fact", "设定补充"));
    });
    asArray(summary.hooks).forEach((hook, index) => {
      events.push(normalizeChapterTextItem(hook, index, chapter, "hook", "伏笔"));
    });
  });

  timeline.forEach((item, index) => {
    const signalTags = textList(item.tags || item.hooks);
    if (signalTags.includes("chapter_summary")) {
      return;
    }
    const event = normalizeChapterOverviewEvent(item, index);
    if (!event.chapter) {
      return;
    }
    ensureChapter(event.chapter, {
      title: chapterMap.get(event.chapter)?.title || `第 ${event.chapter} 章`,
      note: chapterMap.get(event.chapter)?.note || "由时间线事件生成的章节事实",
    });
    events.push(event);
  });

  events.sort((left, right) => left.chapter - right.chapter || Number(left.order) - Number(right.order) || left.title.localeCompare(right.title, "zh-CN"));
  const chapters = [...chapterMap.values()].sort((left, right) => left.chapter - right.chapter);
  return { chapters, events };
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

function isFantasyProject(project) {
  const genre = String(project?.genre || "");
  return genre.includes("玄幻") || genre.includes("仙侠");
}

function projectUpdatedLabel(project) {
  return String(project?.updated_at || project?.created_at || "").slice(0, 10) || "未记录";
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

function pointInPolygon(point, polygonPoints = []) {
  if (!point || !Array.isArray(polygonPoints) || polygonPoints.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const current = polygonPoints[i] || {};
    const previous = polygonPoints[j] || {};
    const xi = numberOr(current.x, 0);
    const yi = numberOr(current.y, 0);
    const xj = numberOr(previous.x, 0);
    const yj = numberOr(previous.y, 0);
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonArea(polygonPoints = []) {
  if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) {
    return 0;
  }
  let area = 0;
  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const current = polygonPoints[i] || {};
    const previous = polygonPoints[j] || {};
    area += numberOr(previous.x, 0) * numberOr(current.y, 0) - numberOr(current.x, 0) * numberOr(previous.y, 0);
  }
  return Math.abs(area) / 2;
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
  const color = normalizeRgbColor(node?.color || "", "120,146,185");
  return {
    fill: rgbCss(color, active ? 0.18 : 0.08),
    stroke: rgbCss(color, active ? 0.96 : 0.78),
    strokeWidth: active ? 4.5 : 3,
    filter: active ? `drop-shadow(0 0 10px ${rgbCss(color, 0.34)})` : undefined,
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

function prettyJson(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function changeModule(change = {}) {
  if (change.module_type) {
    return change.module_type;
  }
  const type = String(change.target_type || "");
  if (type.startsWith("character")) return "characters";
  if (type.startsWith("faction")) return "factions";
  if (type.startsWith("power")) return "powerSystem";
  if (type.startsWith("map")) return "maps";
  if (type.startsWith("timeline")) return "timeline";
  if (type.startsWith("chapter")) return "chapters";
  if (type.startsWith("world")) return "world";
  return "";
}

function modulePendingChanges(changes = [], module) {
  return changes.filter((change) => changeModule(change) === module);
}

function PendingRenderedPreview({ change }) {
  const module = changeModule(change);
  const data = change.preview || change.patch || {};
  const targetType = String(change.target_type || "");
  const title = data.name || data.title || data.名称 || data.地图名 || data.事件标题 || data.标题 || change.target_entity || change.target_name || "未命名";

  if (module === "characters") {
    return (
      <div className="pendingRenderedPreview characterPreview">
        <div className="pendingPreviewTitleRow">
          <strong>{data.name || data.姓名 || title}</strong>
          <span className={isAliveStatus(data.status || data.存活状态) ? "statusBadge alive" : "statusBadge dead"}>{normalizeStatusLabel(data.status || data.存活状态)}</span>
        </div>
        <div className="pendingPreviewGrid">
          <span>角色身份：{data.role || data.角色身份 || "未记录"}</span>
          <span>性别：{data.gender || data.性别 || "未记录"}</span>
          <span>境界：{data.realm || data.当前境界 || "未记录"}</span>
          <span>身份：{data.identity || data.身份 || "未记录"}</span>
          <span>阵营：{data.faction || data.阵营 || "未记录"}</span>
          <span>血脉：{data.bloodline || data.血脉 || "未记录"}</span>
        </div>
        <p>{data.personality || data.性格 || "性格未记录"}</p>
        <div className="pendingPreviewChips">
          {textList(data.abilities || data.所修功法).map((item) => <span className="tag" key={item}>{item}</span>)}
          {textList(data.equipment || data.拥有的装备).map((item) => <span className="tag" key={item}>{item}</span>)}
        </div>
      </div>
    );
  }

  if (module === "factions") {
    return (
      <div className="pendingRenderedPreview factionPreview">
        <div className="pendingPreviewTitleRow">
          <strong>{data.name || data.名称 || title}</strong>
          <span className={`statusBadge ${factionStatusTone(data.status || data.状态)}`}>{normalizeFactionStatusLabel(data.status || data.状态)}</span>
        </div>
        <div className="pendingPreviewGrid">
          <span>类型：{data.type || data.类型 || "未记录"}</span>
          <span>层级：{data.level || data.层级 || "未记录"}</span>
          <span>领袖：{data.leader || data.领袖 || "未记录"}</span>
          <span>所在地：{data.location || data.所在地 || "未记录"}</span>
          <span className="spanTwo">势力范围：{data.sphere || data.势力范围 || "未记录"}</span>
        </div>
        <p>{data.summary || data.简介 || "简介未记录"}</p>
      </div>
    );
  }

  if (module === "powerSystem") {
    const stages = Array.isArray(data.stages || data.小境界) ? data.stages || data.小境界 : [];
    return (
      <div className="pendingRenderedPreview powerPreview">
        <div className="pendingPreviewTitleRow">
          <strong>{data.name || data.境界 || title}</strong>
          <span className="chip">{stages.length} 个小境界</span>
        </div>
        <p>{data.description || data.说明 || "说明未记录"}</p>
        {stages.length ? (
          <table className="pendingMiniTable">
            <tbody>
              {stages.map((stage, index) => (
                <tr key={`${stage.name || stage.名称 || index}`}>
                  <td>{stage.name || stage.名称 || `小境界 ${index + 1}`}</td>
                  <td>{stage.description || stage.说明 || "未填写说明"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    );
  }

  if (module === "maps") {
    const color = data.color || data.颜色 || "";
    const points = Array.isArray(data.polygon_points || data.顶点) ? data.polygon_points || data.顶点 : [];
    return (
      <div className="pendingRenderedPreview mapPreview">
        <div className="pendingPreviewTitleRow">
          <strong>{title}</strong>
          <span className="chip">{targetType.includes("region") ? "区域" : targetType.includes("node") ? "节点" : "地图"}</span>
        </div>
        <div className="pendingPreviewGrid">
          <span>层级：{data.layer || data.层级 || "未记录"}</span>
          <span>尺度：{data.scale_label || data.标度文字 || "未设定比例"}</span>
          <span>范围：{data.real_width || data.横向范围 || 0} × {data.real_height || data.纵向范围 || 0} {data.distance_unit || data.距离单位 || "里"}</span>
          <span>坐标：{data.x ?? "未设定"} / {data.y ?? "未设定"}</span>
          <span className="spanTwo">说明：{data.notes || data.description || data.说明 || "未记录"}</span>
        </div>
        {color ? (
          <div className="pendingColorRow">
            <span className="pendingColorSwatch" style={{ backgroundColor: `rgb(${color})` }} />
            <span>{color}</span>
          </div>
        ) : null}
        {points.length ? <p>区域顶点：{points.map((point) => `(${point.x}, ${point.y})`).join("、")}</p> : null}
      </div>
    );
  }

  if (module === "timeline") {
    return (
      <div className="pendingRenderedPreview timelinePreview">
        <div className="pendingPreviewTitleRow">
          <strong>{data.title || data.事件标题 || title}</strong>
          <span className="chip">{data.year_label || data.故事时间 || "时间未定"}</span>
        </div>
        <p>{data.summary || data.事件说明 || "事件说明未记录"}</p>
        <div className="pendingPreviewChips">
          <span className="tag">{data.event_type || data.事件类型 || "未知时间"}</span>
          <span className="tag">{data.location || data.地点 || "地点未记录"}</span>
          {textList(data.involved_characters || data.涉及人物).map((item) => <span className="tag" key={item}>{item}</span>)}
        </div>
      </div>
    );
  }

  if (module === "chapters") {
    return (
      <div className="pendingRenderedPreview chapterPreview">
        <div className="pendingPreviewTitleRow">
          <strong>第 {data.chapter || data.章节 || "?"} 章 · {data.title || data.标题 || "未命名章节"}</strong>
          <span className="chip">章节概览</span>
        </div>
        <p>{data.summary || data.摘要 || "摘要未记录"}</p>
        <div className="pendingPreviewChips">
          {textList(data.facts || data.事实).map((item) => <span className="tag" key={item}>{item}</span>)}
          {textList(data.hooks || data.伏笔).map((item) => <span className="tag" key={item}>{item}</span>)}
        </div>
      </div>
    );
  }

  if (module === "world") {
    return (
      <div className="pendingRenderedPreview worldPreview">
        <div className="pendingPreviewTitleRow">
          <strong>世界设定</strong>
          <span className="chip">总览</span>
        </div>
        <p>{data.summary || data.世界设定 || "世界设定未记录"}</p>
      </div>
    );
  }

  return (
    <div className="pendingRenderedPreview">
      <div className="pendingPreviewTitleRow">
        <strong>{title}</strong>
        <span className="chip">{change.target_type || "待审核"}</span>
      </div>
      <p>该类型暂时使用通用 JSON 预览。</p>
    </div>
  );
}

function InlinePendingCard({ change, saving, onApprove, onReject }) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(() => prettyJson(change.patch));
  const [localError, setLocalError] = useState("");
  const validation = change.validation || {};
  const moduleLabel = change.module_label || moduleLabels[changeModule(change)] || "未分类";
  const target = change.target_entity || change.target_name || "未命名目标";

  useEffect(() => {
    setDraftText(prettyJson(change.patch));
    setEditing(false);
    setLocalError("");
  }, [change.id, change.patch]);

  const approve = async () => {
    setLocalError("");
    let patch;
    if (editing) {
      try {
        patch = JSON.parse(draftText);
      } catch (err) {
        setLocalError("JSON 格式错误，无法批准。");
        return;
      }
    }
    await onApprove(change.id, patch);
    setEditing(false);
  };

  return (
    <article className="inlinePendingCard">
      <div className="inlinePendingHead">
        <div>
          <strong>{target}</strong>
          <small>{moduleLabel} · {change.target_type}</small>
        </div>
        <span className="pendingCapsule">待确认预览</span>
      </div>
      <PendingRenderedPreview change={change} />
      {localError ? <div className="pendingValidation invalid">{localError}</div> : null}
      {validation?.errors?.length ? (
        <div className="pendingValidation invalid">{validation.errors.join("；")}</div>
      ) : (
        <div className="pendingValidation valid">格式已通过校验，批准后写入正式资料。</div>
      )}
      {editing ? (
        <div className="pendingJsonArea">
          <div className="pendingPreviewSectionLabel">JSON 原文 / 可编辑</div>
          <textarea className="pendingJsonEditor" value={draftText} onChange={(event) => setDraftText(event.target.value)} />
        </div>
      ) : null}
      <div className="inlinePendingActions">
        <button className="ghostButton compactButton" onClick={() => setEditing((value) => !value)} disabled={saving}>
          <Pencil size={14} />
          {editing ? "收起 JSON" : "编辑 JSON"}
        </button>
        <button className="ghostButton compactButton approveButton" onClick={approve} disabled={saving}>
          <CheckCircle2 size={14} />
          批准
        </button>
        <button className="ghostButton compactButton rejectButton" onClick={() => onReject(change.id)} disabled={saving}>
          <XCircle size={14} />
          拒绝
        </button>
      </div>
    </article>
  );
}

function InlinePendingList({ changes = [], saving, onApprove, onReject, empty = false }) {
  if (!changes.length && !empty) {
    return null;
  }
  return (
    <div className="inlinePendingList">
      {changes.map((change) => (
        <InlinePendingCard key={change.id} change={change} saving={saving} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  );
}

function PendingPreviewPanel({ changes = [], module, title = "待审核草稿", saving, onApprove, onReject }) {
  const scopedChanges = module ? changes.filter((change) => changeModule(change) === module) : changes;
  const [editingId, setEditingId] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [localError, setLocalError] = useState("");

  if (!scopedChanges.length) {
    return null;
  }

  const startEdit = (change) => {
    if (editingId === change.id) {
      setEditingId(null);
      setDraftText("");
      setLocalError("");
      return;
    }
    setEditingId(change.id);
    setDraftText(prettyJson(change.patch));
    setLocalError("");
  };

  const approve = async (change) => {
    setLocalError("");
    let patch;
    if (editingId === change.id) {
      try {
        patch = JSON.parse(draftText);
      } catch (err) {
        setLocalError("JSON 格式错误，无法批准。");
        return;
      }
    }
    await onApprove(change.id, patch);
    setEditingId(null);
    setDraftText("");
  };

  return (
    <section className="pendingPreviewPanel">
      <div className="pendingPreviewHead">
        <div>
          <p className="eyebrow">LLM 草稿</p>
          <h2>{title}</h2>
        </div>
        <span className="countBadge">{scopedChanges.length}</span>
      </div>
      {localError ? <div className="banner errorBanner">{localError}</div> : null}
      <div className="pendingPreviewList">
        {scopedChanges.map((change) => {
          const validation = change.validation || {};
          const moduleLabel = change.module_label || moduleLabels[changeModule(change)] || "未分类";
          const target = change.target_entity || change.target_name || "未命名目标";
          const isEditing = editingId === change.id;
          return (
            <article className="pendingPreviewCard" key={change.id}>
              <div className="pendingPreviewCardHead">
                <div>
                  <strong>{target}</strong>
                  <small>
                    {moduleLabel} · {change.target_type}
                  </small>
                </div>
                <div className="pendingPreviewActions">
                  <button className="ghostButton compactButton approveButton" onClick={() => approve(change)} disabled={saving}>
                    <CheckCircle2 size={14} />
                    批准
                  </button>
                  <button className="ghostButton compactButton rejectButton" onClick={() => onReject(change.id)} disabled={saving}>
                    <XCircle size={14} />
                    拒绝
                  </button>
                </div>
              </div>
              <p className="pendingReason">{change.reason || "未填写原因"}</p>
              <div className="pendingPreviewSurface">
                <div className="pendingPreviewSurfaceHead">
                  <span className="pendingPreviewSectionLabel">界面预览</span>
                  <button className="ghostButton compactButton" onClick={() => startEdit(change)} disabled={saving}>
                    <Pencil size={14} />
                    {isEditing ? "收起 JSON" : "编辑 JSON"}
                  </button>
                </div>
                <PendingRenderedPreview change={change} />
                {isEditing ? (
                  <div className="pendingJsonArea">
                    <div className="pendingPreviewSectionLabel">JSON 原文 / 可编辑</div>
                    <textarea className="pendingJsonEditor" value={draftText} onChange={(event) => setDraftText(event.target.value)} />
                  </div>
                ) : null}
              </div>
              {validation?.errors?.length ? (
                <div className="pendingValidation invalid">{validation.errors.join("；")}</div>
              ) : (
                <div className="pendingValidation valid">格式已通过校验，批准后写入正式资料。</div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [factions, setFactions] = useState([]);
  const [activeView, setActiveView] = useState("bookshelf");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedCharacterName, setSelectedCharacterName] = useState("");
  const [selectedFactionName, setSelectedFactionName] = useState("");
  const [factionDraftRevision, setFactionDraftRevision] = useState(0);
  const [projectAdding, setProjectAdding] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ title: "", genre: "玄幻", premise: "" });

  const load = async ({ resetSelection = false } = {}) => {
    setError("");
    try {
      const [nextDashboard, nextFactions] = await Promise.all([api("/api/dashboard"), api("/api/factions")]);
      setDashboard(nextDashboard);
      setFactions(nextFactions);
      setLoading(false);
      if (resetSelection) {
        setSelectedCharacterName(nextDashboard?.characters?.[0]?.name || "");
        setSelectedFactionName(nextFactions?.[0]?.name || "");
        return;
      }
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
  const timeline = dashboard?.timeline ?? [];
  const chapterSummaries = dashboard?.chapter_summaries ?? [];
  const pendingChanges = dashboard?.pending_changes ?? [];
  const projects = dashboard?.projects ?? (dashboard?.project ? [dashboard.project] : []);
  const activeProject = dashboard?.project ?? projects.find((project) => project.is_active) ?? null;
  const showPowerSystem = isFantasyProject(activeProject);
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

  useEffect(() => {
    if (activeView === "powerSystem" && activeProject && !showPowerSystem) {
      setActiveView("characters");
    }
  }, [activeView, activeProject, showPowerSystem]);

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

  const saveChapterSummary = async (payload) => {
    if (!payload.chapter || payload.chapter < 1) {
      setError("请先填写有效章节号。");
      return false;
    }
    if (!payload.summary.trim()) {
      setError("请先填写章节摘要。");
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/api/chapters/summary", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await load();
      setNotice("已保存章节概览。");
      return true;
    } catch (err) {
      setError("保存章节概览失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteChapterSummary = async (chapter) => {
    if (!chapter) {
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/chapters/summary/${chapter}`, { method: "DELETE" });
      await load();
      setNotice(`已删除第 ${chapter} 章概览。`);
      return true;
    } catch (err) {
      setError("删除章节概览失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const approvePendingChange = async (changeId, patch) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/pending-changes/${changeId}/approve`, {
        method: "POST",
        body: JSON.stringify(patch ? { patch } : {}),
      });
      await load();
      setNotice("已批准并写入正式资料。");
    } catch (err) {
      setError("批准失败：待审核内容格式可能仍不符合当前模块结构。");
    } finally {
      setSaving(false);
    }
  };

  const rejectPendingChange = async (changeId) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/pending-changes/${changeId}/reject`, { method: "POST" });
      await load();
      setNotice("已拒绝该待审核草稿。");
    } catch (err) {
      setError("拒绝失败，请检查后端是否可用。");
    } finally {
      setSaving(false);
    }
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

  const openProject = async (projectId) => {
    if (!projectId) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/projects/${projectId}/switch`, { method: "POST" });
      setSelectedCharacterName("");
      setSelectedFactionName("");
      await load({ resetSelection: true });
      setActiveView("characters");
      setNotice("已切换小说。");
    } catch (err) {
      setError("切换小说失败，请检查后端是否可用。");
    } finally {
      setSaving(false);
    }
  };

  const createProjectFromDraft = async (draft) => {
    const title = draft.title.trim();
    if (!title) {
      setError("请先填写书名。");
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title,
          genre: draft.genre,
          premise: draft.premise.trim(),
        }),
      });
      setSelectedCharacterName("");
      setSelectedFactionName("");
      await load({ resetSelection: true });
      setProjectDraft({ title: "", genre: "玄幻", premise: "" });
      setProjectAdding(false);
      setActiveView("characters");
      setNotice("已创建小说。");
      return true;
    } catch (err) {
      setError("创建小说失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateProjectFromDraft = async (projectId, draft) => {
    const title = draft.title.trim();
    if (!projectId || !title) {
      setError("请先填写书名。");
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          genre: draft.genre,
          premise: draft.premise.trim(),
        }),
      });
      await load();
      setNotice("已更新小说信息。");
      return true;
    } catch (err) {
      setError("更新小说失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteProjectFromShelf = async (project) => {
    if (!project?.id) {
      return false;
    }
    const title = projectTitle(project);
    const confirmed = window.confirm(`确定删除小说「${title}」吗？删除后会同时删除这本书下的人物、势力、地图、时间线等资料。`);
    if (!confirmed) {
      return false;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      setSelectedCharacterName("");
      setSelectedFactionName("");
      await load({ resetSelection: true });
      setActiveView("bookshelf");
      setNotice("已删除小说。");
      return true;
    } catch (err) {
      setError("删除小说失败，请检查后端是否可用。");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const activeMeta = viewMeta[activeView];

  return (
    <div className="appShell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{activeView === "bookshelf" ? "小说知识库" : `${activeProject?.genre || "未分类"} · 当前小说`}</p>
          <h1>{activeView === "bookshelf" ? activeMeta.title : projectTitle(activeProject)}</h1>
          {activeView === "bookshelf" ? <p className="subtle">{activeMeta.subtitle}</p> : null}
        </div>
        <div className="topbarActions">
          {activeView === "bookshelf" ? (
            <button className="saveButton" onClick={() => setProjectAdding((value) => !value)} disabled={loading || saving}>
              <Plus size={16} />
              手动添加小说
            </button>
          ) : (
            <>
              <button className="ghostButton" onClick={() => setActiveView("bookshelf")} disabled={loading || saving}>
                返回小说页
              </button>
              <div className="viewTabs" role="tablist" aria-label="页面切换">
                <button
                  type="button"
                  className={activeView === "characters" ? "viewTab active" : "viewTab"}
                  onClick={() => setActiveView("characters")}
                >
                  <UserRound size={16} />
                  人物信息
                </button>
                {showPowerSystem ? (
                  <button
                    type="button"
                    className={activeView === "powerSystem" ? "viewTab active" : "viewTab"}
                    onClick={() => setActiveView("powerSystem")}
                  >
                    <BookOpen size={16} />
                    境界体系
                  </button>
                ) : null}
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
                <button
                  type="button"
                  className={activeView === "timeline" ? "viewTab active" : "viewTab"}
                  onClick={() => setActiveView("timeline")}
                >
                  <Clock3 size={16} />
                  故事时间线
                </button>
                <button
                  type="button"
                  className={activeView === "chapters" ? "viewTab active" : "viewTab"}
                  onClick={() => setActiveView("chapters")}
                >
                  <FileText size={16} />
                  章节概览
                </button>
                <button
                  type="button"
                  className={activeView === "pending" ? "viewTab active" : "viewTab"}
                  onClick={() => setActiveView("pending")}
                >
                  <CheckCircle2 size={16} />
                  待审核
                  {pendingChanges.length ? <span className="tabBadge">{pendingChanges.length}</span> : null}
                </button>
              </div>
            </>
          )}
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
      ) : activeView === "bookshelf" ? (
        <BookshelfWorkspace
          projects={projects}
          activeProject={activeProject}
          adding={projectAdding}
          draft={projectDraft}
          saving={saving}
          onSetAdding={setProjectAdding}
          onSetDraft={setProjectDraft}
          onCreate={createProjectFromDraft}
          onUpdate={updateProjectFromDraft}
          onDelete={deleteProjectFromShelf}
          onOpen={openProject}
        />
      ) : activeView === "pending" ? (
        pendingChanges.length ? (
          <PendingPreviewPanel
            changes={pendingChanges}
            title="全部待审核草稿"
            saving={saving}
            onApprove={approvePendingChange}
            onReject={rejectPendingChange}
          />
        ) : (
          <main className="emptyState">
            <h2>没有待审核草稿</h2>
            <p>LLM 提交并通过格式校验的资料会先出现在这里。</p>
          </main>
        )
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
          pendingChanges={modulePendingChanges(pendingChanges, "characters")}
          onApprovePending={approvePendingChange}
          onRejectPending={rejectPendingChange}
        />
      ) : activeView === "powerSystem" ? (
        <PowerSystemWorkspace
          powerSystem={powerSystem}
          saving={saving}
          onSave={savePowerSystem}
          pendingChanges={modulePendingChanges(pendingChanges, "powerSystem")}
          onApprovePending={approvePendingChange}
          onRejectPending={rejectPendingChange}
        />
      ) : activeView === "maps" ? (
        <MapWorkspace
          world={world}
          saving={saving}
          onSaveNode={saveMapNode}
          onDeleteNode={deleteMapNode}
          onDeleteMap={deleteMapImage}
          onSaveMap={saveMapImage}
          onUpdateMap={updateMapImage}
          pendingChanges={modulePendingChanges(pendingChanges, "maps")}
          onApprovePending={approvePendingChange}
          onRejectPending={rejectPendingChange}
        />
      ) : activeView === "timeline" ? (
        <TimelineWorkspace
          timeline={timeline}
          pendingChanges={modulePendingChanges(pendingChanges, "timeline")}
          saving={saving}
          onApprovePending={approvePendingChange}
          onRejectPending={rejectPendingChange}
        />
      ) : activeView === "chapters" ? (
        <ChapterOverviewWorkspace
          chapterSummaries={chapterSummaries}
          timeline={timeline}
          saving={saving}
          onSaveChapterSummary={saveChapterSummary}
          onDeleteChapterSummary={deleteChapterSummary}
          pendingChanges={modulePendingChanges(pendingChanges, "chapters")}
          onApprovePending={approvePendingChange}
          onRejectPending={rejectPendingChange}
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
          pendingChanges={modulePendingChanges(pendingChanges, "factions")}
          onApprovePending={approvePendingChange}
          onRejectPending={rejectPendingChange}
        />
      )}
    </div>
  );
}

function BookshelfWorkspace({
  projects = [],
  activeProject,
  adding,
  draft,
  saving,
  onSetAdding,
  onSetDraft,
  onCreate,
  onUpdate = async () => false,
  onDelete = async () => false,
  onOpen,
}) {
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editDraft, setEditDraft] = useState({ title: "", genre: "玄幻", premise: "" });

  const setDraftField = (field, value) => {
    onSetDraft((current) => ({ ...current, [field]: value }));
  };

  const setEditField = (field, value) => {
    setEditDraft((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    await onCreate(draft);
  };

  const startEdit = (project) => {
    setEditingProjectId(project.id);
    setEditDraft({
      title: projectTitle(project),
      genre: project.genre || "其他",
      premise: project.premise || "",
    });
  };

  const submitEdit = async (projectId) => {
    const ok = await onUpdate(projectId, editDraft);
    if (ok) {
      setEditingProjectId(null);
    }
  };

  const deleteProject = async (project) => {
    const ok = await onDelete(project);
    if (ok && editingProjectId === project.id) {
      setEditingProjectId(null);
    }
  };

  return (
    <main className="bookshelfWorkspace">
      {adding ? (
        <section className="projectAddPanel" aria-label="手动添加小说">
          <div className="sectionHeader">
            <h3>手动添加小说</h3>
            <p>创建后会自动切换到新书的人物信息页，后续资料仍由正式页面维护。</p>
          </div>
          <div className="fieldGrid projectFormGrid">
            <label>
              <span>书名</span>
              <input value={draft.title} onChange={(event) => setDraftField("title", event.target.value)} placeholder="例如：长夜星火" />
            </label>
            <label>
              <span>题材</span>
              <select value={draft.genre} onChange={(event) => setDraftField("genre", event.target.value)}>
                <option>玄幻</option>
                <option>仙侠</option>
                <option>都市</option>
                <option>末日</option>
                <option>奇幻</option>
                <option>科幻</option>
                <option>悬疑</option>
                <option>其他</option>
              </select>
            </label>
            <label className="spanTwo">
              <span>简介</span>
              <textarea value={draft.premise} onChange={(event) => setDraftField("premise", event.target.value)} placeholder="写一句这本书的核心设定或主线。" />
            </label>
          </div>
          <div className="saveBar">
            <button className="ghostButton" type="button" onClick={() => onSetAdding(false)} disabled={saving}>
              取消
            </button>
            <button className="saveButton" type="button" onClick={submit} disabled={saving || !draft.title.trim()}>
              创建小说
            </button>
          </div>
        </section>
      ) : null}

      {projects.length ? (
        <section className="projectGrid" aria-label="小说列表">
          {projects.map((project) => {
            const fantasy = isFantasyProject(project);
            const editing = editingProjectId === project.id;
            return (
              <article className={project.id === activeProject?.id ? "projectCard active" : "projectCard"} key={project.id}>
                <button className="projectOpenButton" type="button" onClick={() => onOpen(project.id)} disabled={saving}>
                  <span className="projectCardHead">
                    <span>
                      <strong className="projectCardTitle">{projectTitle(project)}</strong>
                      <span className={fantasy ? "genreTag fantasy" : "genreTag"}>{project.genre || "未分类"}</span>
                    </span>
                    {project.id === activeProject?.id ? <span className="overviewBadge">当前</span> : <span className="chip">进入</span>}
                  </span>
                  <span className="projectIntro">{project.premise || "这本小说还没有简介。"}</span>
                  <span className="projectFooter">
                    <span>更新：{projectUpdatedLabel(project)}</span>
                    <span>{fantasy ? "含境界体系" : "通用资料"}</span>
                  </span>
                </button>
                <div className="projectCardActions">
                  <button className="ghostButton smallButton" type="button" onClick={() => startEdit(project)} disabled={saving}>
                    <Pencil size={14} />
                    编辑
                  </button>
                  <button className="dangerGhostButton smallButton" type="button" onClick={() => deleteProject(project)} disabled={saving}>
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
                {editing ? (
                  <div className="projectEditPanel">
                    <label>
                      <span>书名</span>
                      <input value={editDraft.title} onChange={(event) => setEditField("title", event.target.value)} />
                    </label>
                    <label>
                      <span>题材</span>
                      <select value={editDraft.genre} onChange={(event) => setEditField("genre", event.target.value)}>
                        <option>玄幻</option>
                        <option>仙侠</option>
                        <option>都市</option>
                        <option>末日</option>
                        <option>奇幻</option>
                        <option>科幻</option>
                        <option>悬疑</option>
                        <option>其他</option>
                      </select>
                    </label>
                    <label>
                      <span>简介</span>
                      <textarea value={editDraft.premise} onChange={(event) => setEditField("premise", event.target.value)} />
                    </label>
                    <div className="projectEditActions">
                      <button className="ghostButton smallButton" type="button" onClick={() => setEditingProjectId(null)} disabled={saving}>
                        取消
                      </button>
                      <button className="saveButton smallButton" type="button" onClick={() => submitEdit(project.id)} disabled={saving || !editDraft.title.trim()}>
                        保存
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="emptyState">
          <h2>还没有小说项目</h2>
          <p>先手动添加一本小说，再进入人物、地图、时间线等资料页。</p>
        </section>
      )}
    </main>
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
  pendingChanges = [],
  onApprovePending,
  onRejectPending,
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
          <InlinePendingList changes={pendingChanges} saving={saving} onApprove={onApprovePending} onReject={onRejectPending} />
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

function PowerSystemWorkspace({ powerSystem, saving, onSave, pendingChanges = [], onApprovePending, onRejectPending }) {
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
          <InlinePendingList changes={pendingChanges} saving={saving} onApprove={onApprovePending} onReject={onRejectPending} />
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

function MapWorkspace({
  world,
  saving,
  onSaveNode,
  onDeleteNode,
  onDeleteMap,
  onSaveMap,
  onUpdateMap = async () => null,
  pendingChanges = [],
  onApprovePending,
  onRejectPending,
}) {
  const baseMaps = useMemo(() => buildMapAtlas(world), [world]);
  const viewportRef = useRef(null);
  const jsonInputRef = useRef(null);
  const toolbarImageInputRef = useRef(null);
  const mapImageEditPanelRef = useRef(null);
  const dragRef = useRef(null);
  const wheelHandlerRef = useRef(null);
  const [selectedMapId, setSelectedMapId] = useState(baseMaps[0]?.id || "");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState("");
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
  const [hiddenAreaIds, setHiddenAreaIds] = useState(() => new Set());
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
      setHighlightedNodeId("");
      return;
    }
    if (!nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(nodes[0].id);
    }
    if (highlightedNodeId && !nodes.some((node) => node.id === highlightedNodeId)) {
      setHighlightedNodeId("");
    }
    setHiddenAreaIds((current) => {
      const validIds = new Set(nodes.map((node) => node.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [nodes, selectedNodeId, highlightedNodeId]);

  useEffect(() => {
    setCamera({ x: 0, y: 0, w: MAP_SCENE.width, h: MAP_SCENE.height });
    setEditing(false);
    setEditMessage("");
    setHighlightedNodeId("");
  }, [activeMap?.id]);

  useEffect(() => {
    const clearHighlight = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mapArea, .mapNode")) {
        return;
      }
      setHighlightedNodeId("");
    };
    document.addEventListener("pointerdown", clearHighlight);
    return () => document.removeEventListener("pointerdown", clearHighlight);
  }, []);

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

  const eventToPercentPoint = (event) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const size = viewportSize();
    const left = rect?.left || 0;
    const top = rect?.top || 0;
    const sceneX = camera.x + ((event.clientX - left) / size.width) * camera.w;
    const sceneY = camera.y + ((event.clientY - top) / size.height) * camera.h;
    return { x: sceneToPercent(sceneX, "x"), y: sceneToPercent(sceneY, "y") };
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
    setHighlightedNodeId("");
    setMapEditing(true);
    setEditing(false);
    setMapEditMessage("正在新建地图，可先填写资料，也可选择图片。");
  };

  const selectMap = (mapId) => {
    setSelectedMapId(mapId);
    setHighlightedNodeId("");
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
      setHighlightedNodeId("");
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
      setHighlightedNodeId("");
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
      setHighlightedNodeId("");
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
      setHighlightedNodeId("");
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
      setHighlightedNodeId("");
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
    setHighlightedNodeId("");
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
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
  const polygonNodes = nodes
    .filter((node) => normalizeNodeShape(node.shape) === "polygon" && node.polygon_points?.length)
    .slice()
    .sort((left, right) => polygonArea(right.polygon_points || []) - polygonArea(left.polygon_points || []));
  const hiddenPolygonNodes = polygonNodes.filter((node) => hiddenAreaIds.has(node.id));
  const visiblePolygonNodes = polygonNodes.filter((node) => !hiddenAreaIds.has(node.id));
  const pointNodes = nodes.filter((node) => normalizeNodeShape(node.shape) !== "polygon" || !node.polygon_points?.length);
  const routePairs = pointNodes.slice(0, 8).flatMap((node, index, list) => (list[index + 1] ? [[node, list[index + 1]]] : []));
  const selectedIsArea = Boolean(selectedNode && normalizeNodeShape(selectedNode.shape) === "polygon");
  const selectedAreaHidden = Boolean(selectedIsArea && selectedNode && hiddenAreaIds.has(selectedNode.id));
  const hiddenAreaCount = hiddenPolygonNodes.length;
  const hasMapImage = Boolean(activeMap?.imageId && activeMap?.imageData && activeMap.imageData !== EMPTY_MAP_IMAGE_DATA);

  const selectPolygonAtEvent = (event, fallbackNode) => {
    event.stopPropagation();
    const point = eventToPercentPoint(event);
    const matchedNodes = visiblePolygonNodes.filter((node) => pointInPolygon(point, node.polygon_points || []));
    const candidates = matchedNodes.length ? matchedNodes : [fallbackNode];
    const currentIndex = candidates.findIndex((node) => node.id === highlightedNodeId);
    const nextNode = currentIndex >= 0 ? candidates[(currentIndex + 1) % candidates.length] : fallbackNode;
    setSelectedNodeId(nextNode.id);
    setHighlightedNodeId(nextNode.id);
    setEditing(false);
  };

  const showHiddenArea = (nodeId) => {
    setHiddenAreaIds((current) => {
      if (!current.has(nodeId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(nodeId);
      return next;
    });
    setSelectedNodeId(nodeId);
    setHighlightedNodeId(nodeId);
    setEditing(false);
  };

  const toggleSelectedAreaVisibility = () => {
    if (!selectedIsArea || !selectedNode) {
      return;
    }
    if (hiddenAreaIds.has(selectedNode.id)) {
      showHiddenArea(selectedNode.id);
      return;
    }
    setHiddenAreaIds((current) => {
      const next = new Set(current);
      next.add(selectedNode.id);
      return next;
    });
    setHighlightedNodeId("");
  };

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
          <InlinePendingList changes={pendingChanges} saving={saving} onApprove={onApprovePending} onReject={onRejectPending} />
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
                  {visiblePolygonNodes.map((node) => {
                    const points = (node.polygon_points || []).map(pointToScene);
                    const pointText = points.map((point) => `${point.x},${point.y}`).join(" ");
                    const center = pointToScene({ x: node.x, y: node.y });
                    const active = node.id === highlightedNodeId;
                    return (
                      <g
                        key={node.id}
                        className={active ? "mapArea active" : "mapArea"}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => selectPolygonAtEvent(event, node)}
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
                    const active = node.id === highlightedNodeId;
                    return (
                      <g
                        key={node.id}
                        className={active ? "mapNode active" : "mapNode"}
                        transform={`translate(${point.x} ${point.y})`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setHighlightedNodeId(node.id);
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
                        {[
                          activeMap?.layer,
                          activeMap?.scope,
                          `当前层级显示 ${nodes.length} 个节点`,
                          polygonNodes.length ? (hiddenAreaCount ? `${visiblePolygonNodes.length}/${polygonNodes.length} 个范围显示` : `${polygonNodes.length} 个范围`) : "",
                        ]
                          .filter(Boolean)
                          .join("、")}
                      </div>
                    </div>
                    {hiddenPolygonNodes.length ? (
                      <div className="kv">
                        <span>隐藏区域</span>
                        <div className="hiddenAreaList">
                          {hiddenPolygonNodes.map((node) => (
                            <button
                              key={`hidden-area-${node.id}`}
                              className="chip hiddenAreaButton"
                              type="button"
                              onClick={() => showHiddenArea(node.id)}
                              disabled={saving}
                              aria-label={`显示隐藏区域 ${node.name}`}
                            >
                              <Eye size={14} />
                              {node.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </section>

            <section className={editing && draft.id ? "mapInfoCard editing" : "mapInfoCard"}>
              <div className="panelTitle">
                <h3>{selectedIsArea ? "选中区域" : "选中节点"}</h3>
                <span className="cardActions">
                  {selectedNode && selectedIsArea && !editing ? (
                    <button
                      className="ghostButton compactButton"
                      type="button"
                      onClick={toggleSelectedAreaVisibility}
                      disabled={saving}
                      aria-label={selectedAreaHidden ? "显示区域" : "隐藏区域"}
                    >
                      {selectedAreaHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                      {selectedAreaHidden ? "显示区域" : "隐藏区域"}
                    </button>
                  ) : null}
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

function TimelineWorkspace({ timeline = [], pendingChanges = [], saving = false, onApprovePending, onRejectPending }) {
  const pageRef = useRef(null);
  const treeRef = useRef(null);
  const navRef = useRef(null);
  const closeTimerRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [activeEventId, setActiveEventId] = useState("");
  const [visibleDetailId, setVisibleDetailId] = useState("");
  const [closingDetailId, setClosingDetailId] = useState("");
  const [bottomAlignedIds, setBottomAlignedIds] = useState([]);
  const [detailMaxHeights, setDetailMaxHeights] = useState({});
  const [expandedEras, setExpandedEras] = useState([]);
  const normalizedEvents = useMemo(
    () => timeline.filter((event) => !isChapterSummaryTimelineSignal(event)).map((event, index) => normalizeTimelineEvent(event, index)),
    [timeline]
  );
  const filteredEvents = useMemo(
    () =>
      normalizedEvents
        .filter((event) => timelineEventMatches(event, activeFilter, keyword.trim()))
        .sort((left, right) => left.sort - right.sort),
    [normalizedEvents, activeFilter, keyword]
  );
  const groups = useMemo(() => groupTimelineByEra(filteredEvents), [filteredEvents]);

  useEffect(() => {
    if (activeEventId && !filteredEvents.some((event) => event.id === activeEventId)) {
      setActiveEventId("");
      setVisibleDetailId("");
      setClosingDetailId("");
    }
  }, [activeEventId, filteredEvents]);

  useEffect(() => {
    const scope = treeRef.current;
    if (!scope || prefersReducedMotion()) {
      return;
    }
    const ctx = gsap.context(() => {
      const timelineAnimation = gsap.timeline({ defaults: { duration: 0.36, ease: "power2.out" } });
      timelineAnimation
        .from(".eraHeader", { autoAlpha: 0, y: 10, stagger: 0.05 })
        .from(".treeDot", { autoAlpha: 0, scale: 0.82, stagger: 0.035 }, "<0.02")
        .from(".eventCard", { autoAlpha: 0, y: 16, stagger: 0.04 }, "<0.08");
    }, scope);
    return () => ctx.revert();
  }, [activeFilter, keyword, timeline.length]);

  const updateNavigatorPosition = () => {
    const page = pageRef.current;
    const nav = navRef.current;
    const tree = treeRef.current;
    if (!page || !nav || !tree) {
      return;
    }
    if (window.innerWidth <= 1080) {
      nav.classList.remove("isSticky");
      nav.style.top = "";
      nav.style.left = "";
      nav.style.right = "";
      return;
    }

    const stickyTop = 118;
    const rightGap = 18;
    const pageRect = page.getBoundingClientRect();
    const navWidth = nav.offsetWidth;
    const naturalTop = tree.offsetTop;
    const naturalViewportTop = pageRect.top + naturalTop;
    const fixedLeft = window.innerWidth - navWidth - rightGap;
    const absoluteLeft = fixedLeft - pageRect.left;

    nav.style.left = `${absoluteLeft}px`;
    nav.style.right = "auto";

    if (naturalViewportTop <= stickyTop) {
      nav.classList.add("isSticky");
      nav.style.top = `${stickyTop}px`;
      nav.style.left = `${fixedLeft}px`;
    } else {
      nav.classList.remove("isSticky");
      nav.style.top = `${naturalTop}px`;
    }
  };

  useEffect(() => {
    updateNavigatorPosition();
    window.addEventListener("resize", updateNavigatorPosition);
    window.addEventListener("scroll", updateNavigatorPosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updateNavigatorPosition);
      window.removeEventListener("scroll", updateNavigatorPosition);
    };
  }, [groups.length, expandedEras.length]);

  useEffect(() => {
    updateNavigatorPosition();
  }, [groups, expandedEras]);

  useEffect(() => {
    if (!visibleDetailId) {
      return;
    }
    const detail = treeRef.current?.querySelector(`[data-detail="${visibleDetailId}"]`);
    const wrap = detail?.closest(".eventWrap");
    if (!detail || !wrap) {
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const detailHeight = detail.scrollHeight;
    const wouldOverflow = wrapRect.top + detailHeight > window.innerHeight - 24;
    const topIfBottomAligned = wrapRect.bottom - detailHeight;
    const shouldBottomAlign = wouldOverflow && topIfBottomAligned >= 24;
    setBottomAlignedIds((current) => {
      const next = new Set(current);
      if (shouldBottomAlign) {
        next.add(visibleDetailId);
      } else {
        next.delete(visibleDetailId);
      }
      return [...next];
    });
    setDetailMaxHeights((current) => {
      const next = { ...current };
      if (wouldOverflow && !shouldBottomAlign) {
        next[visibleDetailId] = Math.max(260, window.innerHeight - wrapRect.top - 24);
      } else {
        delete next[visibleDetailId];
      }
      return next;
    });
  }, [visibleDetailId]);

  useEffect(() => {
    if (!visibleDetailId) {
      return;
    }
    const detail = treeRef.current?.querySelector(`[data-detail="${visibleDetailId}"]`);
    if (!detail || prefersReducedMotion()) {
      return;
    }
    gsap.fromTo(detail, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: "power2.out", overwrite: "auto" });
  }, [visibleDetailId]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const selectEvent = (eventId) => {
    window.clearTimeout(closeTimerRef.current);
    if (activeEventId === eventId) {
      setActiveEventId("");
      setClosingDetailId(eventId);
      const detail = treeRef.current?.querySelector(`[data-detail="${eventId}"]`);
      if (detail && !prefersReducedMotion()) {
        gsap.to(detail, {
          autoAlpha: 0,
          y: 8,
          duration: 0.18,
          ease: "power2.out",
          overwrite: "auto",
          onComplete: () => {
            setVisibleDetailId("");
            setClosingDetailId("");
            setBottomAlignedIds((current) => current.filter((id) => id !== eventId));
            setDetailMaxHeights((current) => {
              const next = { ...current };
              delete next[eventId];
              return next;
            });
          },
        });
      } else {
        closeTimerRef.current = window.setTimeout(() => {
          setVisibleDetailId("");
          setClosingDetailId("");
          setBottomAlignedIds((current) => current.filter((id) => id !== eventId));
          setDetailMaxHeights((current) => {
            const next = { ...current };
            delete next[eventId];
            return next;
          });
        }, 0);
      }
      return;
    }
    setClosingDetailId("");
    setActiveEventId(eventId);
    setVisibleDetailId(eventId);
  };

  const toggleEra = (era) => {
    setExpandedEras((current) => (current.includes(era) ? current.filter((item) => item !== era) : [...current, era]));
  };

  const jumpToEvent = (eventId) => {
    selectEvent(eventId);
    treeRef.current?.querySelector(`[data-wrap="${eventId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="timelinePage" ref={pageRef}>
      <section className="timelineToolbar">
        <label className="timelineSearchBox">
          <span>搜索事件</span>
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="纪年、人物、地点、势力、伏笔关键词"
          />
        </label>
        <div className="timelineFilterGrid">
          {timelineFilters.map((filter) => (
            <button
              className={filter.id === activeFilter ? "filterButton active" : "filterButton"}
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <aside className="eraNavigator" ref={navRef} aria-label="纪年导航">
        <div className="panelHead">
          <h2>纪年导航</h2>
          <span className="chip">{groups.length} 纪</span>
        </div>
        {groups.map((group) => {
          const collapsed = !expandedEras.includes(group.era);
          return (
            <section className={collapsed ? "eraNavGroup collapsed" : "eraNavGroup"} key={group.era}>
              <button className="eraNavToggle" type="button" onClick={() => toggleEra(group.era)}>
                {group.era}
                <span>{group.events.length} 条</span>
              </button>
              <div className="eraNavItems">
                {group.events.map((event) => (
                  <button
                    className={event.id === activeEventId ? "eraNavItem active" : "eraNavItem"}
                    type="button"
                    key={event.id}
                    onClick={() => jumpToEvent(event.id)}
                  >
                    {event.year}
                    <br />
                    {event.title}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </aside>

      <section className="timelineTree" ref={treeRef}>
        <InlinePendingList changes={pendingChanges} saving={saving} onApprove={onApprovePending} onReject={onRejectPending} />
        {!groups.length ? (
          <div className="timelineEmpty">没有符合当前筛选条件的纪年事件。</div>
        ) : (
          groups.map((group) => (
            <section className="eraBlock" key={group.era}>
              <div className="eraHeader">
                <strong>{group.era}</strong>
                <span>{group.events.length} 条事件</span>
              </div>
              {group.events.map((event) => (
                <TimelineTimeNode
                  activeEventId={activeEventId}
                  bottomAligned={bottomAlignedIds.includes(event.id)}
                  closing={closingDetailId === event.id}
                  detailMaxHeight={detailMaxHeights[event.id] || 0}
                  event={event}
                  key={event.id}
                  onSelect={selectEvent}
                  visible={visibleDetailId === event.id}
                />
              ))}
            </section>
          ))
        )}
      </section>
    </main>
  );
}

function TimelineTimeNode({ event, activeEventId, visible, closing, bottomAligned, detailMaxHeight, onSelect }) {
  const leftEvent = event.side === "left";
  return (
    <div className="timeNode">
      <div className="side left">{leftEvent ? <TimelineEventWrap event={event} activeEventId={activeEventId} visible={visible} closing={closing} bottomAligned={bottomAligned} detailMaxHeight={detailMaxHeight} onSelect={onSelect} /> : null}</div>
      <div className="treeDot" aria-hidden="true"></div>
      <div className="side right">{!leftEvent ? <TimelineEventWrap event={event} activeEventId={activeEventId} visible={visible} closing={closing} bottomAligned={bottomAligned} detailMaxHeight={detailMaxHeight} onSelect={onSelect} /> : null}</div>
    </div>
  );
}

function TimelineEventWrap({ event, activeEventId, visible, closing, bottomAligned, detailMaxHeight, onSelect }) {
  return (
    <div className={`eventWrap ${event.side}`} data-wrap={event.id}>
      <span className="connector"></span>
      <span className="timeRibbon">
        {event.year}
        {event.timeNote ? (
          <>
            <br />
            {event.timeNote}
          </>
        ) : null}
      </span>
      <button className={event.id === activeEventId ? "eventCard active" : "eventCard"} type="button" onClick={() => onSelect(event.id)}>
        <div className="eventHead">
          <h3>{event.title}</h3>
          <span className={`typePill ${timelineTypeClass[event.type] || ""}`}>{event.type}</span>
        </div>
        <p className="eventSummary">{event.summary}</p>
        <div className="eventMeta">
          <span className="chip">叙述：{event.narrative}</span>
          <span className="chip">{event.location}</span>
        </div>
        <div className="eventTags">
          {event.characters.slice(0, 3).map((name) => (
            <span className="chip" key={name}>
              {name}
            </span>
          ))}
          {event.hooks.slice(0, 2).map((hook) => (
            <span className="chip" key={hook}>
              {hook}
            </span>
          ))}
        </div>
      </button>
      {visible || closing ? <TimelineDetail event={event} visible={visible || closing} bottomAligned={bottomAligned} detailMaxHeight={detailMaxHeight} /> : null}
    </div>
  );
}

function TimelineDetail({ event, visible, bottomAligned, detailMaxHeight }) {
  return (
    <section
      className={`detailCard ${visible ? "isOpen" : ""} ${bottomAligned ? "alignBottom" : ""} ${detailMaxHeight ? "constrainHeight" : ""}`}
      data-detail={event.id}
      style={detailMaxHeight ? { "--detail-max-height": `${detailMaxHeight}px` } : undefined}
    >
      <p className="eyebrow">事件详情</p>
      <h3>{event.title}</h3>
      <p className="detailLead">
        {event.year}
        {event.timeNote ? `，${event.timeNote}` : ""}
      </p>
      <div className="detailDivider"></div>
      <div className="kvList">
        <div className="kv">
          <span>事件类型</span>
          <div className="eventTags">
            <span className={`typePill ${timelineTypeClass[event.type] || ""}`}>{event.type}</span>
            <span className="chip">{event.narrative}</span>
          </div>
        </div>
        <div className="kv">
          <span>事件经过</span>
          <div>{event.summary}</div>
        </div>
        <div className="kv">
          <span>涉及人物</span>
          <div className="eventTags">
            {event.characters.length ? event.characters.map((name) => <span className="chip" key={name}>{name}</span>) : <span className="chip">未记录</span>}
          </div>
        </div>
        <div className="kv">
          <span>地点与势力</span>
          <div className="eventTags">
            <span className="chip">{event.location}</span>
            {event.factions.map((name) => (
              <span className="chip" key={name}>
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="kv">
          <span>影响结果</span>
          <div>{event.consequences}</div>
        </div>
        <div className="kv">
          <span>伏笔变化</span>
          <div className="hookBox">
            {event.hooks.length ? (
              event.hooks.map((hook, index) => (
                <div className="hookItem" key={hook}>
                  <strong>{hook}</strong>
                  <span>{index === 0 ? "当前事件重点伏笔，后续章节需要持续追踪。" : "关联伏笔，进入纪年时间树索引。"}</span>
                </div>
              ))
            ) : (
              <div className="hookItem">
                <strong>暂无伏笔记录</strong>
                <span>后续可由作者或 LLM 补充。</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ChapterOverviewWorkspace({
  chapterSummaries = [],
  timeline = [],
  saving = false,
  onSaveChapterSummary = async () => false,
  onDeleteChapterSummary = async () => false,
  pendingChanges = [],
  onApprovePending,
  onRejectPending,
}) {
  const [{ chapters, events }, setOverview] = useState(() => buildChapterOverview(chapterSummaries, timeline));
  const [activeChapter, setActiveChapter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("全部");
  const [keyword, setKeyword] = useState("");
  const [activeEventId, setActiveEventId] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingChapter, setEditingChapter] = useState(0);
  const [draft, setDraft] = useState({
    chapter: "1",
    title: "",
    summary: "",
    facts_text: "",
    hooks_text: "",
  });

  useEffect(() => {
    const next = buildChapterOverview(chapterSummaries, timeline);
    setOverview(next);
    setActiveEventId((current) => {
      if (current && next.events.some((event) => event.id === current)) {
        return current;
      }
      return next.events[0]?.id || "";
    });
  }, [chapterSummaries, timeline]);

  const summaryByChapter = useMemo(() => {
    return new Map(chapterSummaries.map((summary) => [normalizeChapterNumber(summary.chapter), summary]));
  }, [chapterSummaries]);

  const filteredEvents = useMemo(() => {
    const needle = keyword.trim();
    return events.filter((event) => {
      const chapterOk = activeChapter === "all" || event.chapter === Number(activeChapter.replace("chapter-", ""));
      const typeOk = activeFilter === "全部" || event.type === activeFilter;
      const text = [
        event.title,
        event.summary,
        event.location,
        event.time,
        event.status,
        event.characters.join(" "),
        event.factions.join(" "),
        event.hooks.join(" "),
      ].join(" ");
      return chapterOk && typeOk && (!needle || text.includes(needle));
    });
  }, [activeChapter, activeFilter, events, keyword]);

  useEffect(() => {
    if (filteredEvents.length && !filteredEvents.some((event) => event.id === activeEventId)) {
      setActiveEventId(filteredEvents[0].id);
    }
  }, [activeEventId, filteredEvents]);

  const activeEvent = events.find((event) => event.id === activeEventId) || filteredEvents[0] || events[0] || null;
  const chapterCards = [{ id: "all", label: "全书", title: "全部章节事实", note: "按叙述章节查看关键事实" }, ...chapters];
  const grouped = chapters
    .map((chapter) => ({
      chapter,
      events: filteredEvents.filter((event) => event.chapter === chapter.chapter),
    }))
    .filter((group) => group.events.length);
  const currentChapter = chapterCards.find((chapter) => chapter.id === activeChapter) || chapterCards[0];

  const startAddChapter = () => {
    const nextChapter = chapters.length ? Math.max(...chapters.map((chapter) => chapter.chapter)) + 1 : 1;
    setDraft({
      chapter: String(nextChapter),
      title: "",
      summary: "",
      facts_text: "",
      hooks_text: "",
    });
    setEditingChapter(0);
    setAdding(true);
  };

  const startEditChapter = (chapter) => {
    const summary = summaryByChapter.get(chapter.chapter) || {};
    setDraft({
      chapter: String(chapter.chapter),
      title: summary.title || chapter.title || "",
      summary: summary.summary || (chapter.note && !["章节资料待补充", "由时间线事件生成的章节事实"].includes(chapter.note) ? chapter.note : ""),
      facts_text: textList(summary.facts || []).join("\n"),
      hooks_text: textList(summary.hooks || []).join("\n"),
    });
    setEditingChapter(chapter.chapter);
    setAdding(true);
  };

  const setDraftField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveDraft = async () => {
    const chapter = Number(draft.chapter);
    const ok = await onSaveChapterSummary({
      chapter,
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      facts: splitLines(draft.facts_text),
      hooks: splitLines(draft.hooks_text),
    });
    if (ok) {
      setAdding(false);
      setEditingChapter(0);
      setActiveChapter(`chapter-${chapter}`);
      setActiveFilter("全部");
      setKeyword("");
    }
  };

  const deleteDraft = async () => {
    const chapter = Number(draft.chapter);
    if (!chapter) {
      return;
    }
    const confirmed = window.confirm(`确定删除第 ${chapter} 章概览吗？这会删除章节摘要和自动生成的摘要信号，不会删除普通时间线事件。`);
    if (!confirmed) {
      return;
    }
    const ok = await onDeleteChapterSummary(chapter);
    if (ok) {
      setAdding(false);
      setEditingChapter(0);
      setActiveChapter("all");
      setActiveEventId("");
    }
  };

  const selectChapter = (chapterId) => {
    setActiveChapter(chapterId);
    const chapterEvents =
      chapterId === "all"
        ? events
        : events.filter((event) => event.chapter === Number(String(chapterId).replace("chapter-", "")));
    const next = chapterEvents.find((event) => activeFilter === "全部" || event.type === activeFilter) || chapterEvents[0] || "";
    setActiveEventId(next?.id || "");
  };

  return (
    <main className="chapterOverviewPage">
      <aside className="chapterOverviewPanel chapterOverviewSidebar">
        <div className="chapterOverviewPanelHead">
          <h2>章节册</h2>
          <span className="chapterOverviewHeadActions">
            <span className="chapterOverviewBadge">{chapters.length} 章</span>
            <button className="chapterOverviewAddButton" type="button" onClick={startAddChapter} disabled={saving}>
              <Plus size={15} />
              新增
            </button>
          </span>
        </div>

        {adding ? (
          <section className="chapterOverviewAddCard" aria-label="新增章节概览">
            <div className="chapterOverviewFormHead">
              <strong>{editingChapter ? `编辑第 ${editingChapter} 章` : "新增章节概览"}</strong>
              <span className="chapterOverviewChip">{editingChapter ? "编辑" : "新增"}</span>
            </div>
            <label>
              <span>章节号</span>
              <input
                aria-label="章节号"
                type="number"
                min="1"
                step="1"
                value={draft.chapter}
                onChange={(event) => setDraftField("chapter", event.target.value)}
              />
            </label>
            <label>
              <span>章节标题</span>
              <input
                aria-label="章节标题"
                value={draft.title}
                onChange={(event) => setDraftField("title", event.target.value)}
                placeholder="如：问心阶异象"
              />
            </label>
            <label>
              <span>章节摘要</span>
              <textarea
                aria-label="章节摘要"
                value={draft.summary}
                onChange={(event) => setDraftField("summary", event.target.value)}
                placeholder="这一章讲述、揭示或补完了什么"
              />
            </label>
            <label>
              <span>关键事实</span>
              <textarea
                aria-label="关键事实"
                value={draft.facts_text}
                onChange={(event) => setDraftField("facts_text", event.target.value)}
                placeholder="每行一条事实"
              />
            </label>
            <label>
              <span>伏笔</span>
              <textarea
                aria-label="伏笔"
                value={draft.hooks_text}
                onChange={(event) => setDraftField("hooks_text", event.target.value)}
                placeholder="每行一条伏笔"
              />
            </label>
            <div className="chapterOverviewAddActions">
              <button className="chapterOverviewGhostButton" type="button" onClick={() => setAdding(false)} disabled={saving}>
                取消
              </button>
              {editingChapter ? (
                <button className="dangerButton" type="button" onClick={deleteDraft} disabled={saving}>
                  删除
                </button>
              ) : null}
              <button className="saveButton" type="button" onClick={saveDraft} disabled={saving || !draft.summary.trim() || !Number(draft.chapter)}>
                {editingChapter ? "保存修改" : "保存章节"}
              </button>
            </div>
          </section>
        ) : null}

        <label className="chapterOverviewSearchBox">
          <span>搜索事件</span>
          <input
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="人物、地点、势力、伏笔关键词"
          />
        </label>

        <div className="chapterOverviewFilterGrid">
          {chapterOverviewFilters.map((filter) => (
            <button
              className={filter.id === activeFilter ? "chapterOverviewFilter active" : "chapterOverviewFilter"}
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="chapterOverviewChapterList">
          {chapterCards.map((chapter) => {
            const list = chapter.id === "all" ? events : events.filter((event) => event.chapter === chapter.chapter);
            const hookCount = list.filter((event) => event.type === "伏笔").length;
            return (
              <div
                className={chapter.id === activeChapter ? "chapterOverviewChapterCard active" : "chapterOverviewChapterCard"}
                key={chapter.id}
              >
                <button className="chapterOverviewChapterSelect" type="button" onClick={() => selectChapter(chapter.id)}>
                  <span className="chapterOverviewStats">
                    <span className="chapterOverviewChip">{chapter.label}</span>
                    <span className="chapterOverviewChip">{list.length} 事</span>
                    {hookCount ? <span className="chapterOverviewChip">{hookCount} 伏笔</span> : null}
                  </span>
                  <strong>{chapter.title}</strong>
                  <small>{chapter.note}</small>
                </button>
                {chapter.id !== "all" ? (
                  <button className="chapterOverviewCardEdit" type="button" onClick={() => startEditChapter(chapter)} disabled={saving} aria-label={`编辑${chapter.label}`}>
                    <Pencil size={14} />
                    编辑
                  </button>
                ) : null}
              </div>
            );
          })}
          <InlinePendingList changes={pendingChanges} saving={saving} onApprove={onApprovePending} onReject={onRejectPending} />
        </div>
      </aside>

      <section className="chapterOverviewPanel chapterOverviewTimelinePanel">
        <div className="chapterOverviewTop">
          <div>
            <p className="eyebrow">当前视图</p>
            <h2>{activeChapter === "all" ? "全书章节事实册" : `${currentChapter.label}：${currentChapter.title}`}</h2>
            <p>{activeFilter === "全部" ? "按叙述章节显示已经确认的关键事实。点击事件可查看结构化详情。" : `当前只显示「${activeFilter}」章节事实。`}</p>
          </div>
          <div className="chapterOverviewModeTabs" aria-label="章节概览模式">
            <button className="chapterOverviewGhostButton active" type="button">章节事实</button>
            <button className="chapterOverviewGhostButton" type="button">章节摘要</button>
            <button className="chapterOverviewGhostButton" type="button">本章伏笔</button>
          </div>
        </div>

        <div className="chapterOverviewBody">
          {!grouped.length ? (
            <div className="chapterOverviewEmpty">没有符合当前筛选条件的章节事实。</div>
          ) : (
            grouped.map((group) => (
              <section className="chapterOverviewGroup" key={group.chapter.id}>
                <div className="chapterOverviewMarker">
                  <strong>{group.chapter.label}</strong>
                  <span>{group.chapter.title}</span>
                  <span>{group.events.length} 条事件</span>
                </div>
                <div className="chapterOverviewRail">
                  {group.events.map((event) => (
                    <button
                      className={event.id === activeEvent?.id ? "chapterOverviewEventCard active" : "chapterOverviewEventCard"}
                      key={event.id}
                      type="button"
                      onClick={() => setActiveEventId(event.id)}
                    >
                      <div className="chapterOverviewEventHead">
                        <div className="chapterOverviewEventTitle">
                          <strong>{event.title}</strong>
                          <small>
                            第 {event.chapter} 章 · 事件 {event.order} · {event.time}
                          </small>
                        </div>
                        <span className={`chapterOverviewTypePill ${chapterOverviewTypeClass[event.type] || ""}`}>{event.type}</span>
                      </div>
                      <p>{event.summary}</p>
                      <div className="chapterOverviewEventMeta">
                        <span className="chapterOverviewChip">{event.location}</span>
                        <span className="chapterOverviewChip">{event.status}</span>
                        {event.characters.slice(0, 3).map((name) => (
                          <span className="chapterOverviewChip" key={`${event.id}-${name}`}>
                            {name}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      <aside className="chapterOverviewDetailColumn">
        <section className="chapterOverviewPanel chapterOverviewDetailCard">
          <div className="chapterOverviewDetailTitle">
            <p className="eyebrow">事件详情</p>
            <h2>{activeEvent?.title || "选择一个事件"}</h2>
            <p>
              {activeEvent
                ? `第 ${activeEvent.chapter} 章，${activeEvent.time}，${activeEvent.location}`
                : "右侧显示本章中被讲述或揭示的事件、参与者、地点、势力、影响结果和伏笔变化。"}
            </p>
          </div>
          {activeEvent ? (
            <div className="chapterOverviewKvList">
              <div className="chapterOverviewKv">
                <span>事件类型</span>
                <div className="chapterOverviewTagList">
                  <span className={`chapterOverviewTypePill ${chapterOverviewTypeClass[activeEvent.type] || ""}`}>{activeEvent.type}</span>
                  <span className="chapterOverviewChip">{activeEvent.status}</span>
                  <span className="chapterOverviewChip">{activeEvent.source}</span>
                </div>
              </div>
              <div className="chapterOverviewKv">
                <span>事件经过</span>
                <div>{activeEvent.summary}</div>
              </div>
              <div className="chapterOverviewKv">
                <span>涉及人物</span>
                <div className="chapterOverviewTagList">
                  {activeEvent.characters.length ? activeEvent.characters.map((name) => <span className="chapterOverviewChip" key={name}>{name}</span>) : <span className="chapterOverviewChip">未记录</span>}
                </div>
              </div>
              <div className="chapterOverviewKv">
                <span>地点与势力</span>
                <div className="chapterOverviewTagList">
                  <span className="chapterOverviewChip">{activeEvent.location}</span>
                  {activeEvent.factions.map((name) => (
                    <span className="chapterOverviewChip" key={name}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="chapterOverviewKv">
                <span>影响结果</span>
                <div>{activeEvent.consequences}</div>
              </div>
              <div className="chapterOverviewKv">
                <span>伏笔变化</span>
                <div className="chapterOverviewHookList">
                  {activeEvent.hooks.length ? (
                    activeEvent.hooks.map((hook, index) => (
                      <div className="chapterOverviewHookItem" key={`${activeEvent.id}-${hook}`}>
                        <strong>{hook}</strong>
                        <span>{index === 0 ? "当前章节重点伏笔，后续章节需要持续追踪。" : "关联伏笔，进入章节事实索引。"}</span>
                      </div>
                    ))
                  ) : (
                    <div className="chapterOverviewHookItem">
                      <strong>暂无伏笔记录</strong>
                      <span>后续可由作者或 LLM 补充。</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="chapterOverviewPanel chapterOverviewLegendCard">
          <div className="chapterOverviewPanelHead">
            <h3>章节事实类型</h3>
            <span className="chapterOverviewBadge">{filteredEvents.length} 条</span>
          </div>
          <div className="chapterOverviewLegendGrid">
            <span className="chapterOverviewTypePill main">主线推进</span>
            <span className="chapterOverviewTypePill character">人物变化</span>
            <span className="chapterOverviewTypePill faction">势力变化</span>
            <span className="chapterOverviewTypePill hook">伏笔</span>
            <span className="chapterOverviewTypePill danger">死亡失踪</span>
            <span className="chapterOverviewTypePill setting">设定补充</span>
          </div>
        </section>
      </aside>
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
  pendingChanges = [],
  onApprovePending,
  onRejectPending,
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
            </div>
          )}
          <InlinePendingList changes={pendingChanges} saving={saving} onApprove={onApprovePending} onReject={onRejectPending} />
          <button className="ghostButton listFooterButton" onClick={onNew} disabled={saving}>
            <Plus size={16} />
            新建势力
          </button>
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
  BookshelfWorkspace,
  CharacterEditor,
  FactionEditor,
  MapWorkspace,
  PendingPreviewPanel,
  TimelineWorkspace,
  ChapterOverviewWorkspace,
  buildMapAtlas,
  buildChapterOverview,
  characterDraft,
  draftToMapImagePayload,
  draftToMapNodePayload,
  draftToFactionPatch,
  draftToPowerSystemPatch,
  draftToPatch,
  factionDraft,
  factionStatusTone,
  isFantasyProject,
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
