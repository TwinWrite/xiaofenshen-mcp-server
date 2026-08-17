import { describe, expect, it, vi } from "vitest";
import { executeListImagePromptTemplates } from "./image-prompt-templates.js";
import type { XiaofenshenClient } from "../infra/xiaofenshen-api.js";

describe("executeListImagePromptTemplates", () => {
  it("可按 slug 过滤", async () => {
    const api: XiaofenshenClient = {
      getJson: vi.fn(async () => ({
        items: [
          { slug: "cover", name: "封面" },
          { slug: "inline", name: "配图" },
        ],
      })),
      getText: vi.fn(),
    };
    const result = await executeListImagePromptTemplates({ api }, { slug: "cover" });
    const text = result.content[0];
    if (text?.type !== "text") throw new Error("expected text");
    expect(JSON.parse(text.text)).toEqual({
      ok: true,
      items: [{ slug: "cover", name: "封面" }],
    });
  });

  it("slug 不存在时失败", async () => {
    const api: XiaofenshenClient = {
      getJson: vi.fn(async () => ({ items: [] })),
      getText: vi.fn(),
    };
    const result = await executeListImagePromptTemplates({ api }, { slug: "missing" });
    expect(result.isError).toBe(true);
  });
});
