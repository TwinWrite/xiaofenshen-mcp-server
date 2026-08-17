import { describe, expect, it, vi } from "vitest";
import {
  assertPublicHttpUrl,
  __testing,
  type ResolvedAddress,
} from "./ssrf.js";
import { SsrfError } from "./errors.js";

const { ipv4Block } = __testing;

function fixedResolver(records: ResolvedAddress[]) {
  return vi.fn(async () => records);
}

describe("SSRF 护栏", () => {
  it("拒绝回环、链路本地与阿里云 IMDS 等保留 IPv4", () => {
    // 条件：常见 SSRF 目标；预期：ipv4Block 给出原因。
    expect(ipv4Block("127.0.0.1")).toMatch(/loopback/i);
    expect(ipv4Block("169.254.169.254")).toMatch(/link-local/i);
    expect(ipv4Block("100.100.100.200")).toMatch(/CGNAT|shared-address/i);
    expect(ipv4Block("10.0.0.1")).toMatch(/private-use/i);
    expect(ipv4Block("192.168.1.1")).toMatch(/private-use/i);
  });

  it("允许公网 IPv4", () => {
    expect(ipv4Block("1.1.1.1")).toBeNull();
    expect(ipv4Block("8.8.8.8")).toBeNull();
  });

  it("拒绝 file 协议、localhost 与嵌入凭据", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertPublicHttpUrl("http://localhost/x")).rejects.toThrow(/reserved hostname/i);
    await expect(assertPublicHttpUrl("https://user:pass@example.com/")).rejects.toThrow(/userinfo/i);
  });

  it("主机名解析到私网时拒绝", async () => {
    await expect(
      assertPublicHttpUrl("https://evil.example/", {
        resolver: fixedResolver([{ address: "127.0.0.1", family: 4 }]),
      }),
    ).rejects.toThrow(/reserved address/i);
  });

  it("主机名解析到公网时放行", async () => {
    const url = await assertPublicHttpUrl("https://example.com/a", {
      resolver: fixedResolver([{ address: "93.184.216.34", family: 4 }]),
    });
    expect(url.hostname).toBe("example.com");
  });
});
