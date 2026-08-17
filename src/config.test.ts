import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("缺省指向生产站点与 API 子域", () => {
    // 条件：空环境；预期：web/api 用生产默认值。
    expect(loadConfig({})).toEqual({
      webOrigin: "https://xiaofenshen.com",
      apiBaseUrl: "https://api.xiaofenshen.com",
    });
  });

  it("去掉 origin 尾斜杠", () => {
    expect(
      loadConfig({
        XIAOFENSHEN_WEB_ORIGIN: "https://example.com/",
        XIAOFENSHEN_API_BASE_URL: "https://api.example.com///",
      }),
    ).toEqual({
      webOrigin: "https://example.com",
      apiBaseUrl: "https://api.example.com",
    });
  });
});
