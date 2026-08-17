import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, errorResult } from "../mcp-result.js";
import type { XiaofenshenClient } from "../infra/xiaofenshen-api.js";
import { XiaofenshenApiError } from "../infra/xiaofenshen-api.js";

function docMarkdownUrl(webOrigin: string, slug: string): string {
  const cleaned = slug.replace(/^\/+/, "").replace(/\.md$/i, "");
  return `${webOrigin.replace(/\/+$/, "")}/docs/${cleaned}.md`;
}

export async function executeGetProductDocs(
  deps: { api: XiaofenshenClient; webOrigin: string },
  input: { slug?: string } = {},
): Promise<CallToolResult> {
  try {
    if (!input.slug) {
      const { text } = await deps.api.getText(`${deps.webOrigin}/llms.txt`);
      return jsonResult({ ok: true, kind: "index", url: `${deps.webOrigin}/llms.txt`, markdown: text });
    }
    const url = docMarkdownUrl(deps.webOrigin, input.slug);
    const { text } = await deps.api.getText(url);
    return jsonResult({ ok: true, kind: "doc", slug: input.slug, url, markdown: text });
  } catch (err) {
    if (err instanceof XiaofenshenApiError && err.status === 404) {
      return errorResult(`文档不存在: ${input.slug ?? "llms.txt"}`);
    }
    const message =
      err instanceof XiaofenshenApiError ? err.message : err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

export const GET_PRODUCT_DOCS_DESCRIPTION =
  "读取小分身公开帮助文档。不传 slug 返回 /llms.txt 索引；传 slug（如 getting-started）返回对应 Markdown。" +
  "用于回答「小分身怎么用」而不是替用户登录操作私有数据。";
