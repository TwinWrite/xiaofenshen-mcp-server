import { describe, expect, it } from "vitest";
import { parseShareToken } from "./parse-share-token.js";

describe("parseShareToken", () => {
  it("从完整 URL、路径或裸 token 取出同一值", () => {
    expect(parseShareToken("https://xiaofenshen.com/share/a/tok-abc?ref=x")).toBe("tok-abc");
    expect(parseShareToken("/share/a/tok-abc")).toBe("tok-abc");
    expect(parseShareToken("tok-abc")).toBe("tok-abc");
  });
});
