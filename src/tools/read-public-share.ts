import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { errorResult, jsonResult } from "../mcp-result.js";
import { getJson, type HttpGet, UpstreamError } from "../http.js";
import { parseShareToken } from "../parse-share-token.js";

export async function executeReadPublicShare(
  deps: { http: HttpGet; apiBaseUrl: string },
  input: { tokenOrUrl: string },
): Promise<CallToolResult> {
  const token = parseShareToken(input.tokenOrUrl);
  if (!token) return errorResult("缺少分享 token");
  try {
    const share = await getJson(
      deps.http,
      `${deps.apiBaseUrl}/api/share/${encodeURIComponent(token)}`,
    );
    return jsonResult({ ok: true, token, share });
  } catch (err) {
    if (err instanceof UpstreamError && err.status === 404) {
      return errorResult("分享不存在或已撤销");
    }
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
