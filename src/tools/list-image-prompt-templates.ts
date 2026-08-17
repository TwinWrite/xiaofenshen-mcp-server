import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { errorResult, jsonResult } from "../mcp-result.js";
import { getJson, type HttpGet } from "../http.js";

export async function executeListImagePromptTemplates(
  deps: { http: HttpGet; apiBaseUrl: string },
  input: { slug?: string } = {},
): Promise<CallToolResult> {
  try {
    const payload = await getJson(deps.http, `${deps.apiBaseUrl}/api/image-prompt-templates`);
    const items = Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];
    const filtered = input.slug
      ? items.filter(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            (row as { slug?: string }).slug === input.slug,
        )
      : items;
    if (input.slug && filtered.length === 0) {
      return errorResult(`没有 slug=${input.slug} 的启用模板`);
    }
    return jsonResult({ ok: true, items: filtered });
  } catch (err) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
