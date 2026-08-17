import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, errorResult } from "../mcp-result.js";
import { mapWithConcurrency } from "../infra/concurrency.js";
import {
  HOT_TOPIC_SOURCE_IDS,
  HOT_TOPIC_SOURCES,
  hotTopicSourceName,
  isHotTopicSourceId,
  type HotTopicSourceId,
} from "../infra/hot-topic-sources.js";
import type { NewsNowClient } from "../infra/newsnow.js";
import { NewsNowFetchError } from "../infra/newsnow.js";

const SUMMARY_LIMIT = 8;
const FETCH_CONCURRENCY = 3;

export type HotTopicsToolDeps = {
  newsNow: NewsNowClient;
};

async function fetchOne(client: NewsNowClient, sourceId: HotTopicSourceId) {
  try {
    const row = await client.fetchSource(sourceId);
    return {
      ok: true as const,
      sourceId,
      name: hotTopicSourceName(sourceId),
      items: row.items,
      itemCount: row.items.length,
      sourceUpdatedTime: row.sourceUpdatedTime,
    };
  } catch (err) {
    return {
      ok: false as const,
      sourceId,
      name: hotTopicSourceName(sourceId),
      error: err instanceof NewsNowFetchError ? err.message : err instanceof Error ? err.message : String(err),
      causeCode: err instanceof NewsNowFetchError ? err.causeCode : "network",
    };
  }
}

export async function executeHotTopics(
  deps: HotTopicsToolDeps,
  input: { sourceId?: string },
): Promise<CallToolResult> {
  if (input.sourceId) {
    if (!isHotTopicSourceId(input.sourceId)) {
      return errorResult(
        `未知平台 id: ${input.sourceId}。可用：${HOT_TOPIC_SOURCE_IDS.join(", ")}`,
      );
    }
    const row = await fetchOne(deps.newsNow, input.sourceId);
    return jsonResult({ mode: "one", ...row }, !row.ok);
  }

  const rows = await mapWithConcurrency(HOT_TOPIC_SOURCE_IDS, FETCH_CONCURRENCY, (sourceId) =>
    fetchOne(deps.newsNow, sourceId),
  );
  return jsonResult({
    ok: true,
    mode: "summary",
    sources: rows.map((row) =>
      row.ok
        ? {
            ok: true,
            sourceId: row.sourceId,
            name: row.name,
            itemCount: row.itemCount,
            sourceUpdatedTime: row.sourceUpdatedTime,
            items: row.items.slice(0, SUMMARY_LIMIT),
          }
        : row,
    ),
  });
}

export const HOT_TOPICS_DESCRIPTION =
  "读取中文互联网热点快照（微博/知乎/抖音/百度等 12 平台）。用于选题参考与趋势感知。" +
  "省略 sourceId 返回各源前 8 条摘要；指定 sourceId 返回该平台完整列表。" +
  "数据来自 NewsNow，不是实时直连各平台。某源失败时其它源仍返回。";

export { HOT_TOPIC_SOURCE_IDS, HOT_TOPIC_SOURCES };
