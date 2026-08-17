/**
 * NewsNow 热点上游客户端。简化自小分身 newsnow-client：开放 MCP 不接抓取凭据池，
 * 只保留浏览器请求头、JSON 规范化，以及可选的进程级 HTTPS_PROXY。
 */

import { z } from "zod";
import type { HotTopicItem } from "./hot-topic-sources.js";

const newsItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  url: z.string(),
  mobileUrl: z.string().optional(),
  extra: z
    .object({
      hover: z.string().optional(),
      info: z.union([z.string(), z.literal(false)]).optional(),
    })
    .passthrough()
    .optional(),
});

const sourceResponseSchema = z.object({
  status: z.enum(["success", "cache"]).optional(),
  id: z.string().optional(),
  updatedTime: z.union([z.string(), z.number()]).optional(),
  items: z.array(newsItemSchema),
});

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const BROWSER_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "User-Agent": BROWSER_UA,
};

export type NewsNowFetchResult = {
  sourceId: string;
  sourceUpdatedTime: string | null;
  items: HotTopicItem[];
};

export type NewsNowCauseCode =
  | "http_error"
  | "blocked"
  | "timeout"
  | "invalid_json"
  | "invalid_shape"
  | "empty_items"
  | "network";

export class NewsNowFetchError extends Error {
  constructor(
    message: string,
    readonly causeCode: NewsNowCauseCode,
  ) {
    super(message);
    this.name = "NewsNowFetchError";
  }
}

export type FetchLike = (
  url: string,
  init: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<Response>;

export type NewsNowClientDeps = {
  getBaseUrl: () => string | Promise<string>;
  getTimeoutMs: () => number | Promise<number>;
  fetchFn?: FetchLike;
};

function looksLikeCloudflareOrChallenge(status: number, body: string): boolean {
  const hasHtmlShell = /<!DOCTYPE\s+html/i.test(body) || /<html[\s>]/i.test(body);
  const hasCfSignals =
    /cloudflare|cf-ray|attention required|just a moment|captcha|challenge-platform/i.test(body);
  if (status === 403 || status === 503 || status === 429) {
    return hasHtmlShell || hasCfSignals;
  }
  return hasHtmlShell && hasCfSignals;
}

function normalizeItems(raw: z.infer<typeof newsItemSchema>[]): HotTopicItem[] {
  const items: HotTopicItem[] = [];
  for (const row of raw) {
    const title = row.title.trim();
    const url = row.url.trim();
    if (!title || !url) continue;
    const heat =
      typeof row.extra?.info === "string" && row.extra.info.trim()
        ? row.extra.info.trim()
        : undefined;
    const extraHover =
      typeof row.extra?.hover === "string" && row.extra.hover.trim()
        ? row.extra.hover.trim()
        : undefined;
    items.push({
      id: String(row.id),
      rank: items.length + 1,
      title,
      url,
      ...(row.mobileUrl?.trim() ? { mobileUrl: row.mobileUrl.trim() } : {}),
      ...(heat ? { heat } : {}),
      ...(extraHover ? { extraHover } : {}),
    });
  }
  return items;
}

export function createNewsNowClient(deps: NewsNowClientDeps) {
  const fetchFn = deps.fetchFn ?? fetch;

  return {
    async fetchSource(sourceId: string): Promise<NewsNowFetchResult> {
      const baseUrl = (await deps.getBaseUrl()).replace(/\/+$/, "");
      const timeoutMs = await deps.getTimeoutMs();
      const url = `${baseUrl}/api/s?id=${encodeURIComponent(sourceId)}`;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchFn(url, {
          method: "GET",
          headers: {
            ...BROWSER_HEADERS,
            Referer: `${baseUrl}/`,
            Origin: baseUrl,
          },
          signal: controller.signal,
        });
      } catch (err) {
        const aborted =
          err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
        throw new NewsNowFetchError(
          aborted
            ? `NewsNow 超时 (${timeoutMs}ms): ${sourceId}`
            : `NewsNow 网络错误: ${sourceId}: ${err instanceof Error ? err.message : String(err)}`,
          aborted ? "timeout" : "network",
        );
      } finally {
        clearTimeout(timer);
      }

      const text = await res.text();
      if (looksLikeCloudflareOrChallenge(res.status, text)) {
        throw new NewsNowFetchError(
          `NewsNow 被反爬拦截 (${res.status}): ${sourceId}。请把 NEWSNOW_BASE_URL 指到自建实例。`,
          "blocked",
        );
      }
      if (!res.ok) {
        const snippet = text.slice(0, 120).replace(/\s+/g, " ");
        throw new NewsNowFetchError(
          `NewsNow HTTP ${res.status}: ${sourceId}${snippet ? ` — ${snippet}` : ""}`,
          "http_error",
        );
      }

      let json: unknown;
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        throw new NewsNowFetchError(`NewsNow 非 JSON 响应: ${sourceId}`, "invalid_json");
      }

      const parsed = sourceResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new NewsNowFetchError(`NewsNow 响应结构无效: ${sourceId}`, "invalid_shape");
      }

      const items = normalizeItems(parsed.data.items);
      if (items.length === 0) {
        throw new NewsNowFetchError(`NewsNow 空列表: ${sourceId}`, "empty_items");
      }

      const updated = parsed.data.updatedTime;
      return {
        sourceId,
        sourceUpdatedTime: updated === undefined || updated === null ? null : String(updated),
        items,
      };
    },
  };
}

export type NewsNowClient = ReturnType<typeof createNewsNowClient>;
