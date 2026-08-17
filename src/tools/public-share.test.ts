import { describe, expect, it, vi } from "vitest";
import { executeReadPublicShare, parseShareToken } from "./public-share.js";
import { XiaofenshenApiError } from "../infra/xiaofenshen-api.js";
import type { XiaofenshenClient } from "../infra/xiaofenshen-api.js";

describe("parseShareToken", () => {
  it("从完整 URL、路径或裸 token 取出同一值", () => {
    expect(parseShareToken("https://xiaofenshen.com/share/a/tok-abc?ref=x")).toBe("tok-abc");
    expect(parseShareToken("/share/a/tok-abc")).toBe("tok-abc");
    expect(parseShareToken("tok-abc")).toBe("tok-abc");
  });
});

describe("executeReadPublicShare", () => {
  it("命中公开快照", async () => {
    const api: XiaofenshenClient = {
      getJson: vi.fn(async (path) => {
        expect(path).toBe("/api/share/tok-abc");
        return { title: "标题", content: "正文", twinName: "阿分" };
      }),
      getText: vi.fn(),
    };
    const result = await executeReadPublicShare(
      { api },
      { tokenOrUrl: "https://xiaofenshen.com/share/a/tok-abc" },
    );
    const text = result.content[0];
    if (text?.type !== "text") throw new Error("expected text");
    expect(JSON.parse(text.text)).toMatchObject({
      ok: true,
      token: "tok-abc",
      share: { title: "标题" },
    });
  });

  it("404 返回已撤销语义", async () => {
    const api: XiaofenshenClient = {
      getJson: vi.fn(async () => {
        throw new XiaofenshenApiError("missing", 404);
      }),
      getText: vi.fn(),
    };
    const result = await executeReadPublicShare({ api }, { tokenOrUrl: "gone" });
    expect(result.isError).toBe(true);
    const text = result.content[0];
    if (text?.type !== "text") throw new Error("expected text");
    expect(JSON.parse(text.text).error).toMatch(/不存在或已撤销/);
  });
});
