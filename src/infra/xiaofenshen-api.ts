export type HttpGet = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ status: number; text: string; contentType: string }>;

export class XiaofenshenApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "XiaofenshenApiError";
  }
}

export type XiaofenshenClient = {
  getJson: (path: string) => Promise<unknown>;
  getText: (url: string) => Promise<{ text: string; contentType: string; status: number }>;
};

export function createXiaofenshenClient(opts: {
  apiBaseUrl: string;
  get?: HttpGet;
}): XiaofenshenClient {
  const get: HttpGet =
    opts.get ??
    (async (url) => {
      const res = await fetch(url, {
        headers: { Accept: "application/json, text/plain, text/markdown, */*" },
      });
      return {
        status: res.status,
        text: await res.text(),
        contentType: res.headers.get("content-type") ?? "",
      };
    });

  return {
    async getJson(path: string) {
      const url = `${opts.apiBaseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
      const res = await get(url);
      if (res.status >= 400) {
        throw new XiaofenshenApiError(`小分身 API HTTP ${res.status}: ${path}`, res.status);
      }
      try {
        return JSON.parse(res.text) as unknown;
      } catch {
        throw new XiaofenshenApiError(`小分身 API 非 JSON: ${path}`);
      }
    },
    async getText(url: string) {
      const res = await get(url);
      if (res.status >= 400) {
        throw new XiaofenshenApiError(`HTTP ${res.status}: ${url}`, res.status);
      }
      return { text: res.text, contentType: res.contentType, status: res.status };
    },
  };
}
