export type AppConfig = {
  webOrigin: string;
  apiBaseUrl: string;
};

function stripSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    webOrigin: stripSlash(env.XIAOFENSHEN_WEB_ORIGIN ?? "https://xiaofenshen.com"),
    apiBaseUrl: stripSlash(env.XIAOFENSHEN_API_BASE_URL ?? "https://api.xiaofenshen.com"),
  };
}
