import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { errorResult, jsonResult } from "../mcp-result.js";
import { getText, type HttpGet, UpstreamError } from "../http.js";

function docMarkdownUrl(webOrigin: string, slug: string): string {
  const cleaned = slug.replace(/^\/+/, "").replace(/\.md$/i, "");
  return `${webOrigin}/docs/${cleaned}.md`;
}

export async function executeGetProductDocs(
  deps: { http: HttpGet; webOrigin: string },
  input: { slug?: string } = {},
): Promise<CallToolResult> {
  try {
    if (!input.slug) {
      const url = `${deps.webOrigin}/llms.txt`;
      const markdown = await getText(deps.http, url);
      return jsonResult({ ok: true, kind: "index", url, markdown });
    }
    const url = docMarkdownUrl(deps.webOrigin, input.slug);
    const markdown = await getText(deps.http, url);
    return jsonResult({ ok: true, kind: "doc", slug: input.slug, url, markdown });
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return errorResult(`文档不存在: ${input.slug ?? "llms.txt"}`);
    }
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
