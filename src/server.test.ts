import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createXiaofenshenMcpServer, OPEN_TOOL_NAMES } from "./server.js";
import { loadConfig } from "./config.js";

describe("createXiaofenshenMcpServer", () => {
  it("只注册免登录的三条工具，不出现热点/抓取/分身等需凭证能力", async () => {
    // 条件：内存传输连上 MCP；预期：工具名恰好是分享、模板、文档。
    const server = createXiaofenshenMcpServer({
      config: loadConfig({}),
      http: async () => ({ status: 200, text: '{"items":[]}' }),
    });
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name).sort()).toEqual([...OPEN_TOOL_NAMES].sort());
    expect(tools.tools.map((t) => t.name)).not.toEqual(
      expect.arrayContaining(["hot_topics", "fetch_url", "list_twins"]),
    );

    await client.close();
    await server.close();
  });
});
