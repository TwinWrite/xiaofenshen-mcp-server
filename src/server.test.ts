import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createXiaofenshenMcpServer } from "./server.js";
import {
  mcpPromptsFromCatalog,
  mcpResourcesFromCatalog,
  mcpToolsFromCatalog,
} from "./catalog.js";
import { loadConfig } from "./config.js";
import type { AppDeps } from "./deps.js";
import type { NewsNowClient } from "./infra/newsnow.js";
import type { XiaofenshenClient } from "./infra/xiaofenshen-api.js";

function fakeDeps(): AppDeps {
  const newsNow: NewsNowClient = {
    fetchSource: vi.fn(async (id) => ({
      sourceId: id,
      sourceUpdatedTime: null,
      items: [{ id: "1", rank: 1, title: `${id}-1`, url: "https://example.com/1" }],
    })),
  };
  const api: XiaofenshenClient = {
    getJson: vi.fn(async () => ({ items: [] })),
    getText: vi.fn(async () => ({ text: "# docs", contentType: "text/plain", status: 200 })),
  };
  return {
    config: loadConfig({}),
    newsNow,
    fetchPageDeps: {
      resolver: async () => [{ address: "93.184.216.34", family: 4 }],
      fetchFn: async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => "<p>ok</p>",
      }),
    },
    api,
  };
}

describe("createXiaofenshenMcpServer", () => {
  it("注册的 tools/resources/prompts 与开放目录一致", async () => {
    // 条件：内存传输连上 MCP；预期：列表名等于 catalog 推导结果。
    const server = createXiaofenshenMcpServer(fakeDeps());
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const tools = await client.listTools();
    const resources = await client.listResources();
    const prompts = await client.listPrompts();

    expect(tools.tools.map((t) => t.name).sort()).toEqual([...mcpToolsFromCatalog()].sort());
    expect(resources.resources.map((r) => r.uri).sort()).toEqual(
      [...mcpResourcesFromCatalog()].sort(),
    );
    expect(prompts.prompts.map((p) => p.name).sort()).toEqual([...mcpPromptsFromCatalog()].sort());

    const hot = await client.callTool({ name: "hot_topics", arguments: { sourceId: "zhihu" } });
    const content = hot.content as Array<{ type: string; text?: string }>;
    const text = content[0];
    expect(text?.type).toBe("text");
    expect(JSON.parse(text?.text ?? "{}")).toMatchObject({ ok: true, sourceId: "zhihu" });

    await client.close();
    await server.close();
  });
});
