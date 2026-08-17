import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, errorResult } from "../mcp-result.js";
import type { XiaofenshenClient } from "../infra/xiaofenshen-api.js";
import { XiaofenshenApiError } from "../infra/xiaofenshen-api.js";

/** 接受完整分享 URL 或 token。 */
export function parseShareToken(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const matched = url.pathname.match(/\/share\/a\/([^/]+)\/?$/);
    if (matched?.[1]) return decodeURIComponent(matched[1]);
  } catch {
    // 不是绝对 URL，继续按路径或裸 token 解析
  }
  const pathMatch = trimmed.match(/share\/a\/([^/?#]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  return trimmed;
}

export async function executeReadPublicShare(
  deps: { api: XiaofenshenClient },
  input: { tokenOrUrl: string },
): Promise<CallToolResult> {
  const token = parseShareToken(input.tokenOrUrl);
  if (!token) return errorResult("缺少分享 token");
  try {
    const payload = await deps.api.getJson(`/api/share/${encodeURIComponent(token)}`);
    return jsonResult({ ok: true, token, share: payload });
  } catch (err) {
    if (err instanceof XiaofenshenApiError && err.status === 404) {
      return errorResult("分享不存在或已撤销");
    }
    const message =
      err instanceof XiaofenshenApiError ? err.message : err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

export const READ_PUBLIC_SHARE_DESCRIPTION =
  "读取用户主动公开的小分身文章快照。可传分享页 URL 或 token。" +
  "只返回标题、正文、封面和分身署名，不包含对话上下文。";
