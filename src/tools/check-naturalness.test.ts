import { describe, expect, it } from "vitest";
import { executeCheckWritingNaturalness } from "./check-naturalness.js";

describe("executeCheckWritingNaturalness", () => {
  it("空文本失败", async () => {
    const result = await executeCheckWritingNaturalness({ text: "  " });
    expect(result.isError).toBe(true);
  });

  it("干净正文 clean=true", async () => {
    const result = await executeCheckWritingNaturalness({
      text: "雨停了，街上只剩轮胎碾过积水的声音。",
    });
    const text = result.content[0];
    if (text?.type !== "text") throw new Error("expected text");
    expect(JSON.parse(text.text)).toMatchObject({ ok: true, clean: true, violationKinds: 0 });
  });
});
