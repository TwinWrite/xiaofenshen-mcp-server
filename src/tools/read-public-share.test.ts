import { describe, expect, it, vi } from "vitest";
import { executeReadPublicShare } from "./read-public-share.js";
import type { HttpGet } from "../http.js";

function body(result: Awaited<ReturnType<typeof executeReadPublicShare>>) {
  const part = result.content[0];
  if (part?.type !== "text") throw new Error("expected text");
  return JSON.parse(part.text) as Record<string, unknown>;
}

describe("executeReadPublicShare", () => {
  it("把分享 URL 转成 GET /api/share/:token", async () => {
    const http: HttpGet = vi.fn(async (url) => {
      expect(url).toBe("https://api.xiaofenshen.com/api/share/tok-abc");
      return {
        status: 200,
        text: JSON.stringify({ title: "标题", content: "正文", twinName: "阿分" }),
      };
    });
    const result = await executeReadPublicShare(
      { http, apiBaseUrl: "https://api.xiaofenshen.com" },
      { tokenOrUrl: "https://xiaofenshen.com/share/a/tok-abc" },
    );
    expect(result.isError).toBeFalsy();
    expect(body(result)).toMatchObject({ ok: true, token: "tok-abc" });
  });

  it("上游 404 映射为已撤销，不回传原始 HTML", async () => {
    const result = await executeReadPublicShare(
      { http: async () => ({ status: 404, text: "no" }), apiBaseUrl: "https://api.example" },
      { tokenOrUrl: "gone" },
    );
    expect(result.isError).toBe(true);
    expect(body(result).error).toBe("分享不存在或已撤销");
  });
});
