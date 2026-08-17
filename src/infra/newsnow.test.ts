import { describe, expect, it, vi } from "vitest";
import { createNewsNowClient, NewsNowFetchError } from "./newsnow.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createNewsNowClient", () => {
  it("成功解析并规范化 rank/heat，且带浏览器级请求头", async () => {
    // 条件：上游返回合法 items；预期：规范化 + Chrome UA。
    const fetchFn = vi.fn(async (input: string, init: { headers?: Record<string, string> }) => {
      expect(String(input)).toBe("https://newsnow.example/api/s?id=weibo");
      expect(init.headers?.["User-Agent"]).toMatch(/Chrome\/131/);
      expect(init.headers?.Referer).toBe("https://newsnow.example/");
      return jsonResponse({
        status: "success",
        updatedTime: 1700000000000,
        items: [
          { id: 1, title: " 话题A ", url: " https://weibo.com/a ", extra: { info: "123万" } },
          { id: "x", title: "", url: "https://skip" },
          { id: 2, title: "话题B", url: "https://weibo.com/b" },
        ],
      });
    });

    const client = createNewsNowClient({
      getBaseUrl: () => "https://newsnow.example/",
      getTimeoutMs: () => 5000,
      fetchFn,
    });

    const result = await client.fetchSource("weibo");
    expect(result.items).toEqual([
      { id: "1", rank: 1, title: "话题A", url: "https://weibo.com/a", heat: "123万" },
      { id: "2", rank: 2, title: "话题B", url: "https://weibo.com/b" },
    ]);
    expect(result.sourceUpdatedTime).toBe("1700000000000");
  });

  it("Cloudflare 挑战页记为 blocked", async () => {
    const client = createNewsNowClient({
      getBaseUrl: () => "https://newsnow.example",
      getTimeoutMs: () => 5000,
      fetchFn: async () =>
        new Response("<html>Just a moment cloudflare</html>", { status: 403 }),
    });
    await expect(client.fetchSource("weibo")).rejects.toMatchObject({
      name: "NewsNowFetchError",
      causeCode: "blocked",
    } satisfies Partial<NewsNowFetchError>);
  });

  it("空列表失败，避免把无数据当成热点", async () => {
    const client = createNewsNowClient({
      getBaseUrl: () => "https://newsnow.example",
      getTimeoutMs: () => 5000,
      fetchFn: async () => jsonResponse({ items: [] }),
    });
    await expect(client.fetchSource("zhihu")).rejects.toMatchObject({ causeCode: "empty_items" });
  });
});
