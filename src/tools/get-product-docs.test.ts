import { describe, expect, it, vi } from "vitest";
import { executeGetProductDocs } from "./get-product-docs.js";

function body(result: Awaited<ReturnType<typeof executeGetProductDocs>>) {
  const part = result.content[0];
  if (part?.type !== "text") throw new Error("expected text");
  return JSON.parse(part.text) as Record<string, unknown>;
}

describe("executeGetProductDocs", () => {
  it("无 slug 拉公开 /llms.txt", async () => {
    const http = vi.fn(async (url: string) => {
      expect(url).toBe("https://xiaofenshen.com/llms.txt");
      return { status: 200, text: "# 小分身" };
    });
    const result = await executeGetProductDocs({ http, webOrigin: "https://xiaofenshen.com" }, {});
    expect(body(result)).toMatchObject({ ok: true, kind: "index" });
  });

  it("有 slug 拉 /docs/<slug>.md", async () => {
    const http = vi.fn(async (url: string) => {
      expect(url).toBe("https://xiaofenshen.com/docs/getting-started.md");
      return { status: 200, text: "# 上手" };
    });
    const result = await executeGetProductDocs(
      { http, webOrigin: "https://xiaofenshen.com" },
      { slug: "getting-started.md" },
    );
    expect(body(result)).toMatchObject({ ok: true, kind: "doc" });
  });
});
