import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, errorResult } from "../mcp-result.js";
import type { XiaofenshenClient } from "../infra/xiaofenshen-api.js";
import { XiaofenshenApiError } from "../infra/xiaofenshen-api.js";

export async function executeListImagePromptTemplates(
  deps: { api: XiaofenshenClient },
  input: { slug?: string } = {},
): Promise<CallToolResult> {
  try {
    const payload = await deps.api.getJson("/api/image-prompt-templates");
    const items = Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : [];
    const filtered = input.slug
      ? items.filter((row) => typeof row === "object" && row !== null && (row as { slug?: string }).slug === input.slug)
      : items;
    if (input.slug && filtered.length === 0) {
      return errorResult(`没有 slug=${input.slug} 的启用模板`);
    }
    return jsonResult({ ok: true, items: filtered });
  } catch (err) {
    const message =
      err instanceof XiaofenshenApiError ? err.message : err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

export const LIST_IMAGE_PROMPT_TEMPLATES_DESCRIPTION =
  "列出小分身启用的生图提示词模板（系统级只读，含 prompt 与效果图）。" +
  "可选 slug 过滤单条。用于给配图提示词找参考，不会真的调用即梦生图。";
