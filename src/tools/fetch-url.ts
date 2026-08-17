import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult } from "../mcp-result.js";
import { mapWithConcurrency } from "../infra/concurrency.js";
import { fetchPage, type FetchPageDeps } from "../infra/fetch-page.js";

export const DEFAULT_MAX_URLS = 5;
export const DEFAULT_FETCH_CONCURRENCY = 3;
export const DEFAULT_MAX_LENGTH = 10_000;

export type FetchUrlToolDeps = FetchPageDeps;

export async function executeFetchUrl(
  deps: FetchUrlToolDeps,
  input: { urls: string[]; maxLength?: number; format?: "markdown" | "text" },
): Promise<CallToolResult> {
  const maxLength = input.maxLength ?? DEFAULT_MAX_LENGTH;
  const results = await mapWithConcurrency(
    input.urls,
    DEFAULT_FETCH_CONCURRENCY,
    (url) => fetchPage(url, deps, { maxLength, format: input.format }),
  );
  return jsonResult({ ok: true, results });
}

export const FETCH_URL_DESCRIPTION =
  "抓取一个或多个公开网页，返回标题与 Markdown 正文。" +
  "微信公众号文章会先抽出 #js_content 正文容器，去掉导航和推荐。" +
  "拒绝私网/回环/云厂商元数据地址。最多 5 个 URL。读不到时请让用户改贴正文。";
