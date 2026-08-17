import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { defaultHttpGet, type HttpGet } from "./http.js";
import { executeReadPublicShare } from "./tools/read-public-share.js";
import { executeListImagePromptTemplates } from "./tools/list-image-prompt-templates.js";
import { executeGetProductDocs } from "./tools/get-product-docs.js";

export const SERVER_NAME = "xiaofenshen";
export const SERVER_VERSION = "0.1.0";

/** 第一波只开放已经免登录的三条。带用户 token 的能力不在本版本注册。 */
export const OPEN_TOOL_NAMES = [
  "read_public_share",
  "list_image_prompt_templates",
  "get_product_docs",
] as const;

export type ServerDeps = {
  config: AppConfig;
  http: HttpGet;
};

export function createDefaultDeps(env: NodeJS.ProcessEnv = process.env): ServerDeps {
  return { config: loadConfig(env), http: defaultHttpGet };
}

export function createXiaofenshenMcpServer(deps: ServerDeps): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    title: "小分身公开 MCP",
  });

  server.registerTool(
    "read_public_share",
    {
      description:
        "读取用户主动公开的小分身文章快照。可传分享页 URL 或 token。" +
        "只返回标题、正文、封面和分身署名，不含对话上下文。",
      inputSchema: z.object({
        tokenOrUrl: z.string().min(1).max(2048).describe("分享页 URL 或 token"),
      }),
    },
    async (args) =>
      executeReadPublicShare({ http: deps.http, apiBaseUrl: deps.config.apiBaseUrl }, args),
  );

  server.registerTool(
    "list_image_prompt_templates",
    {
      description:
        "列出小分身启用的生图提示词模板（系统级只读，含 prompt 与效果图）。可选 slug 过滤单条。不会触发生图。",
      inputSchema: z.object({
        slug: z.string().min(1).max(80).optional().describe("可选，只返回这一条模板"),
      }),
    },
    async (args) =>
      executeListImagePromptTemplates({ http: deps.http, apiBaseUrl: deps.config.apiBaseUrl }, args),
  );

  server.registerTool(
    "get_product_docs",
    {
      description:
        "读取小分身公开帮助文档。不传 slug 返回 /llms.txt 索引；传 slug 返回对应 Markdown。",
      inputSchema: z.object({
        slug: z
          .string()
          .min(1)
          .max(200)
          .optional()
          .describe("文档 slug。省略则返回 /llms.txt 索引"),
      }),
    },
    async (args) =>
      executeGetProductDocs({ http: deps.http, webOrigin: deps.config.webOrigin }, args),
  );

  return server;
}
