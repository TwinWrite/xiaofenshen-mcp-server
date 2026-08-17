import { describe, expect, it, vi } from "vitest";
import { executeGetProductDocs } from "./product-docs.js";
import type { XiaofenshenClient } from "../infra/xiaofenshen-api.js";

describe("executeGetProductDocs", () => {
  it("无 slug 拉 llms.txt 索引", async () => {
    const api: XiaofenshenClient = {
      getJson: vi.fn(),
      getText: vi.fn(async (url) => {
        expect(url).toBe("https://xiaofenshen.com/llms.txt");
        return { text: "# 小分身", contentType: "text/plain", status: 200 };
      }),
    };
    const result = await executeGetProductDocs({ api, webOrigin: "https://xiaofenshen.com" }, {});
    const text = result.content[0];
    if (text?.type !== "text") throw new Error("expected text");
    expect(JSON.parse(text.text)).toMatchObject({ ok: true, kind: "index" });
  });

  it("有 slug 拉 /docs/<slug>.md", async () => {
    const api: XiaofenshenClient = {
      getJson: vi.fn(),
      getText: vi.fn(async (url) => {
        expect(url).toBe("https://xiaofenshen.com/docs/getting-started.md");
        return { text: "# 上手", contentType: "text/markdown", status: 200 };
      }),
    };
    const result = await executeGetProductDocs(
      { api, webOrigin: "https://xiaofenshen.com" },
      { slug: "getting-started.md" },
    );
    const text = result.content[0];
    if (text?.type !== "text") throw new Error("expected text");
    expect(JSON.parse(text.text)).toMatchObject({
      ok: true,
      kind: "doc",
      slug: "getting-started.md",
    });
  });
});
