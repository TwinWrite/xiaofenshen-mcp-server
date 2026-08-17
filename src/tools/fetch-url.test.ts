import { describe, expect, it, vi } from "vitest";
import { executeFetchUrl } from "./fetch-url.js";

function parse(result: Awaited<ReturnType<typeof executeFetchUrl>>) {
  const text = result.content[0];
  if (text?.type !== "text") throw new Error("expected text");
  return JSON.parse(text.text) as {
    results: Array<{ ok: boolean; url: string; content?: string; error?: string }>;
  };
}

describe("executeFetchUrl", () => {
  it("按输入顺序返回逐项成功/失败", async () => {
    // 条件：两个 URL，一个公网 HTML、一个 localhost；预期：顺序保留，后者失败。
    const publicResolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const body = parse(
      await executeFetchUrl(
        {
          resolver: publicResolver,
          fetchFn: async (url) => ({
            ok: true,
            status: 200,
            headers: { get: () => "text/html" },
            text: async () => `<p>${url}</p>`,
          }),
        },
        { urls: ["https://example.com/a", "http://127.0.0.1/x"] },
      ),
    );
    expect(body.results).toHaveLength(2);
    expect(body.results[0]?.ok).toBe(true);
    expect(body.results[0]?.content).toContain("https://example.com/a");
    expect(body.results[1]?.ok).toBe(false);
  });
});
