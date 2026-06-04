import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PowerSystemWorkspace,
  CharacterEditor,
  ChapterOverviewWorkspace,
  App,
  BookshelfWorkspace,
  FactionEditor,
  MapWorkspace,
  PendingPreviewPanel,
  TimelineWorkspace,
  buildMapAtlas,
  buildChapterOverview,
  characterDraft,
  draftToFactionPatch,
  draftToMapImagePayload,
  draftToMapNodePayload,
  draftToPowerSystemPatch,
  factionDraft,
  isFantasyProject,
  isAliveStatus,
  joinLines,
  mapImportTemplate,
  mapToExportJson,
  normalizeFactionStatusLabel,
  normalizeImportedMapJson,
  powerSystemDraft,
  splitLines,
} from "./main.jsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BookshelfWorkspace", () => {
  it("renders project cards and creates a project from the inline form", () => {
    const onOpen = vi.fn();
    const onCreate = vi.fn().mockResolvedValue(true);
    const onUpdate = vi.fn().mockResolvedValue(true);
    const onDelete = vi.fn().mockResolvedValue(true);
    const onSetDraft = vi.fn((updater) => {
      draft = typeof updater === "function" ? updater(draft) : updater;
      rerenderView();
    });
    const onSetAdding = vi.fn();
    let draft = { title: "", genre: "玄幻", premise: "" };
    let view;
    const rerenderView = () => {
      view.rerender(
        <BookshelfWorkspace
          projects={[
            { id: 1, title: "万道归墟", genre: "玄幻", premise: "九天十地。", updated_at: "2026-06-04" },
            { id: 2, title: "雾城旧案", genre: "悬疑", premise: "旧城迷案。", updated_at: "2026-06-03" },
          ]}
          activeProject={{ id: 1 }}
          adding
          draft={draft}
          saving={false}
          onSetAdding={onSetAdding}
          onSetDraft={onSetDraft}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      );
    };
    let adding = true;

    view = render(
      <BookshelfWorkspace
        projects={[
          { id: 1, title: "万道归墟", genre: "玄幻", premise: "九天十地。", updated_at: "2026-06-04" },
          { id: 2, title: "雾城旧案", genre: "悬疑", premise: "旧城迷案。", updated_at: "2026-06-03" },
        ]}
        activeProject={{ id: 1 }}
        adding={adding}
        draft={draft}
        saving={false}
        onSetAdding={onSetAdding}
        onSetDraft={onSetDraft}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onOpen={onOpen}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /万道归墟/ }));
    expect(onOpen).toHaveBeenCalledWith(1);
    expect(screen.getByText("含境界体系")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("书名"), { target: { value: "长夜星火" } });
    fireEvent.change(screen.getByLabelText("题材"), { target: { value: "科幻" } });
    fireEvent.change(screen.getByLabelText("简介"), { target: { value: "星际边境档案。" } });
    fireEvent.click(screen.getByRole("button", { name: "创建小说" }));

    expect(onCreate).toHaveBeenCalledWith({ title: "长夜星火", genre: "科幻", premise: "星际边境档案。" });

    fireEvent.click(screen.getAllByRole("button", { name: "编辑" })[0]);
    fireEvent.change(screen.getAllByLabelText("书名")[1], { target: { value: "万道新名" } });
    fireEvent.change(screen.getAllByLabelText("简介")[1], { target: { value: "重写后的简介。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onUpdate).toHaveBeenCalledWith(1, { title: "万道新名", genre: "玄幻", premise: "重写后的简介。" });

    fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1, title: "万道归墟" }));
  });

  it("detects fantasy projects by genre", () => {
    expect(isFantasyProject({ genre: "玄幻·爽文" })).toBe(true);
    expect(isFantasyProject({ genre: "仙侠" })).toBe(true);
    expect(isFantasyProject({ genre: "都市" })).toBe(false);
  });
});

describe("App project shelf", () => {
  it("starts on the bookshelf and hides realm tab for non-fantasy projects after switching", async () => {
    const dashboard = {
      project: { id: 2, title: "雾城旧案", genre: "悬疑", premise: "旧城迷案。", is_active: 1, updated_at: "2026-06-03" },
      projects: [
        { id: 1, title: "万道归墟", genre: "玄幻", premise: "九天十地。", updated_at: "2026-06-04" },
        { id: 2, title: "雾城旧案", genre: "悬疑", premise: "旧城迷案。", is_active: 1, updated_at: "2026-06-03" },
      ],
      characters: [],
      world: {},
      timeline: [],
      chapter_summaries: [],
      pending_changes: [],
    };
    const fetchMock = vi.fn(async (url) => {
      const text = String(url);
      if (text.includes("/api/dashboard")) {
        return new Response(JSON.stringify(dashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (text.includes("/api/factions")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (text.includes("/api/projects/2/switch")) {
        return new Response(JSON.stringify({ dashboard }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByRole("heading", { name: "小说书架" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /雾城旧案/ }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "雾城旧案" })).toBeInTheDocument());
    expect(screen.queryByText("旧城迷案。")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /境界体系/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /势力结构/ }));
    expect(screen.getAllByRole("button", { name: "新建势力" })).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/projects/2/switch"), expect.objectContaining({ method: "POST" }));
  });
});

describe("PendingPreviewPanel", () => {
  it("shows rendered preview first and keeps JSON collapsed until editing", () => {
    render(
      <PendingPreviewPanel
        title="人物待审核"
        changes={[
          {
            id: 101,
            module_type: "characters",
            target_type: "character",
            target_name: "沈照夜",
            target_entity: "沈照夜",
            reason: "MCP 自测写入",
            patch: {
              姓名: "沈照夜",
              性别: "男",
              角色身份: "主角",
              当前境界: "星火境",
              身份: "边城守夜人",
              性格: "沉稳克制",
            },
            validation: { ok: true, errors: [] },
          },
        ]}
        saving={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText("界面预览")).toBeInTheDocument();
    expect(screen.getAllByText("沈照夜").length).toBeGreaterThan(0);
    expect(screen.queryByText("JSON 原文 / 可编辑")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/沈照夜/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑 JSON" }));

    expect(screen.getByText("JSON 原文 / 可编辑")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/沈照夜/)).toBeInTheDocument();
  });
});

describe("character helpers", () => {
  it("normalizes character drafts for the chinese role page", () => {
    expect(
      characterDraft({
        name: "林夜",
        gender: "男",
        personality: "冷静",
        realm: "筑基中期",
        identity: "天元宗外门弟子",
        role: "主角",
        status: "active",
        abilities: ["青霜剑诀", "龙魂感应"],
        equipment: "青霜剑，神秘玉佩",
      })
    ).toMatchObject({
      name: "林夜",
      gender: "男",
      personality: "冷静",
      realm: "筑基中期",
      identity: "天元宗外门弟子",
      role: "主角",
      status: "存活",
      abilities_text: "青霜剑诀\n龙魂感应",
      equipment_text: "青霜剑\n神秘玉佩",
    });
  });

  it("splits and joins chinese list text cleanly", () => {
    expect(splitLines("青霜剑诀\n龙魂感应，清心诀")).toEqual(["青霜剑诀", "龙魂感应", "清心诀"]);
    expect(joinLines(["青霜剑诀", "龙魂感应"])).toBe("青霜剑诀\n龙魂感应");
    expect(isAliveStatus("active")).toBe(true);
    expect(isAliveStatus("死亡")).toBe(false);
  });
});

describe("faction helpers", () => {
  it("normalizes faction drafts for the chinese faction page", () => {
    expect(
      factionDraft({
        name: "天元宗",
        aliases: ["天宗", "中州第一宗门"],
        type: "宗门",
        level: "统辖",
        status: "active",
        parent_name: "东洲盟",
        leader: "陆玄",
        location: "东洲",
        sphere: "中州北域",
        core_members: ["陆玄", "宁雪"],
        allies: "青霄阁，白云城",
        enemies: ["黑水府"],
        sub_factions: ["外门", "内门"],
        summary: "东洲第一宗门",
        ideology: "护持人族",
        resources: "灵脉与传承",
        plot_notes: "与主角线相关",
        locked_facts: "宗主已闭关",
        tags: ["修仙", "宗门"],
      })
    ).toMatchObject({
      name: "天元宗",
      aliases_text: "天宗\n中州第一宗门",
      type: "宗门",
      level: "统辖",
      status: "活跃",
      parent_name: "东洲盟",
      leader: "陆玄",
      location: "东洲",
      sphere: "中州北域",
      core_members_text: "陆玄\n宁雪",
      allies_text: "青霄阁\n白云城",
      enemies_text: "黑水府",
      sub_factions_text: "外门\n内门",
      locked_facts_text: "宗主已闭关",
      tags_text: "修仙\n宗门",
    });
  });

  it("keeps faction patch data structured for backend writes", () => {
    expect(
      draftToFactionPatch({
        name: "天元宗",
        aliases_text: "天宗\n中州第一宗门",
        type: "宗门",
        level: "统辖",
        status: "活跃",
        parent_name: "东洲盟",
        leader: "陆玄",
        location: "东洲",
        sphere: "中州北域",
        summary: "东洲第一宗门",
        ideology: "护持人族",
        resources: "灵脉与传承",
        plot_notes: "与主角线相关",
        core_members_text: "陆玄\n宁雪",
        allies_text: "青霄阁\n白云城",
        enemies_text: "黑水府",
        sub_factions_text: "外门\n内门",
        locked_facts_text: "宗主已闭关",
        tags_text: "修仙\n宗门",
      })
    ).toMatchObject({
      aliases: ["天宗", "中州第一宗门"],
      core_members: ["陆玄", "宁雪"],
      allies: ["青霄阁", "白云城"],
      enemies: ["黑水府"],
      sub_factions: ["外门", "内门"],
      locked_facts: ["宗主已闭关"],
      tags: ["修仙", "宗门"],
    });
    expect(normalizeFactionStatusLabel("active")).toBe("活跃");
  });
});

describe("power system helpers", () => {
  it("normalizes chinese realm tiers with nested sub stages", () => {
    expect(
      powerSystemDraft({
        summary: "修行先炼气，再筑基，之后问鼎更高层次。",
        tiers: [
          {
            name: "炼气境",
            description: "炼化灵气，夯实基础。",
            stages: [
              { name: "初期", description: "刚入门。" },
              { name: "中期", description: "逐渐稳固。" },
            ],
          },
          {
            name: "筑基境",
            description: "奠定根基，开辟丹田。",
            stages: [],
          },
        ],
      })
    ).toMatchObject({
      summary: "修行先炼气，再筑基，之后问鼎更高层次。",
      tiers: [
        {
          name: "炼气境",
          description: "炼化灵气，夯实基础。",
          stages: [
            { name: "初期", description: "刚入门。" },
            { name: "中期", description: "逐渐稳固。" },
          ],
        },
        {
          name: "筑基境",
          description: "奠定根基，开辟丹田。",
          stages: [],
        },
      ],
    });
  });

  it("keeps patch data structured for backend writes", () => {
    expect(
      draftToPowerSystemPatch({
        summary: "修行体系总览。",
        tiers: [
          {
            name: "炼气境",
            description: "炼化灵气。",
            stages: [
              { name: "初期", description: "入门。" },
              { name: "后期", description: "接近突破。" },
            ],
          },
        ],
      })
    ).toEqual({
      summary: "修行体系总览。",
      tiers: [
        {
          name: "炼气境",
          description: "炼化灵气。",
          stages: [
            { name: "初期", description: "入门。" },
            { name: "后期", description: "接近突破。" },
          ],
        },
      ],
    });
  });
});

describe("TimelineWorkspace", () => {
  it("renders chronology events and toggles the detail card on repeated clicks", async () => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(
      <TimelineWorkspace
        timeline={[
          {
            id: 1,
            era: "新星纪元",
            year_label: "新星纪元 1032 年 春",
            time_note: "天元宗收徒日，午后",
            sort_order: 1032.2,
            side: "right",
            event_type: "正序事件",
            title: "林玄登上问心阶",
            summary: "林玄在问心阶第七百二十阶停步。",
            narrative: "第 1 章正序讲述",
            location: "天元宗山门",
            involved_characters: ["林玄", "苏璃"],
            factions: ["天元宗"],
            consequences: "林玄获得外门入门资格。",
            hooks: ["问心阶为何回应林玄神魂"],
          },
        ]}
      />
    );

    expect(screen.getAllByText("新星纪元").length).toBeGreaterThan(0);
    const eventCard = screen.getAllByRole("button", { name: /林玄登上问心阶/ }).find((button) => button.classList.contains("eventCard"));
    expect(eventCard).toBeInTheDocument();
    expect(screen.queryByText("事件详情")).not.toBeInTheDocument();

    fireEvent.click(eventCard);
    expect(screen.getByText("事件详情")).toBeInTheDocument();
    expect(document.querySelector(".detailCard .hookItem")?.textContent).toContain("问心阶为何回应林玄神魂");

    fireEvent.click(eventCard);
    await waitFor(() => expect(screen.queryByText("事件详情")).not.toBeInTheDocument());
  });

  it("keeps era navigator groups collapsed by default", () => {
    render(
      <TimelineWorkspace
        timeline={[
          {
            id: 1,
            era: "前星纪",
            year_label: "前星纪末年",
            title: "龙门沉入虚空海",
            summary: "上古龙门沉入虚空海。",
          },
        ]}
      />
    );

    expect(screen.getAllByRole("button", { name: /前星纪/ })[0].closest(".eraNavGroup")).toHaveClass("collapsed");
  });

  it("keeps left-side event details on the left side", () => {
    render(
      <TimelineWorkspace
        timeline={[
          {
            id: 1,
            era: "新星纪元",
            year_label: "新星纪元 1032 年 春",
            side: "left",
            event_type: "正序事件",
            title: "左侧事件",
            summary: "左侧事件摘要。",
          },
        ]}
      />
    );

    const eventCard = screen.getAllByRole("button", { name: /左侧事件/ }).find((button) => button.classList.contains("eventCard"));
    fireEvent.click(eventCard);

    const detail = document.querySelector(".detailCard");
    expect(detail).toBeInTheDocument();
    expect(detail.closest(".eventWrap")).toHaveClass("left");
    expect(detail).not.toHaveClass("alignInside");
  });

  it("hides chapter overview auto summary signals from the story timeline", () => {
    render(
      <TimelineWorkspace
        timeline={[
          {
            id: 1,
            chapter: 1,
            era: "章节概览",
            year_label: "第 1 章",
            title: "陨落的天才",
            summary: "章节摘要：讲述消炎被退婚",
            tags: ["chapter_summary"],
          },
          {
            id: 2,
            chapter: 1,
            era: "新星纪元",
            year_label: "新星纪元 1032 年 春",
            title: "退婚宴爆发",
            summary: "萧炎在退婚宴上立下三年之约。",
            event_type: "正序事件",
          },
        ]}
      />
    );

    expect(screen.queryByText("陨落的天才")).not.toBeInTheDocument();
    expect(screen.getByText("退婚宴爆发")).toBeInTheDocument();
  });
});

describe("ChapterOverviewWorkspace", () => {
  it("builds chapter overview from summaries and timeline without duplicate summary signals", () => {
    const overview = buildChapterOverview(
      [
        {
          chapter: 1,
          title: "问心阶异象",
          summary: "林玄拜入天元宗。",
          facts: [{ title: "炼气九层规则确定", type: "设定补充", summary: "第三、六、九层各有瓶颈。" }],
          hooks: ["问心阶为何回应林玄神魂"],
        },
      ],
      [
        {
          id: 7,
          chapter: 1,
          title: "林玄登上问心阶",
          summary: "神魂异象短暂显现。",
          event_type: "正序事件",
          tags: ["chapter_summary"],
        },
        {
          id: 8,
          chapter: 1,
          title: "苏璃暗中试探林玄",
          summary: "苏璃确认他并非普通凡人神魂。",
          event_type: "人物变化",
          involved_characters: ["苏璃", "林玄"],
        },
      ]
    );

    expect(overview.chapters).toHaveLength(1);
    expect(overview.events.map((event) => event.title)).toContain("问心阶异象");
    expect(overview.events.map((event) => event.title)).toContain("炼气九层规则确定");
    expect(overview.events.map((event) => event.title)).toContain("问心阶为何回应林玄神魂");
    expect(overview.events.map((event) => event.title)).toContain("苏璃暗中试探林玄");
    expect(overview.events.map((event) => event.title)).not.toContain("林玄登上问心阶");
  });

  it("renders the chapter fact book and updates detail after event selection", () => {
    render(
      <ChapterOverviewWorkspace
        chapterSummaries={[
          {
            chapter: 1,
            title: "问心阶异象",
            summary: "林玄拜入天元宗。",
            facts: ["炼气九层规则确定"],
            hooks: ["问心阶为何回应林玄神魂"],
          },
        ]}
        timeline={[
          {
            id: 2,
            chapter: 2,
            title: "黑水城旧案被提起",
            summary: "案卷被抽去三页。",
            event_type: "伏笔",
            hooks: ["被抽走的三页案卷"],
          },
        ]}
      />
    );

    expect(screen.getByText("章节册")).toBeInTheDocument();
    expect(screen.getByText("全书章节事实册")).toBeInTheDocument();
    expect(screen.getByText("黑水城旧案被提起")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /黑水城旧案被提起/ }));
    expect(document.querySelector(".chapterOverviewDetailCard")?.textContent).toContain("案卷被抽去三页。");
    expect(screen.getByText("被抽走的三页案卷")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "伏笔" }));
    expect(screen.getByText("当前只显示「伏笔」章节事实。")).toBeInTheDocument();
  });

  it("submits a manually added chapter summary", async () => {
    const onSaveChapterSummary = vi.fn().mockResolvedValue(true);
    render(
      <ChapterOverviewWorkspace
        chapterSummaries={[]}
        timeline={[]}
        saving={false}
        onSaveChapterSummary={onSaveChapterSummary}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新增/ }));
    fireEvent.change(screen.getByLabelText("章节号"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("章节标题"), { target: { value: "龙渊秘境开启" } });
    fireEvent.change(screen.getByLabelText("章节摘要"), { target: { value: "林玄进入龙渊秘境。" } });
    fireEvent.change(screen.getByLabelText("关键事实"), { target: { value: "秘境入口由青岚盟看守\n林玄血脉发热" } });
    fireEvent.change(screen.getByLabelText("伏笔"), { target: { value: "青色鳞片来源" } });
    fireEvent.click(screen.getByRole("button", { name: "保存章节" }));

    await waitFor(() =>
      expect(onSaveChapterSummary).toHaveBeenCalledWith({
        chapter: 3,
        title: "龙渊秘境开启",
        summary: "林玄进入龙渊秘境。",
        facts: ["秘境入口由青岚盟看守", "林玄血脉发热"],
        hooks: ["青色鳞片来源"],
      })
    );
  });

  it("edits and deletes a chapter card from the inline form", async () => {
    const onSaveChapterSummary = vi.fn().mockResolvedValue(true);
    const onDeleteChapterSummary = vi.fn().mockResolvedValue(true);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ChapterOverviewWorkspace
        chapterSummaries={[
          {
            chapter: 1,
            title: "旧章名",
            summary: "旧摘要。",
            facts: ["旧事实"],
            hooks: ["旧伏笔"],
          },
        ]}
        timeline={[]}
        saving={false}
        onSaveChapterSummary={onSaveChapterSummary}
        onDeleteChapterSummary={onDeleteChapterSummary}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑第 1 章" }));
    expect(screen.getByText("编辑第 1 章")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("章节标题"), { target: { value: "新章名" } });
    fireEvent.change(screen.getByLabelText("章节摘要"), { target: { value: "新摘要。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(onSaveChapterSummary).toHaveBeenCalledWith({
        chapter: 1,
        title: "新章名",
        summary: "新摘要。",
        facts: ["旧事实"],
        hooks: ["旧伏笔"],
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑第 1 章" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => expect(onDeleteChapterSummary).toHaveBeenCalledWith(1));
    confirmSpy.mockRestore();
  });
});

describe("CharacterEditor", () => {
  it("renders the reduced chinese role card and writes back role/status changes immediately", () => {
    const onSave = vi.fn();
    const onToggleStatus = vi.fn();
    const onUpdateRole = vi.fn();
    const current = {
      name: "苏璃",
      gender: "女",
      personality: "克制",
      realm: "金丹初期",
      identity: "圣女殿传人",
      role: "女主",
      status: "存活",
      relationship_notes: "对林夜好奇",
      abilities: ["清心诀"],
      equipment: ["白璃玉簪"],
      faction: "圣女殿",
      bloodline: "圣女血脉",
    };

    render(
      <CharacterEditor
        character={current}
        saving={false}
        onSave={onSave}
        onToggleStatus={onToggleStatus}
        onUpdateRole={onUpdateRole}
      />
    );

    expect(screen.getByText("基本资料")).toBeInTheDocument();
    expect(screen.getByDisplayValue("苏璃")).toBeInTheDocument();
    expect(screen.getByDisplayValue("克制")).toBeInTheDocument();
    expect(screen.getByDisplayValue("金丹初期")).toBeInTheDocument();
    expect(screen.getByDisplayValue("圣女殿传人")).toBeInTheDocument();
    expect(screen.getByDisplayValue("对林夜好奇")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "主角" }));
    expect(onUpdateRole).toHaveBeenCalledWith("主角");

    fireEvent.click(screen.getByRole("button", { name: "切换存活状态" }));
    expect(onToggleStatus).toHaveBeenCalledWith(false);

    fireEvent.change(screen.getByDisplayValue("女"), { target: { value: "其他" } });
    fireEvent.change(screen.getByDisplayValue("克制"), { target: { value: "沉稳" } });
    fireEvent.change(screen.getByDisplayValue("金丹初期"), { target: { value: "元婴初期" } });
    fireEvent.change(screen.getByDisplayValue("圣女殿传人"), { target: { value: "天元宗弟子" } });
    fireEvent.change(screen.getByDisplayValue("对林夜好奇"), { target: { value: "与林夜保持合作" } });
    fireEvent.change(screen.getByDisplayValue("清心诀"), { target: { value: "清心诀\n圣女步法" } });
    fireEvent.change(screen.getByDisplayValue("白璃玉簪"), { target: { value: "白璃玉簪\n护心符" } });
    fireEvent.change(screen.getByDisplayValue("圣女殿"), { target: { value: "天元宗" } });
    fireEvent.change(screen.getByDisplayValue("圣女血脉"), { target: { value: "龙族血脉" } });

    fireEvent.click(screen.getByRole("button", { name: "保存人物信息" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      gender: "其他",
      personality: "沉稳",
      realm: "元婴初期",
      identity: "天元宗弟子",
      relationship_notes: "与林夜保持合作",
      abilities_text: "清心诀\n圣女步法",
      equipment_text: "白璃玉簪\n护心符",
      faction: "天元宗",
      bloodline: "龙族血脉",
    }));
  });
});

describe("FactionEditor", () => {
  it("renders the faction structure and writes back structured updates", () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const current = {
      name: "天元宗",
      aliases: ["天宗", "中州第一宗门"],
      type: "宗门",
      level: "统辖",
      status: "活跃",
      parent_name: "东洲盟",
      leader: "陆玄",
      location: "东洲",
      sphere: "中州北域",
      summary: "东洲第一宗门",
      ideology: "护持人族",
      resources: "灵脉与传承",
      plot_notes: "与主角线相关",
      core_members: ["陆玄", "宁雪"],
      allies: ["青霄阁"],
      enemies: ["黑水府"],
      sub_factions: ["外门"],
      locked_facts: ["宗主已闭关"],
      tags: ["修仙"],
    };

    render(<FactionEditor faction={current} resetKey="天元宗" saving={false} onSave={onSave} onDelete={onDelete} />);

    expect(screen.getByText("基本资料")).toBeInTheDocument();
    expect(screen.getByDisplayValue("天元宗")).toBeInTheDocument();
    expect(screen.getByDisplayValue("东洲第一宗门")).toBeInTheDocument();
    expect(screen.getByDisplayValue("护持人族")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("宗门"), { target: { value: "家族" } });
    fireEvent.change(screen.getByDisplayValue("活跃"), { target: { value: "衰落" } });
    fireEvent.change(screen.getByDisplayValue("东洲第一宗门"), { target: { value: "中州顶级宗门" } });
    fireEvent.change(screen.getByDisplayValue("青霄阁"), { target: { value: "青霄阁\n白云城" } });
    fireEvent.change(screen.getByDisplayValue("黑水府"), { target: { value: "黑水府\n血煞盟" } });
    fireEvent.change(screen.getByDisplayValue("外门"), { target: { value: "外门\n内门" } });
    fireEvent.change(screen.getByDisplayValue("宗主已闭关"), { target: { value: "宗主闭关中" } });
    fireEvent.change(screen.getByDisplayValue("修仙"), { target: { value: "修仙\n护道" } });

    fireEvent.click(screen.getByRole("button", { name: "保存势力" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "家族",
      status: "衰落",
      summary: "中州顶级宗门",
      allies_text: "青霄阁\n白云城",
      enemies_text: "黑水府\n血煞盟",
      sub_factions_text: "外门\n内门",
      locked_facts_text: "宗主闭关中",
      tags_text: "修仙\n护道",
    }));
  });
});

describe("PowerSystemWorkspace", () => {
  it("keeps overview rows independent from tier editing", () => {
    const onSave = vi.fn();
    const current = {
      summary: "修行先炼气，再筑基。",
      tiers: [
        {
          name: "炼气境",
          description: "吸纳灵气，洗练经脉。",
          stages: [
            { name: "初期", description: "初入此境。" },
            { name: "中期", description: "力量渐稳。" },
          ],
        },
      ],
    };

    render(<PowerSystemWorkspace powerSystem={current} saving={false} onSave={onSave} />);

    expect(screen.getByRole("button", { name: /总览/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "境界体系总览表" })).toBeInTheDocument();
    expect(screen.getByText("修行先炼气，再筑基。", { selector: ".summaryView" })).toBeInTheDocument();
    expect(screen.queryByText("初期", { selector: "span.realmName.minor" })).not.toBeInTheDocument();
    expect(screen.queryByText("当前大境界")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("炼气境", { selector: "strong.realmName" }));
    expect(screen.getByText("初期", { selector: "span.realmName.minor" })).toBeInTheDocument();
    expect(screen.queryByText("当前大境界")).not.toBeInTheDocument();
    expect(screen.getByText("修行先炼气，再筑基。", { selector: ".summaryView" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    expect(screen.getByRole("button", { name: "完成" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("修行先炼气，再筑基。")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("修行先炼气，再筑基。"), {
      target: { value: "修行先炼气，再筑基，后面还有更高层次。" },
    });

    fireEvent.click(screen.getByRole("button", { name: /炼气境.*小境界 2 个/ }));
    expect(screen.getByDisplayValue("炼气境")).toBeInTheDocument();
    expect(screen.getByDisplayValue("吸纳灵气，洗练经脉。")).toBeInTheDocument();
    expect(screen.queryByText("境界体系总览")).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("炼气境"), { target: { value: "炼气期" } });
    fireEvent.change(screen.getByDisplayValue("吸纳灵气，洗练经脉。"), {
      target: { value: "以灵气淬炼经脉，打牢根基。" },
    });
    fireEvent.change(screen.getByDisplayValue("初入此境。"), { target: { value: "刚入门，气息未稳。" } });

    fireEvent.click(screen.getByRole("button", { name: "保存境界体系" }));

    fireEvent.click(screen.getByRole("button", { name: /总览/ }));
    expect(screen.queryByText("当前大境界")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("修行先炼气，再筑基，后面还有更高层次。")).toBeInTheDocument();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "修行先炼气，再筑基，后面还有更高层次。",
        tiers: [
          {
            name: "炼气期",
            description: "以灵气淬炼经脉，打牢根基。",
            stages: [
              { name: "初期", description: "刚入门，气息未稳。" },
              { name: "中期", description: "力量渐稳。" },
            ],
          },
        ],
      })
    );
  });
});

describe("MapWorkspace", () => {
  it("normalizes map JSON templates and imported polygon nodes", () => {
    const template = mapImportTemplate();
    expect(template.map_image.title).toBe("示例地图名称");
    expect(template.map_nodes[0].polygon_points).toHaveLength(4);
    expect(template.map_nodes[0].color).toBe("120,146,185");

    const imported = normalizeImportedMapJson({
      version: 1,
      map_image: {
        title: "演示导入·四域总览",
        layer: "世界",
        real_width: 1200,
        real_height: 750,
        distance_unit: "万里",
        scale_kind: "总览",
        image_data: "data:image/png;base64,AAAA",
      },
      map_nodes: [
        {
          name: "青岚洲",
          type: "区域",
          shape: "polygon",
          color: "300, 20, 40",
          x: 22.1,
          y: 32.6,
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
          ],
        },
      ],
    });

    expect(imported.mapDraft).toMatchObject({
      title: "演示导入·四域总览",
      layer: "世界",
      real_width: 1200,
      real_height: 750,
      distance_unit: "万里",
      scale_kind: "总览",
    });
    expect(imported.nodeDrafts[0]).toMatchObject({
      name: "青岚洲",
      shape: "polygon",
      color: "255,20,40",
      x: 22.1,
      y: 32.6,
      polygon_points_text: "8, 22\n32, 12",
    });
  });

  it("exports current map as JSON without backend-only ids", () => {
    const exported = mapToExportJson({
      imageId: 12,
      title: "东玄道域",
      layer: "区域",
      parentName: "大千世界",
      scaleKind: "区域",
      realWidth: 800,
      realHeight: 600,
      distanceUnit: "万里",
      imageData: "data:image/png;base64,AAAA",
      nodes: [
        {
          id: 31,
          name: "天元宗",
          type: "宗门",
          shape: "point",
          x: 42,
          y: 38,
          description: "东玄道域核心宗门。",
        },
      ],
    });

    expect(exported.map_image).toMatchObject({
      title: "东玄道域",
      layer: "区域",
      parent_name: "大千世界",
      real_width: 800,
      real_height: 600,
      distance_unit: "万里",
    });
    expect(exported.map_nodes[0]).toMatchObject({ name: "天元宗", x: 42, y: 38 });
    expect(exported.map_nodes[0].id).toBeUndefined();
  });

  it("keeps polygon area colors in map node payloads and JSON export", () => {
    expect(
      draftToMapNodePayload({
        name: "青岚洲",
        type: "区域",
        shape: "polygon",
        map_image_id: 12,
        layer: "世界",
        plane: "四域总览",
        parent_name: "",
        description: "青岚盟范围。",
        faction: "青岚盟",
        color: "256, 12, 30",
        x: 30,
        y: 40,
        polygon_points_text: "8, 22\n32, 12\n36, 40",
      })
    ).toMatchObject({
      name: "青岚洲",
      shape: "polygon",
      color: "255,12,30",
      polygon_points: [
        { x: 8, y: 22 },
        { x: 32, y: 12 },
        { x: 36, y: 40 },
      ],
    });

    const exported = mapToExportJson({
      title: "四域总览",
      nodes: [{ name: "青岚洲", shape: "polygon", color: "#7892b9", x: 30, y: 40, polygon_points: [] }],
    });
    expect(exported.map_nodes[0].color).toBe("120,146,185");
  });

  it("shows a delete map button for real atlas images and delegates full map deletion", async () => {
    const onDeleteMap = vi.fn().mockResolvedValue(true);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const world = {
      map_images: [
        {
          id: 12,
          title: "东玄道域",
          layer: "区域",
          scale_kind: "区域",
          real_width: 800000,
          real_height: 600000,
          distance_unit: "里",
          notes: "东玄道域局部图。",
        },
      ],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "天元宗",
          type: "宗门",
          shape: "point",
          x: 42,
          y: 38,
          description: "东玄道域核心宗门。",
        },
      ],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={onDeleteMap}
        onSaveMap={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /删除地图/ }));

    await waitFor(() => {
      expect(onDeleteMap).toHaveBeenCalledWith(expect.objectContaining({ imageId: 12, title: "东玄道域" }));
    });
    confirmSpy.mockRestore();
  });

  it("clears only the image when clicking delete image and keeps map deletion separate", async () => {
    const onDeleteMap = vi.fn().mockResolvedValue(true);
    const onUpdateMap = vi.fn().mockResolvedValue({ id: 12 });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const world = {
      map_images: [
        {
          id: 12,
          title: "东玄道域",
          layer: "区域",
          scale_kind: "区域",
          real_width: 800000,
          real_height: 600000,
          distance_unit: "里",
          image_data: "data:image/png;base64,AAAA",
        },
      ],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "天元宗",
          type: "宗门",
          shape: "point",
          x: 42,
          y: 38,
        },
      ],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={onDeleteMap}
        onSaveMap={vi.fn()}
        onUpdateMap={onUpdateMap}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /删除图片/ }));

    await waitFor(() => {
      expect(onUpdateMap).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          image_id: 12,
          title: "东玄道域",
          image_data: "",
        }),
        "浏览器删除地图图片但保留地图资料"
      );
    });
    expect(onDeleteMap).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows polygon vertices for selected areas and edits details inline", async () => {
    const onSaveNode = vi.fn().mockResolvedValue({ id: 31, name: "青岚洲" });
    const world = {
      map_images: [
        {
          id: 12,
          title: "四域总览",
          layer: "世界",
          scale_kind: "总览",
          image_data: "data:image/png;base64,AAAA",
          mime_type: "image/png",
        },
      ],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "青岚洲",
          type: "secret_realm",
          shape: "polygon",
          layer: "世界",
          faction: "青岚盟",
          color: "120,146,185",
          x: 22,
          y: 32,
          description: "西北侧灵脉丰饶的大陆。",
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
            { x: 36, y: 40 },
          ],
        },
      ],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={onSaveNode}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    expect(screen.getByText("选中区域")).toBeInTheDocument();
    expect(screen.getByText("顶点 1: x 8，y 22")).toBeInTheDocument();
    expect(screen.getByText("顶点 2: x 32，y 12")).toBeInTheDocument();
    expect(screen.getByText("区域颜色")).toBeInTheDocument();
    expect(screen.getByText("120,146,185")).toBeInTheDocument();
    expect(screen.queryByText("secret_realm")).not.toBeInTheDocument();
    expect(screen.queryByText("所属范围")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除区域" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "编辑区域" }));
    expect(screen.getByRole("button", { name: "删除区域" })).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("青岚洲"), { target: { value: "青岚古洲" } });
    fireEvent.change(screen.getByLabelText("选择区域颜色"), { target: { value: "#6a845f" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSaveNode).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 31,
          name: "青岚古洲",
          color: "106,132,95",
          polygon_points_text: "8, 22\n32, 12\n36, 40",
        }),
        31
      );
    });
  });

  it("treats polygon records without vertices as areas in the detail panel", () => {
    const world = {
      map_images: [
        {
          id: 12,
          title: "四域总览",
          layer: "世界",
          scale_kind: "总览",
        },
      ],
      map_nodes: [
        {
          id: 32,
          map_image_id: 12,
          name: "未定边界区域",
          type: "区域",
          shape: "polygon",
          faction: "青岚盟",
          x: 50,
          y: 50,
          polygon_points: [],
        },
      ],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    expect(screen.getByText("选中区域")).toBeInTheDocument();
    expect(screen.getByText("还没有记录区域顶点。")).toBeInTheDocument();
    expect(screen.queryByText("位置")).not.toBeInTheDocument();
  });

  it("toggles only area visibility from the map layer toolbar", () => {
    const world = {
      map_images: [{ id: 12, title: "四域总览", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "青岚洲",
          type: "区域",
          shape: "polygon",
          x: 22,
          y: 32,
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
            { x: 36, y: 40 },
          ],
        },
        { id: 32, map_image_id: 12, name: "黑水城", type: "城市", shape: "point", x: 55, y: 45 },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    expect(container.querySelector(".mapPolygonLayer")).not.toBeNull();
    expect(container.querySelector(".mapNodeLayer")).not.toBeNull();

    const areaButton = screen.getByRole("button", { name: "势力范围" });
    fireEvent.click(areaButton);
    expect(container.querySelector(".mapPolygonLayer")).toBeNull();
    expect(container.querySelector(".mapNodeLayer")).not.toBeNull();
    expect(areaButton).toHaveClass("inactive");

    fireEvent.click(screen.getByRole("button", { name: "路线" }));
    fireEvent.click(screen.getByRole("button", { name: "节点" }));
    expect(container.querySelector(".mapNodeLayer")).not.toBeNull();
  });

  it("hides and restores only the selected area from the selected area card", () => {
    const onSaveNode = vi.fn();
    const onDeleteNode = vi.fn();
    const world = {
      map_images: [{ id: 12, title: "四域总览", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "青岚洲",
          type: "区域",
          shape: "polygon",
          color: "120,146,185",
          x: 22,
          y: 32,
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
            { x: 36, y: 40 },
          ],
        },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={onSaveNode}
        onDeleteNode={onDeleteNode}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    const area = container.querySelector(".mapArea");
    fireEvent.click(area);
    expect(area).toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "隐藏区域" }));
    expect(container.querySelector(".mapArea")).toBeNull();
    expect(screen.getAllByText("青岚洲").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "显示区域" })).toBeInTheDocument();
    expect(onSaveNode).not.toHaveBeenCalled();
    expect(onDeleteNode).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "显示区域" }));
    expect(container.querySelector(".mapArea")).not.toBeNull();
    expect(screen.getByRole("button", { name: "隐藏区域" })).toBeInTheDocument();
  });

  it("restores a hidden area after another map item has been selected", () => {
    const world = {
      map_images: [{ id: 12, title: "四域总览", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "青岚洲",
          type: "区域",
          shape: "polygon",
          color: "120,146,185",
          x: 22,
          y: 32,
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
            { x: 36, y: 40 },
          ],
        },
        {
          id: 32,
          map_image_id: 12,
          name: "黑水城",
          type: "城市",
          shape: "point",
          x: 55,
          y: 45,
        },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    fireEvent.click(container.querySelector(".mapArea"));
    fireEvent.click(screen.getByRole("button", { name: "隐藏区域" }));
    expect(container.querySelector(".mapArea")).toBeNull();

    fireEvent.click(container.querySelector(".mapNode"));
    expect(screen.getByText("选中节点")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "显示区域" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "显示隐藏区域 青岚洲" }));
    expect(container.querySelector(".mapArea")).not.toBeNull();
    expect(container.querySelector(".mapArea")).toHaveClass("active");
    expect(screen.getByText("选中区域")).toBeInTheDocument();
  });

  it("highlights selected areas with their own color and clears highlight on map blank clicks", () => {
    const world = {
      map_images: [{ id: 12, title: "四域总览", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "青岚洲",
          type: "区域",
          shape: "polygon",
          color: "120,146,185",
          x: 22,
          y: 32,
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
            { x: 36, y: 40 },
          ],
        },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    const area = container.querySelector(".mapArea");
    const polygon = container.querySelector(".mapArea polygon");
    expect(area).not.toHaveClass("active");

    fireEvent.click(area);
    expect(area).toHaveClass("active");
    expect(polygon.style.stroke).toBe("rgba(120, 146, 185, 0.96)");
    expect(polygon.style.stroke).not.toBe("rgb(138, 63, 52)");

    fireEvent.pointerDown(container.querySelector(".mapViewport"), { button: 0 });
    expect(area).not.toHaveClass("active");
    expect(polygon.style.strokeWidth).toBe("3");
  });

  it("cycles selection between overlapping map areas without keeping the previous area highlighted", () => {
    const world = {
      map_images: [{ id: 12, title: "重叠区域", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "区域一",
          type: "区域",
          shape: "polygon",
          color: "106,132,95",
          x: 48,
          y: 48,
          polygon_points: [
            { x: 30, y: 30 },
            { x: 64, y: 30 },
            { x: 64, y: 64 },
            { x: 30, y: 64 },
          ],
        },
        {
          id: 32,
          map_image_id: 12,
          name: "区域二",
          type: "区域",
          shape: "polygon",
          color: "186,115,110",
          x: 56,
          y: 56,
          polygon_points: [
            { x: 42, y: 42 },
            { x: 72, y: 42 },
            { x: 72, y: 72 },
            { x: 42, y: 72 },
          ],
        },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    const areas = container.querySelectorAll(".mapArea");
    fireEvent.click(areas[1], { clientX: 480, clientY: 300 });
    expect(areas[1]).toHaveClass("active");
    expect(areas[0]).not.toHaveClass("active");

    fireEvent.click(areas[1], { clientX: 480, clientY: 300 });
    expect(areas[0]).toHaveClass("active");
    expect(areas[1]).not.toHaveClass("active");
  });

  it("renders smaller contained areas above larger areas", () => {
    const world = {
      map_images: [{ id: 12, title: "包含区域", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "大区域",
          type: "区域",
          shape: "polygon",
          x: 50,
          y: 50,
          polygon_points: [
            { x: 10, y: 10 },
            { x: 90, y: 10 },
            { x: 90, y: 90 },
            { x: 10, y: 90 },
          ],
        },
        {
          id: 32,
          map_image_id: 12,
          name: "小区域",
          type: "区域",
          shape: "polygon",
          x: 50,
          y: 50,
          polygon_points: [
            { x: 42, y: 42 },
            { x: 58, y: 42 },
            { x: 58, y: 58 },
            { x: 42, y: 58 },
          ],
        },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    const labels = [...container.querySelectorAll(".mapArea text")].map((element) => element.textContent);
    expect(labels).toEqual(["大区域", "小区域"]);
  });

  it("renders the updated area color after map node save refreshes world data", async () => {
    const onSaveNode = vi.fn().mockResolvedValue({ id: 31, name: "青岚洲", color: "106,132,95" });
    const baseWorld = {
      map_images: [{ id: 12, title: "四域总览", layer: "世界", scale_kind: "总览" }],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "青岚洲",
          type: "区域",
          shape: "polygon",
          color: "120,146,185",
          x: 22,
          y: 32,
          polygon_points: [
            { x: 8, y: 22 },
            { x: 32, y: 12 },
            { x: 36, y: 40 },
          ],
        },
      ],
    };

    const { container, rerender } = render(
      <MapWorkspace
        world={baseWorld}
        saving={false}
        onSaveNode={onSaveNode}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    expect(container.querySelector(".mapArea polygon").style.stroke).toBe("rgba(120, 146, 185, 0.78)");
    fireEvent.click(screen.getByRole("button", { name: "编辑区域" }));
    fireEvent.change(screen.getByLabelText("选择区域颜色"), { target: { value: "#6a845f" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onSaveNode).toHaveBeenCalledWith(expect.objectContaining({ color: "106,132,95" }), 31);
    });

    rerender(
      <MapWorkspace
        world={{ ...baseWorld, map_nodes: [{ ...baseWorld.map_nodes[0], color: "106,132,95" }] }}
        saving={false}
        onSaveNode={onSaveNode}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    expect(container.querySelector(".mapArea polygon").style.stroke).toBe("rgba(106, 132, 95, 0.78)");
  });

  it("allows deleting generated unassigned-node groups by removing their nodes", async () => {
    const onDeleteMap = vi.fn().mockResolvedValue(true);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const world = {
      map_images: [],
      map_nodes: [
        {
          id: 31,
          map_image_id: null,
          layer: "散点资料",
          name: "黑水城",
          type: "城市",
          shape: "point",
          x: 50,
          y: 50,
        },
      ],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={onDeleteMap}
        onSaveMap={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /删除地图/ }));

    await waitFor(() => {
      expect(onDeleteMap).toHaveBeenCalledWith(
        expect.objectContaining({
          imageId: null,
          title: "散点资料",
          nodes: [expect.objectContaining({ id: 31, name: "黑水城" })],
        })
      );
    });
    confirmSpy.mockRestore();
  });

  it("keeps unbound map nodes grouped by layer even when real maps exist", () => {
    const maps = buildMapAtlas({
      map_images: [
        {
          id: 12,
          title: "世界",
          layer: "世界",
          scale_kind: "世界",
        },
      ],
      map_nodes: [
        {
          id: 31,
          map_image_id: null,
          layer: "九重天",
          name: "君临城",
          type: "城市",
        },
        {
          id: 32,
          map_image_id: null,
          layer: "归墟层",
          name: "混沌归墟",
          type: "区域",
        },
        {
          id: 33,
          map_image_id: 12,
          layer: "世界",
          name: "已绑定节点",
          type: "地点",
        },
      ],
    });

    expect(maps.map((map) => map.title)).toEqual(["世界", "九重天", "归墟层"]);
    expect(maps.find((map) => map.title === "九重天").nodes).toHaveLength(1);
    expect(maps.find((map) => map.title === "归墟层").nodes).toHaveLength(1);
    expect(maps.some((map) => map.title === "未分配资料节点")).toBe(false);
  });

  it("binds unassigned group nodes to the new image after importing a picture", async () => {
    const onSaveMap = vi.fn().mockResolvedValue({ id: 88 });
    const onSaveNode = vi.fn().mockResolvedValue({ id: 31 });
    const world = {
      map_images: [],
      map_nodes: [
        {
          id: 31,
          map_image_id: null,
          layer: "九重天",
          name: "君临城",
          type: "城市",
          shape: "point",
          x: 50,
          y: 50,
          description: "君家本家所在的核心圣城。",
        },
      ],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={onSaveNode}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={onSaveMap}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /导入图片/ }));
    fireEvent.click(screen.getByRole("button", { name: "保存地图" }));

    await waitFor(() => {
      expect(onSaveMap).toHaveBeenCalledWith(expect.objectContaining({ title: "九重天", layer: "九重天" }));
      expect(onSaveNode).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 31,
          name: "君临城",
          map_image_id: 88,
          layer: "九重天",
        }),
        31
      );
    });
  });

  it("reads a selected map image file and saves it without dropping existing map data", async () => {
    const onUpdateMap = vi.fn().mockResolvedValue({ id: 12 });
    const world = {
      map_images: [
        {
          id: 12,
          title: "东玄道域",
          layer: "区域",
          scale_kind: "区域",
          real_width: 800,
          real_height: 600,
          distance_unit: "万里",
          image_data: "",
          mime_type: "image/png",
        },
      ],
      map_nodes: [
        {
          id: 31,
          map_image_id: 12,
          name: "天元宗",
          type: "宗门",
          shape: "point",
          x: 42,
          y: 38,
        },
      ],
    };

    const { container } = render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
        onUpdateMap={onUpdateMap}
      />
    );

    const fileInput = container.querySelector('input[type="file"][accept="image/*"]');
    const file = new File(["fake image"], "测试地图.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("已选择图片：测试地图.png")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "保存地图" }));

    await waitFor(() => {
      expect(onUpdateMap).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          image_id: 12,
          title: "东玄道域",
          image_data: expect.stringMatching(/^data:image\/png;base64,/),
        }),
        "浏览器导入或替换地图图片"
      );
    });
  });

  it("creates a manual map with scale metadata", async () => {
    const onSaveMap = vi.fn().mockResolvedValue({ id: 77 });
    const world = { map_images: [], map_nodes: [] };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={onSaveMap}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新建地图/ }));
    expect(screen.getByRole("button", { name: /新建地图.*未设定面积/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("地图名称"), { target: { value: "澄江市旧城区" } });
    fireEvent.change(screen.getByLabelText("层级"), { target: { value: "城市" } });
    fireEvent.change(screen.getByLabelText("图册分类"), { target: { value: "城市" } });
    fireEvent.change(screen.getByLabelText("横向范围"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("纵向范围"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("距离单位"), { target: { value: "公里" } });
    fireEvent.change(screen.getByLabelText("说明"), { target: { value: "末日都市旧城区地图。" } });

    fireEvent.click(screen.getByRole("button", { name: "保存地图" }));

    await waitFor(() => {
      expect(onSaveMap).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "澄江市旧城区",
          scale_kind: "城市",
          layer: "城市",
          real_width: "120",
          real_height: "80",
          distance_unit: "公里",
          notes: "末日都市旧城区地图。",
        })
      );
    });
  });

  it("edits map metadata from the current map description card", async () => {
    const onUpdateMap = vi.fn().mockResolvedValue({ id: 12 });
    const world = {
      map_images: [
        {
          id: 12,
          title: "东玄道域",
          layer: "区域",
          scale_kind: "区域",
          real_width: 800,
          real_height: 600,
          distance_unit: "万里",
          notes: "东玄道域旧说明。",
        },
      ],
      map_nodes: [],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
        onUpdateMap={onUpdateMap}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "编辑地图信息" }));
    fireEvent.change(screen.getByLabelText("地图名称"), { target: { value: "东玄道域详图" } });
    fireEvent.change(screen.getByLabelText("说明"), { target: { value: "重修后的道域资料。" } });
    fireEvent.click(screen.getByRole("button", { name: "保存地图" }));

    await waitFor(() => {
      expect(onUpdateMap).toHaveBeenCalledWith(
        12,
        expect.objectContaining({
          image_id: 12,
          title: "东玄道域详图",
          notes: "重修后的道域资料。",
        }),
        "浏览器导入或替换地图图片"
      );
    });
  });

  it("keeps the new node form focused on essential fields", () => {
    const world = {
      map_images: [
        {
          id: 12,
          title: "四域总览",
          layer: "世界",
          scale_kind: "总览",
        },
      ],
      map_nodes: [],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新增节点/ }));

    expect(screen.getByLabelText("节点名称")).toBeInTheDocument();
    expect(screen.getByLabelText("显示方式")).toBeInTheDocument();
    expect(screen.getByLabelText("所属势力（可选）")).toBeInTheDocument();
    expect(screen.queryByLabelText("类型")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("层级 / 地图")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("位面 / 分区")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("上级 / 父级")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("形状")).not.toBeInTheDocument();
  });

  it("clears the new-node message when cancelling node creation", () => {
    const world = {
      map_images: [
        {
          id: 12,
          title: "四域总览",
          layer: "世界",
          scale_kind: "总览",
        },
      ],
      map_nodes: [],
    };

    render(
      <MapWorkspace
        world={world}
        saving={false}
        onSaveNode={vi.fn()}
        onDeleteNode={vi.fn()}
        onDeleteMap={vi.fn()}
        onSaveMap={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /新增节点/ }));
    expect(screen.getByText("正在新增节点")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByText("正在新增节点")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("节点名称")).not.toBeInTheDocument();
  });

  it("keeps empty image data empty for update payloads", () => {
    expect(draftToMapImagePayload({ title: "空图", layer: "世界", parent_name: "", scope: "", scale_label: "", real_width: 0, real_height: 0, distance_unit: "里", scale_kind: "世界", image_data: "", mime_type: "image/png", notes: "" }, { keepEmptyImageData: true }).image_data).toBe("");
  });
});
