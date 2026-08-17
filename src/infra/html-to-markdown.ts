/**
 * HTML → Markdown，口径对齐小分身 infra/web-fetch/html-to-markdown。
 */

import TurndownService from "turndown";

const ZERO_WIDTH_RE = /[\u200B\u200C\u200D\u200E\u200F\u2060\u2061\u2062\u2063\uFEFF]/g;

const STRIP_WITH_CONTENT_RE =
  /<(script|style|noscript|iframe|object|embed|nav|header|footer|aside|form|svg|template)\b[\s\S]*?<\/\1>/gi;

export function stripBoilerplate(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "")
    .replace(STRIP_WITH_CONTENT_RE, "");
}

export function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "")
    .replace(/<(script|style|noscript|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  hr: "---",
  emDelimiter: "*",
});

function tidyMarkdown(md: string): string {
  return md.replace(ZERO_WIDTH_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function htmlToMarkdown(html: string): string {
  try {
    const cleaned = stripBoilerplate(html);
    const md = tidyMarkdown(turndown.turndown(cleaned));
    if (md.length === 0) return sanitizeHtml(html);
    return md;
  } catch {
    return sanitizeHtml(html);
  }
}
