/** 可注入的 GET，测试不打真实网络。 */
export type HttpGet = (url: string) => Promise<{ status: number; text: string }>;

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function getJson(http: HttpGet, url: string): Promise<unknown> {
  const res = await http(url);
  if (res.status >= 400) {
    throw new UpstreamError(`HTTP ${res.status}: ${url}`, res.status);
  }
  try {
    return JSON.parse(res.text) as unknown;
  } catch {
    throw new UpstreamError(`上游返回了非 JSON: ${url}`);
  }
}

export async function getText(http: HttpGet, url: string): Promise<string> {
  const res = await http(url);
  if (res.status >= 400) {
    throw new UpstreamError(`HTTP ${res.status}: ${url}`, res.status);
  }
  return res.text;
}

export const defaultHttpGet: HttpGet = async (url) => {
  const res = await fetch(url, {
    headers: { Accept: "application/json, text/plain, text/markdown, */*" },
  });
  return { status: res.status, text: await res.text() };
};
