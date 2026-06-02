import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PowerSystemWorkspace,
  CharacterEditor,
  FactionEditor,
  MapWorkspace,
  buildMapAtlas,
  characterDraft,
  draftToFactionPatch,
  draftToMapImagePayload,
  draftToMapNodePayload,
  draftToPowerSystemPatch,
  factionDraft,
  isAliveStatus,
  joinLines,
  mapImportTemplate,
  mapToExportJson,
  normalizeFactionStatusLabel,
  normalizeImportedMapJson,
  powerSystemDraft,
  splitLines,
} from "./main.jsx";

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
