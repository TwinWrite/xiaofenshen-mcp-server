import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { SsrfError } from "./errors.js";

/**
 * 开放 MCP 抓取的 SSRF 护栏（口径对齐小分身 url-validation）。
 *
 * 模型可把任意 URL 交给 fetch_url。若不去掉私网/回环/IMDS，攻击者就能让
 * MCP 进程去读 `169.254.169.254` 或阿里云 `100.100.100.200` 元数据。
 *
 * Defences applied (each closes a distinct bypass):
 *
 * 1. **Scheme allowlist** — only `http:` / `https:`. Rejects `file://`,
 *    `ftp://`, `gopher://`, etc., which `z.string().url()` happily accepts.
 *
 * 2. **No URL-embedded credentials** — `https://attacker:pw@…` would leak
 *    those creds to the destination and is never a legitimate caller intent.
 *
 * 3. **IP-literal CIDR check** — if the host is a numeric IPv4 / IPv6
 *    literal, it goes straight through the reserved-range table without a
 *    DNS round-trip. This catches `http://127.0.0.1/`,
 *    `http://169.254.169.254/`, `http://100.100.100.200/`,
 *    `http://[::1]/`, `http://[fe80::1]/`, and the IPv4-mapped IPv6 form
 *    `http://[::ffff:127.0.0.1]/`.
 *
 * 4. **DNS-resolution then CIDR check** — for hostnames, every A/AAAA record
 *    returned by the resolver is checked, and the URL is rejected if *any*
 *    record is in a reserved range. The all-records rule closes the
 *    "the attacker's authoritative server returns both a public and a
 *    private record in the same RR set" trick.
 *
 *    Residual risk: a TOCTOU window between this lookup and the TCP connect
 *    syscall lets a hostile authoritative nameserver flip the answer in
 *    between — the classic DNS-rebinding attack. The bulletproof fix is to
 *    install a custom undici dispatcher whose `connect` hook re-runs the
 *    CIDR check against the resolved IP and refuses if it changed. That is
 *    a meaningfully larger surgery (undici's Agent API, pooled connections,
 *    HTTPS SNI considerations) and is deliberately out of scope for this
 *    patch. The mitigation here closes the trivial-hostname case which is
 *    where the publicly-known exploit chains live. NOTE: `undici` is now a
 *    direct dependency (used by `infra/web-fetch` for proxy support), so the
 *    connect-hook dispatcher is a concrete, lower-cost follow-up now.
 *
 * 5. **Per-hop redirect re-validation** — `infra/web-fetch/web-content-fetcher.ts`
 *    fetches with `redirect: "manual"` and re-runs `assertPublicHttpUrl` on
 *    every `Location` before following it (and never issues a request to a
 *    hop that fails validation). This supersedes the old `redirect: "error"`
 *    posture: it still blocks a 302 from a public host to a private IP, while
 *    also following legitimate redirects instead of refusing them outright.
 *
 * The blocked CIDR table covers RFC 1122 (0.0.0.0/8), RFC 1918 private
 * (10/8, 172.16/12, 192.168/16), RFC 6598 CGNAT (100.64/10 — Alibaba IMDS
 * lives in here at 100.100.100.200), loopback (127/8), link-local
 * (169.254/16 — the universal IMDS prefix), IETF protocol assignments
 * (192.0.0/24), TEST-NET-1/2/3 documentation ranges (192.0.2/24,
 * 198.51.100/24, 203.0.113/24), 6to4 anycast (192.88.99/24), benchmarking
 * (198.18/15), multicast (224/4), and the future-use reserved (240/4) plus
 * the limited-broadcast address. IPv6 covers the unspecified `::`, loopback
 * `::1`, IPv4-mapped `::ffff:0:0/96` (unwrapped and re-checked), unique-
 * local `fc00::/7` (RFC 4193), link-local `fe80::/10` (RFC 4291) and the
 * multicast `ff00::/8` block. NAT64 `64:ff9b::/96` and Teredo `2001::/32`
 * are left through on the grounds that they're public-internet by design
 * — anything routed via them must terminate on a public IPv4.
 */

export type ResolvedAddress = { address: string; family: number };

export type UrlValidatorDeps = {
  /**
   * Hostname → address records. Defaults to `dns.promises.lookup(h, { all: true, verbatim: true })`.
   * Tests inject a synchronous fake so they don't hit the real resolver.
   */
  resolver?: (hostname: string) => Promise<ResolvedAddress[]>;
};

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

const BLOCKED_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "broadcasthost",
]);

const BLOCKED_HOSTNAME_SUFFIXES: ReadonlyArray<string> = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
];

function ipv4ToUint32(addr: string): number {
  const parts = addr.split(".");
  if (parts.length !== 4) {
    throw new SsrfError(`Invalid IPv4 address: ${addr}`);
  }
  let acc = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) {
      throw new SsrfError(`Invalid IPv4 octet in: ${addr}`);
    }
    const n = Number(p);
    if (n < 0 || n > 255) {
      throw new SsrfError(`IPv4 octet out of range in: ${addr}`);
    }
    acc = ((acc << 8) | n) >>> 0;
  }
  return acc;
}

type Cidr4 = { base: number; mask: number; label: string };

function makeCidr(label: string, cidr: string): Cidr4 {
  const slash = cidr.indexOf("/");
  const prefix = Number(cidr.slice(slash + 1));
  const base = ipv4ToUint32(cidr.slice(0, slash));
  // Special-case prefix=0 because the JS shift `<< 32` is a no-op.
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { label, base: (base & mask) >>> 0, mask };
}

const BLOCKED_IPV4: ReadonlyArray<Cidr4> = [
  makeCidr("this-network (RFC 1122)", "0.0.0.0/8"),
  makeCidr("private-use (RFC 1918)", "10.0.0.0/8"),
  makeCidr("shared-address space / CGNAT (RFC 6598) — covers Alibaba Cloud ECS IMDS at 100.100.100.200", "100.64.0.0/10"),
  makeCidr("loopback (RFC 1122)", "127.0.0.0/8"),
  makeCidr("link-local (RFC 3927) — AWS / GCE / Azure IMDS at 169.254.169.254", "169.254.0.0/16"),
  makeCidr("private-use (RFC 1918)", "172.16.0.0/12"),
  makeCidr("IETF protocol assignments (RFC 6890)", "192.0.0.0/24"),
  makeCidr("TEST-NET-1 documentation (RFC 5737)", "192.0.2.0/24"),
  makeCidr("6to4 anycast (RFC 7526)", "192.88.99.0/24"),
  makeCidr("private-use (RFC 1918)", "192.168.0.0/16"),
  makeCidr("benchmarking (RFC 2544)", "198.18.0.0/15"),
  makeCidr("TEST-NET-2 documentation (RFC 5737)", "198.51.100.0/24"),
  makeCidr("TEST-NET-3 documentation (RFC 5737)", "203.0.113.0/24"),
  makeCidr("multicast (RFC 5771)", "224.0.0.0/4"),
  makeCidr("reserved for future use (RFC 1112 §4)", "240.0.0.0/4"),
];

const IPV4_BROADCAST = 0xffffffff;

function ipv4Block(addr: string): string | null {
  let value: number;
  try {
    value = ipv4ToUint32(addr);
  } catch (err) {
    return `unparseable IPv4 literal (${(err as Error).message})`;
  }
  if (value === IPV4_BROADCAST) return "limited broadcast 255.255.255.255 (RFC 919)";
  for (const cidr of BLOCKED_IPV4) {
    if ((value & cidr.mask) >>> 0 === cidr.base) {
      return `${addr} is in ${cidr.label}`;
    }
  }
  return null;
}

function expandIPv6(raw: string): string[] | null {
  // Strip zone-id suffix ("fe80::1%eth0").
  const noZone = raw.split("%")[0] ?? "";
  // Embedded IPv4 form: e.g. "::ffff:192.0.2.1" or "2002:c000:0204::".
  // We only deal with the trailing-dotted-quad case; everything else is
  // pure hex groups.
  const dotIdx = noZone.indexOf(".");
  let head = noZone;
  let tailV4Groups: string[] = [];
  if (dotIdx >= 0) {
    // Find the last ':' before the dotted-quad starts.
    const lastColon = noZone.lastIndexOf(":", dotIdx);
    if (lastColon < 0) return null;
    head = noZone.slice(0, lastColon + 1).replace(/:$/, "");
    const v4 = noZone.slice(lastColon + 1);
    let v4int: number;
    try {
      v4int = ipv4ToUint32(v4);
    } catch {
      return null;
    }
    const hi = (v4int >>> 16) & 0xffff;
    const lo = v4int & 0xffff;
    tailV4Groups = [hi.toString(16), lo.toString(16)];
    // Re-attach the synthesised hex groups so the `head` reflects the full
    // 8-group form for the zero-fill pass below.
    head = head.length === 0 ? tailV4Groups.join(":") : `${head}:${tailV4Groups.join(":")}`;
    tailV4Groups = [];
  }
  // Handle the "::" zero-run.
  const dcIdx = head.indexOf("::");
  let groups: string[];
  if (dcIdx === -1) {
    groups = head.split(":");
    if (groups.length !== 8) return null;
  } else {
    const left = head.slice(0, dcIdx);
    const right = head.slice(dcIdx + 2);
    const leftGroups = left === "" ? [] : left.split(":");
    const rightGroups = right === "" ? [] : right.split(":");
    const missing = 8 - leftGroups.length - rightGroups.length;
    if (missing < 0) return null;
    groups = [
      ...leftGroups,
      ...Array<string>(missing).fill("0"),
      ...rightGroups,
    ];
  }
  if (groups.length !== 8) return null;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
  }
  return groups.map((g) => g.toLowerCase().padStart(4, "0"));
}

function ipv6Block(raw: string): string | null {
  const groups = expandIPv6(raw.toLowerCase());
  if (!groups) return `unparseable IPv6 literal ${raw}`;
  const joined = groups.join(":");
  // Unspecified ::
  if (groups.every((g) => g === "0000")) return "IPv6 unspecified ::";
  // Loopback ::1
  if (
    groups.slice(0, 7).every((g) => g === "0000") &&
    groups[7] === "0001"
  ) {
    return "IPv6 loopback ::1";
  }
  // IPv4-mapped ::ffff:0:0/96 — unwrap the embedded 32 bits and re-run the IPv4 check.
  if (
    groups.slice(0, 5).every((g) => g === "0000") &&
    groups[5] === "ffff"
  ) {
    const hi = parseInt(groups[6] ?? "0", 16);
    const lo = parseInt(groups[7] ?? "0", 16);
    const dotted = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join(".");
    const v4Reason = ipv4Block(dotted);
    if (v4Reason) return `IPv4-mapped IPv6 ${joined} → ${v4Reason}`;
    return null;
  }
  // IPv4-compatible ::a.b.c.d (deprecated by RFC 4291 but still parseable; the
  // top 80 bits are zero and the bottom 32 are the embedded IPv4).
  if (
    groups.slice(0, 5).every((g) => g === "0000") &&
    groups[5] === "0000"
  ) {
    const hi = parseInt(groups[6] ?? "0", 16);
    const lo = parseInt(groups[7] ?? "0", 16);
    if ((hi | lo) !== 0) {
      const dotted = [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join(".");
      const v4Reason = ipv4Block(dotted);
      if (v4Reason) return `IPv4-compatible IPv6 ${joined} → ${v4Reason}`;
      return "IPv4-compatible IPv6 addresses are deprecated (RFC 4291 §2.5.5.1)";
    }
  }
  // Unique-local fc00::/7 — first 7 bits are 1111110, i.e. the leading hex
  // group's top byte is 0xfc or 0xfd.
  {
    const firstByte = parseInt((groups[0] ?? "0000").slice(0, 2), 16);
    if ((firstByte & 0xfe) === 0xfc) return `IPv6 unique-local ${joined} (RFC 4193)`;
  }
  // Link-local fe80::/10 — first 10 bits are 1111111010, the leading hex
  // group is in [fe80, febf].
  {
    const first16 = parseInt(groups[0] ?? "0000", 16);
    if ((first16 & 0xffc0) === 0xfe80) return `IPv6 link-local ${joined} (RFC 4291)`;
  }
  // Multicast ff00::/8 — leading byte is 0xff.
  {
    const firstByte = parseInt((groups[0] ?? "0000").slice(0, 2), 16);
    if (firstByte === 0xff) return `IPv6 multicast ${joined} (RFC 4291)`;
  }
  // 2001:db8::/32 documentation block.
  if (groups[0] === "2001" && groups[1] === "0db8") {
    return `IPv6 documentation prefix ${joined} (RFC 3849)`;
  }
  return null;
}

function classifyHostnameLiteral(host: string): string | null {
  const family = isIP(host);
  if (family === 4) return ipv4Block(host);
  if (family === 6) return ipv6Block(host);
  // The hostname might still be a non-canonical numeric form (a single
  // 32-bit decimal like "2130706433" for 127.0.0.1, or a partial
  // dotted-quad like "127.1"). Node's `isIP` returns 0 for those, but the
  // underlying C resolver accepts them — `dns.lookup` would dutifully
  // resolve "127.1" to 127.0.0.1. Reject any host that's all-digit or
  // matches a partial-dotted-quad pattern to close that bypass without
  // depending on what `getaddrinfo` happens to do today.
  if (/^[0-9]+$/.test(host)) {
    return `numeric-only host "${host}" (rejecting potential octal/decimal IPv4 alias)`;
  }
  if (/^[0-9]+(\.[0-9]+){1,2}$/.test(host)) {
    return `partial dotted-quad host "${host}" (rejecting potential abbreviated IPv4)`;
  }
  // Hex-prefixed `0x…` forms that getaddrinfo accepts on glibc.
  if (/^0x[0-9a-f]+$/i.test(host) || /^0[0-7]+$/.test(host)) {
    return `non-decimal numeric host "${host}" (rejecting potential hex/octal IPv4 alias)`;
  }
  return null;
}

function isBlockedHostname(host: string): boolean {
  const lower = host.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (lower === suffix.slice(1) || lower.endsWith(suffix)) return true;
  }
  return false;
}

async function defaultResolver(host: string): Promise<ResolvedAddress[]> {
  // `all: true` returns every A and AAAA record; `verbatim: true` skips the
  // libc-level reordering so we see exactly what the resolver returned. The
  // hostname is the URL's parsed `hostname`, which the WHATWG URL parser has
  // already lower-cased and punycoded for IDN.
  return dns.lookup(host, { all: true, verbatim: true });
}

/**
 * Parse and validate the URL. Throws `SsrfError` (which the global
 * error handler maps to HTTP 400 / a `VALIDATION` job-result) on any rejected
 * input; returns the parsed `URL` on success so the caller can pass it
 * straight to `fetch`.
 */
export async function assertPublicHttpUrl(
  raw: string,
  deps: UrlValidatorDeps = {},
): Promise<URL> {
  const { resolver = defaultResolver } = deps;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(`Invalid URL: ${JSON.stringify(raw)}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfError(
      `Refusing to fetch URL with scheme ${url.protocol.replace(/:$/, "")}; only http and https are allowed.`,
    );
  }
  if (url.username !== "" || url.password !== "") {
    throw new SsrfError("URL must not embed userinfo (user:password@host).");
  }
  // `URL.hostname` for `[::1]` returns `[::1]` *with* brackets in some Node
  // versions and without in others. Normalise.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "") {
    throw new SsrfError("URL is missing a hostname.");
  }
  if (isBlockedHostname(host)) {
    throw new SsrfError(`Refusing to fetch reserved hostname "${host}".`);
  }
  const literalReason = classifyHostnameLiteral(host);
  if (literalReason !== null) {
    throw new SsrfError(`Blocked URL host: ${literalReason}.`);
  }
  // Not an IP literal — resolve and check every record.
  if (isIP(host) === 0) {
    let resolved: ResolvedAddress[];
    try {
      resolved = await resolver(host);
    } catch (err) {
      throw new SsrfError(
        `Failed to resolve hostname "${host}": ${(err as Error).message}`,
      );
    }
    if (resolved.length === 0) {
      throw new SsrfError(`Hostname "${host}" resolved to no addresses.`);
    }
    for (const rec of resolved) {
      const reason =
        rec.family === 6 ? ipv6Block(rec.address) : ipv4Block(rec.address);
      if (reason !== null) {
        throw new SsrfError(
          `Hostname "${host}" resolves to a reserved address: ${reason}.`,
        );
      }
    }
  }
  return url;
}

// Exported for unit tests so the per-family CIDR table can be exercised in
// isolation without spinning up the full URL parser.
export const __testing = { ipv4Block, ipv6Block, expandIPv6, classifyHostnameLiteral };
