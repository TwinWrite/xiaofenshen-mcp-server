import { describe, expect, it } from "vitest";
import {
  checkNaturalnessViolations,
  NATURALNESS_TABOO_PHRASES,
  NATURALNESS_TEXTBOOK_OPENINGS,
  WRITING_STANDARDS,
} from "./naturalness.js";

describe("checkNaturalnessViolations", () => {
  it("干净正文零违规", () => {
    // 条件：符合禁区规范的正文；预期：无任何违规。
    const result = checkNaturalnessViolations(
      "下午的雨说来就来，我把电脑合上，看着窗外发了会呆。那种「什么都不用做」的片刻，最近很少有了。",
    );
    expect(result).toEqual({ violations: [], violationKinds: 0, taboosHit: [] });
  });

  it("逐类命中八类禁区", () => {
    // 条件：正文集中触犯八类禁区；预期：每类都被识别。
    const text =
      "在当今 AI 飞速发展的时代，说白了：写作很重要——这是“公认”的。\n" +
      "## 小标题\n- 第一点\n首先，我们要明确目标。";
    const result = checkNaturalnessViolations(text);
    expect(result.violations.map((v) => v.kind).sort()).toEqual(
      [
        "bullet_list",
        "colon",
        "dash",
        "double_quote",
        "markdown_heading",
        "structured_transition",
        "taboo_phrase",
        "textbook_opening",
      ].sort(),
    );
    expect(result.taboosHit).toEqual(["说白了"]);
  });

  it("URL 冒号与「最后一天」不误报", () => {
    const result = checkNaturalnessViolations(
      "我把链接 https://example.com/a 发给了他，那是假期的最后一天。",
    );
    expect(result.violationKinds).toBe(0);
  });

  it("词表出现在写作标准正文里，避免两边漂移", () => {
    for (const phrase of [...NATURALNESS_TABOO_PHRASES, ...NATURALNESS_TEXTBOOK_OPENINGS]) {
      expect(WRITING_STANDARDS).toContain(phrase);
    }
  });
});
