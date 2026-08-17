import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("缺省回退生产主域与公开 NewsNow demo", () => {
    const cfg = loadConfig({});
    expect(cfg.webOrigin).toBe("https://xiaofenshen.com");
    expect(cfg.apiBaseUrl).toBe("https://api.xiaofenshen.com");
    expect(cfg.newsNowBaseUrl).toBe("https://newsnow.busiyi.world");
  });

  it("去掉 origin 尾斜杠", () => {
    const cfg = loadConfig({
      XIAOFENSHEN_WEB_ORIGIN: "https://example.com/",
      XIAOFENSHEN_API_BASE_URL: "https://api.example.com///",
    });
    expect(cfg.webOrigin).toBe("https://example.com");
    expect(cfg.apiBaseUrl).toBe("https://api.example.com");
  });
});
