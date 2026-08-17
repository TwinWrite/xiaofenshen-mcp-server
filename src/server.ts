import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CAPABILITIES,
  mcpPromptsFromCatalog,
  mcpResourcesFromCatalog,
  mcpToolsFromCatalog,
} from "./catalog.js";
import type { AppDeps } from "./deps.js";
import { WRITING_STANDARDS } from "./infra/naturalness.js";
import { HOT_TOPIC_SOURCE_IDS, HOT_TOPIC_SOURCES } from "./infra/hot-topic-sources.js";
import { executeHotTopics, HOT_TOPICS_DESCRIPTION } from "./tools/hot-topics.js";
import { executeFetchUrl, FETCH_URL_DESCRIPTION, DEFAULT_MAX_URLS } from "./tools/fetch-url.js";
import {
  executeCheckWritingNaturalness,
  CHECK_NATURALNESS_DESCRIPTION,
} from "./tools/check-naturalness.js";
import {
  executeListImagePromptTemplates,
  LIST_IMAGE_PROMPT_TEMPLATES_DESCRIPTION,
} from "./tools/image-prompt-templates.js";
import { executeReadPublicShare, READ_PUBLIC_SHARE_DESCRIPTION } from "./tools/public-share.js";
import { executeGetProductDocs, GET_PRODUCT_DOCS_DESCRIPTION } from "./tools/product-docs.js";

export const SERVER_NAME = "xiaofenshen";
export const SERVER_VERSION = "0.1.0";

export function createXiaofenshenMcpServer(deps: AppDeps): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    title: "小分身开放 MCP",
  });

  server.registerTool(
    "hot_topics",
    {
      description: HOT_TOPICS_DESCRIPTION,
      inputSchema: z.object({
        sourceId: z
          .enum(HOT_TOPIC_SOURCE_IDS)
          .optional()
          .describe("平台 id。省略则返回 12 源摘要（每源前 8 条）"),
      }),
    },
    async (args) => executeHotTopics({ newsNow: deps.newsNow }, args),
  );

  server.registerTool(
    "fetch_url",
    {
      description: FETCH_URL_DESCRIPTION,
      inputSchema: z.object({
        urls: z
          .array(z.string().url().max(2048))
          .min(1)
          .max(DEFAULT_MAX_URLS)
          .describe(`要抓取的公开 URL，最多 ${DEFAULT_MAX_URLS} 个`),
        maxLength: z
          .number()
          .int()
          .min(100)
          .max(50_000)
          .optional()
          .describe("每个 URL 截取的最大字符数，默认 10000"),
        format: z.enum(["markdown", "text"]).optional().describe("默认 markdown"),
      }),
    },
    async (args) => executeFetchUrl(deps.fetchPageDeps, args),
  );

  server.registerTool(
    "check_writing_naturalness",
    {
      description: CHECK_NATURALNESS_DESCRIPTION,
      inputSchema: z.object({
        text: z.string().min(1).max(50_000).describe("待检测的作品正文"),
      }),
    },
    async (args) => executeCheckWritingNaturalness(args),
  );

  server.registerTool(
    "list_image_prompt_templates",
    {
      description: LIST_IMAGE_PROMPT_TEMPLATES_DESCRIPTION,
      inputSchema: z.object({
        slug: z.string().min(1).max(80).optional().describe("可选，只返回这一条模板"),
      }),
    },
    async (args) => executeListImagePromptTemplates({ api: deps.api }, args),
  );

  server.registerTool(
    "read_public_share",
    {
      description: READ_PUBLIC_SHARE_DESCRIPTION,
      inputSchema: z.object({
        tokenOrUrl: z.string().min(1).max(2048).describe("分享页 URL 或 token"),
      }),
    },
    async (args) => executeReadPublicShare({ api: deps.api }, args),
  );

  server.registerTool(
    "get_product_docs",
    {
      description: GET_PRODUCT_DOCS_DESCRIPTION,
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
      executeGetProductDocs({ api: deps.api, webOrigin: deps.config.webOrigin }, args),
  );

  server.registerResource(
    "catalog",
    "xiaofenshen://catalog",
    {
      description: "小分身开放 / 封闭 / 未来 MCP 能力目录",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              openTools: mcpToolsFromCatalog(),
              openResources: mcpResourcesFromCatalog(),
              openPrompts: mcpPromptsFromCatalog(),
              capabilities: CAPABILITIES,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "writing-standards",
    "xiaofenshen://writing-standards",
    {
      description: "小分身全局写作手法与绝对禁区",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: WRITING_STANDARDS }],
    }),
  );

  server.registerResource(
    "hot-topic-sources",
    "xiaofenshen://hot-topic-sources",
    {
      description: "热点平台白名单（id 与展示名）",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ sources: HOT_TOPIC_SOURCES }, null, 2),
        },
      ],
    }),
  );

  server.registerPrompt(
    "research-hot-topic",
    {
      description: "围绕一条中文热点做选题调研：先读热点快照，再抓取原文，最后给出可写角度",
      argsSchema: {
        topic: z.string().describe("话题、平台或热点标题"),
      },
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `请围绕「${topic}」做选题调研。先用 hot_topics 看相关平台快照，` +
              `对值得深挖的链接再用 fetch_url 读原文，最后给出 2～3 个可写角度和风险点。` +
              `不要编造没读到的事实。`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "rewrite-natural",
    {
      description: "按小分身自然表达标准改写正文，去掉 AI 套话",
      argsSchema: {
        text: z.string().describe("待改写正文"),
      },
    },
    ({ text }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `先用 check_writing_naturalness 检测下面正文，再按 xiaofenshen://writing-standards 改写。` +
              `只改表达，不改变事实。改完再检测一次，直到 clean 或只剩无法机械消除的项。\n\n${text}`,
          },
        },
      ],
    }),
  );

  return server;
}
