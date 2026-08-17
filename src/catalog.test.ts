import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  mcpPromptsFromCatalog,
  mcpResourcesFromCatalog,
  mcpToolsFromCatalog,
  openCapabilities,
} from "./catalog.js";

describe("开放能力目录", () => {
  it("开放项都挂了 MCP 表面，且工具/资源/提示名不重复", () => {
    // 条件：status=open 的目录项；预期：每项有 mcp 名，同类名唯一。
    const open = openCapabilities();
    expect(open.length).toBeGreaterThan(0);
    for (const item of open) {
      expect(item.mcp, `${item.id} 缺少 mcp 表面`).toBeDefined();
    }
    expect(new Set(mcpToolsFromCatalog()).size).toBe(mcpToolsFromCatalog().length);
    expect(new Set(mcpResourcesFromCatalog()).size).toBe(
      mcpResourcesFromCatalog().length,
    );
    expect(new Set(mcpPromptsFromCatalog()).size).toBe(mcpPromptsFromCatalog().length);
  });

  it("封闭项不暴露 MCP 表面，避免把私有域误开放", () => {
    // 条件：status=closed；预期：没有 mcp 字段，且覆盖分身/对话/记忆/计费/公众号搜号。
    const closed = CAPABILITIES.filter((item) => item.status === "closed");
    expect(closed.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "twins",
        "conversations",
        "memory_dreams",
        "wechat_account_crawl",
        "billing_pay",
        "admin",
      ]),
    );
    for (const item of closed) {
      expect(item.mcp, `${item.id} 不应挂开放 MCP`).toBeUndefined();
    }
  });

  it("第一波开放工具正好是热点/抓取/自然表达/模板/分享/帮助文档", () => {
    // 条件：目录推导工具名；预期：与产品里可无身份提供的能力对齐。
    expect(mcpToolsFromCatalog().sort()).toEqual(
      [
        "check_writing_naturalness",
        "fetch_url",
        "get_product_docs",
        "hot_topics",
        "list_image_prompt_templates",
        "read_public_share",
      ].sort(),
    );
  });
});
