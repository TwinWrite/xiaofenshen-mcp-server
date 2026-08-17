import { describe, expect, it, vi } from "vitest";
import { executeHotTopics } from "./hot-topics.js";
import type { NewsNowClient } from "../infra/newsnow.js";
import { NewsNowFetchError } from "../infra/newsnow.js";

function parse(result: Awaited<ReturnType<typeof executeHotTopics>>) {
  const text = result.content[0];
  if (text?.type !== "text") throw new Error("expected text");
  return JSON.parse(text.text) as Record<string, unknown>;
}

describe("executeHotTopics", () => {
  it("指定平台返回完整列表", async () => {
    // 条件：sourceId=weibo 且上游成功；预期：mode=one，含完整 items。
    const newsNow: NewsNowClient = {
      fetchSource: vi.fn(async (id) => ({
        sourceId: id,
        sourceUpdatedTime: "1",
        items: [{ id: "1", rank: 1, title: "热搜A", url: "https://weibo.com/a" }],
      })),
    };
    const body = parse(await executeHotTopics({ newsNow }, { sourceId: "weibo" }));
    expect(body).toMatchObject({
      ok: true,
      mode: "one",
      sourceId: "weibo",
      name: "新浪微博",
    });
  });

  it("未知平台 id 直接失败，不打上游", async () => {
    const fetchSource = vi.fn();
    const result = await executeHotTopics({ newsNow: { fetchSource } }, { sourceId: "reddit" });
    expect(result.isError).toBe(true);
    expect(fetchSource).not.toHaveBeenCalled();
  });

  it("摘要模式某源失败不影响其它源", async () => {
    const newsNow: NewsNowClient = {
      fetchSource: vi.fn(async (id) => {
        if (id === "weibo") throw new NewsNowFetchError("blocked", "blocked");
        return {
          sourceId: id,
          sourceUpdatedTime: null,
          items: Array.from({ length: 10 }, (_, i) => ({
            id: String(i),
            rank: i + 1,
            title: `${id}-${i}`,
            url: `https://example.com/${i}`,
          })),
        };
      }),
    };
    const body = parse(await executeHotTopics({ newsNow }, {}));
    expect(body.mode).toBe("summary");
    const sources = body.sources as Array<{ sourceId: string; ok: boolean; items?: unknown[] }>;
    const weibo = sources.find((s) => s.sourceId === "weibo");
    const zhihu = sources.find((s) => s.sourceId === "zhihu");
    expect(weibo?.ok).toBe(false);
    expect(zhihu?.ok).toBe(true);
    expect(zhihu?.items).toHaveLength(8);
  });
});
