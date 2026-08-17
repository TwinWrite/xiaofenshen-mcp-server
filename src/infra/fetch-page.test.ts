import { describe, expect, it, vi } from "vitest";
import { fetchPage } from "./fetch-page.js";

const publicResolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);

describe("fetchPage", () => {
  it("把 HTML 转成 Markdown 并提取标题", async () => {
    // 条件：公网页含标题与段落；预期：ok + ATX 标题 + 正文。
    const result = await fetchPage("https://example.com/a", {
      resolver: publicResolver,
      fetchFn: async () => ({
        ok: true,
        status: 200,
        headers: { get: (n: string) => (n === "content-type" ? "text/html" : null) },
        text: async () => "<html><head><title>示例</title></head><body><h1>标题</h1><p>你好</p></body></html>",
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.title).toBe("示例");
      expect(result.content).toContain("# 标题");
      expect(result.content).toContain("你好");
    }
  });

  it("微信文章只保留 #js_content 正文", async () => {
    const html = `<div id="js_top_ad">广告</div><div id="js_content"><p>公众号正文</p></div><div id="js_tags">推荐</div>`;
    const result = await fetchPage("https://mp.weixin.qq.com/s/abc", {
      resolver: publicResolver,
      fetchFn: async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => html,
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toContain("公众号正文");
      expect(result.content).not.toContain("广告");
      expect(result.content).not.toContain("推荐");
    }
  });

  it("拒绝私网 URL，不发请求", async () => {
    const fetchFn = vi.fn();
    const result = await fetchPage("http://127.0.0.1/secret", { fetchFn });
    expect(result.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("拒绝 302 跳到私网", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 302,
      headers: { get: (n: string) => (n === "location" ? "http://169.254.169.254/latest" : null) },
      text: async () => "",
    }));
    const result = await fetchPage("https://example.com/go", {
      resolver: publicResolver,
      fetchFn,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/非公网|reserved|Blocked/i);
  });

  it("超长正文按 maxLength 截断", async () => {
    const result = await fetchPage("https://example.com/long", {
      resolver: publicResolver,
      fetchFn: async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/plain" },
        text: async () => "abcdefghij",
      }),
    }, { maxLength: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content).toBe("abcd");
      expect(result.truncated).toBe(true);
      expect(result.originalLength).toBe(10);
    }
  });
});
