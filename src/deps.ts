import type { AppConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { createNewsNowClient, type NewsNowClient } from "./infra/newsnow.js";
import type { FetchPageDeps } from "./infra/fetch-page.js";
import { createXiaofenshenClient, type XiaofenshenClient } from "./infra/xiaofenshen-api.js";

export type AppDeps = {
  config: AppConfig;
  newsNow: NewsNowClient;
  fetchPageDeps: FetchPageDeps;
  api: XiaofenshenClient;
};

export function createDefaultDeps(env: NodeJS.ProcessEnv = process.env): AppDeps {
  const config = loadConfig(env);
  return {
    config,
    newsNow: createNewsNowClient({
      getBaseUrl: () => config.newsNowBaseUrl,
      getTimeoutMs: () => config.newsNowTimeoutMs,
    }),
    fetchPageDeps: { timeoutMs: config.fetchTimeoutMs },
    api: createXiaofenshenClient({ apiBaseUrl: config.apiBaseUrl }),
  };
}
