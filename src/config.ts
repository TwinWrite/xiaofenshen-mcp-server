export type AppConfig = {
  webOrigin: string;
  apiBaseUrl: string;
  newsNowBaseUrl: string;
  newsNowTimeoutMs: number;
  fetchTimeoutMs: number;
};

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    webOrigin: stripSlash(env.XIAOFENSHEN_WEB_ORIGIN ?? "https://xiaofenshen.com"),
    apiBaseUrl: stripSlash(env.XIAOFENSHEN_API_BASE_URL ?? "https://api.xiaofenshen.com"),
    newsNowBaseUrl: stripSlash(env.NEWSNOW_BASE_URL ?? "https://newsnow.busiyi.world"),
    newsNowTimeoutMs: Number(env.NEWSNOW_TIMEOUT_MS ?? 8000) || 8000,
    fetchTimeoutMs: Number(env.FETCH_TIMEOUT_MS ?? 15000) || 15000,
  };
}
