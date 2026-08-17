/**
 * 公开网页抓取：SSRF 校验 → 手工跟随重定向（每跳再校验）→ 微信正文提取 → Markdown。
 */

import { assertPublicHttpUrl, type UrlValidatorDeps } from "./ssrf.js";
import { htmlToMarkdown } from "./html-to-markdown.js";
import { extractWechatArticleHtml } from "./wechat-article.js";
import { SsrfError } from "./errors.js";

export const DEFAULT_MAX_LENGTH = 10_000;
export const DEFAULT_MAX_REDIRECTS = 5;
export const DEFAULT_TIMEOUT_MS = 15_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type FetchLike = (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    redirect?: "manual" | "follow" | "error";
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export type FetchPageResult =
  | {
      ok: true;
      url: string;
      finalUrl: string;
      title?: string;
      contentType: string;
      content: string;
      truncated: boolean;
      originalLength: number;
    }
  | { ok: false; url: string; error: string };

export type FetchPageDeps = UrlValidatorDeps & {
  fetchFn?: FetchLike;
  timeoutMs?: number;
  maxRedirects?: number;
};

function extractTitle(html: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (og?.[1]?.trim()) return og[1].trim();
  const h1 = html.match(/<h1[^>]*id=["']activity-name["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) {
    const text = h1[1].replace(/<[^>]+>/g, "").trim();
    if (text) return text;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = title?.[1]?.replace(/<[^>]+>/g, "").trim();
  return text || undefined;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function fetchPage(
  rawUrl: string,
  deps: FetchPageDeps = {},
  opts: { maxLength?: number; format?: "markdown" | "text" } = {},
): Promise<FetchPageResult> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = deps.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxLength = opts.maxLength ?? DEFAULT_MAX_LENGTH;
  const fetchFn = deps.fetchFn ?? fetch;

  let current: URL;
  try {
    current = await assertPublicHttpUrl(rawUrl, deps);
  } catch (err) {
    return { ok: false, url: rawUrl, error: err instanceof Error ? err.message : String(err) };
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchFn(current.href, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "User-Agent": BROWSER_UA,
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      const aborted =
        err instanceof Error && (err.name === "AbortError" || /aborted/i.test(err.message));
      return {
        ok: false,
        url: rawUrl,
        error: aborted ? `抓取超时 (${timeoutMs}ms)` : `网络错误: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }

    if (isRedirect(res.status)) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, url: rawUrl, error: `重定向 ${res.status} 缺少 Location` };
      }
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { ok: false, url: rawUrl, error: `非法重定向地址: ${location}` };
      }
      try {
        current = await assertPublicHttpUrl(next.href, deps);
      } catch (err) {
        return {
          ok: false,
          url: rawUrl,
          error:
            err instanceof SsrfError
              ? `拒绝跟随重定向到非公网地址: ${err.message}`
              : err instanceof Error
                ? err.message
                : String(err),
        };
      }
      continue;
    }

    if (!res.ok) {
      return { ok: false, url: rawUrl, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "text/html";
    const raw = await res.text();
    const isHtml = /html|xml/i.test(contentType) || /^\s*</.test(raw);
    const body = isHtml ? (extractWechatArticleHtml(raw) ?? raw) : raw;
    const title = isHtml ? extractTitle(raw) : undefined;
    let content = isHtml
      ? opts.format === "text"
        ? body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : htmlToMarkdown(body)
      : raw;
    const originalLength = content.length;
    const truncated = originalLength > maxLength;
    if (truncated) content = content.slice(0, maxLength);
    return {
      ok: true,
      url: rawUrl,
      finalUrl: current.href,
      title,
      contentType,
      content,
      truncated,
      originalLength,
    };
  }

  return { ok: false, url: rawUrl, error: `重定向超过 ${maxRedirects} 次` };
}
