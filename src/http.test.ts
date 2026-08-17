import { describe, expect, it } from "vitest";
import { getJson, getText, UpstreamError } from "./http.js";

describe("http 上游读取", () => {
  it("JSON 200 原样解析", async () => {
    const data = await getJson(async () => ({ status: 200, text: '{"ok":true}' }), "https://api.example/x");
    expect(data).toEqual({ ok: true });
  });

  it("404 带上 status，便于工具映射「不存在」", async () => {
    await expect(getJson(async () => ({ status: 404, text: "no" }), "https://api.example/x")).rejects.toMatchObject({
      name: "UpstreamError",
      status: 404,
    } satisfies Partial<UpstreamError>);
  });

  it("非 JSON 当上游错误", async () => {
    await expect(getJson(async () => ({ status: 200, text: "<html>" }), "https://api.example/x")).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });

  it("文本 200 返回正文", async () => {
    await expect(getText(async () => ({ status: 200, text: "# docs" }), "https://web.example/llms.txt")).resolves.toBe(
      "# docs",
    );
  });
});
