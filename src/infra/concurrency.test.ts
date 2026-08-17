import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency.js";

describe("mapWithConcurrency", () => {
  it("按输入顺序返回，且不超过并发上限", async () => {
    // 条件：4 个任务、并发 2；预期：结果顺序不变，峰值并发 ≤ 2。
    let inflight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([10, 20, 30, 40], 2, async (n) => {
      inflight++;
      peak = Math.max(peak, inflight);
      await Promise.resolve();
      inflight--;
      return n * 2;
    });
    expect(out).toEqual([20, 40, 60, 80]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
