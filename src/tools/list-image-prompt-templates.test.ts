import { describe, expect, it, vi } from "vitest";
import { executeListImagePromptTemplates } from "./list-image-prompt-templates.js";

function body(result: Awaited<ReturnType<typeof executeListImagePromptTemplates>>) {
  const part = result.content[0];
  if (part?.type !== "text") throw new Error("expected text");
  return JSON.parse(part.text) as { items?: unknown[]; error?: string };
}

describe("executeListImagePromptTemplates", () => {
  it("转发公开列表，并可用 slug 过滤", async () => {
    const http = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.xiaofenshen.com/api/image-prompt-templates");
      return {
        status: 200,
        text: JSON.stringify({
          items: [
            { slug: "cover", name: "封面" },
            { slug: "inline", name: "配图" },
          ],
        }),
      };
    });
    const result = await executeListImagePromptTemplates(
      { http, apiBaseUrl: "https://api.xiaofenshen.com" },
      { slug: "cover" },
    );
    expect(body(result)).toEqual({ ok: true, items: [{ slug: "cover", name: "封面" }] });
  });

  it("slug 不存在时失败", async () => {
    const result = await executeListImagePromptTemplates(
      { http: async () => ({ status: 200, text: '{"items":[]}' }), apiBaseUrl: "https://api.example" },
      { slug: "missing" },
    );
    expect(result.isError).toBe(true);
  });
});
