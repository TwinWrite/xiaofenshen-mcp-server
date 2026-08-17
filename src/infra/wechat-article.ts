/**
 * 微信公众号文章正文容器提取。
 *
 * WHY：微信文章页的正文全部渲染在 #js_content（图片分享页在 #js_image_desc）容器内，
 * 容器外是导航、推荐列表、二维码、点赞在看等与正文无关的页面骨架。
 * 与其抓整页再靠事后清洗剔噪（早期用 LLM 识别删除片段，输出不稳定、已移除），
 * 不如在 HTML→Markdown 之前就只保留正文容器——这也是桌面端
 * we-feather-copilot 抓取公众号文章的同款做法（querySelector('#js_content')）。
 *
 * 识别是内容特征（页面里有没有该容器），不依赖 URL/平台标记，与 extractTitle
 * 的微信来源回退（og:title / h1#activity-name / var msg_title）同属 best-effort 增强。
 *
 * 「文字消息」（公众号后台发表的纯文字动态，item_show_type=10）是第三种模板：
 * 页面**没有** #js_content / #js_image_desc 容器，正文只存在于内联 <script> 里的
 * `window.cgiDataNew.content_noencode` JS 字符串字面量（非法 JSON，用 \x0a 表示换行）。
 * 前两个容器都未命中时才尝试解析这个字段，避免误伤普通图文/图片页。
 */

// 正文容器候选（按优先级）：普通图文 #js_content → 图片分享页 #js_image_desc。
// 属性顺序/引号形式不定，只锚定 id；标签名捕获用于后续的同名标签配平。
const WECHAT_BODY_CONTAINER_RES = [
  /<(div|section)\b[^>]*\bid=["']js_content["'][^>]*>/i,
  /<(div|section)\b[^>]*\bid=["']js_image_desc["'][^>]*>/i,
];

/** `content_noencode: '...'` 字段的起点（单引号包裹的 JS 字符串字面量）。 */
const CONTENT_NOENCODE_RE = /content_noencode\s*:\s*'/;

/**
 * 从单引号 JS 字符串字面量起点扫到匹配的收尾单引号，尊重反斜杠转义
 * （不能在 \' 处提前截断）。返回值仍是「带转义序列」的原始片段，未反解码。
 */
function scanJsStringLiteral(html: string, start: number): string {
  let raw = "";
  let i = start;
  while (i < html.length) {
    const ch = html[i];
    if (ch === "\\") {
      raw += ch + (html[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (ch === "'") break;
    raw += ch;
    i += 1;
  }
  return raw;
}

/** 反解码 JS 字符串转义序列：\xHH / \uHHHH / \n / \t / \\ / \' 等，其余原样去掉反斜杠。 */
function unescapeJsStringLiteral(raw: string): string {
  return raw.replace(/\\(x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|n|t|.)/g, (_, esc: string) => {
    if (esc[0] === "x" || esc[0] === "u") return String.fromCharCode(parseInt(esc.slice(1), 16));
    if (esc === "n") return "\n";
    if (esc === "t") return "\t";
    return esc;
  });
}

/** 转义会与 HTML 解析冲突的字符（正文是纯文本，不需要处理属性引号）。 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 提取「文字消息」页正文：解析 window.cgiDataNew.content_noencode，
 * 按连续 2 个以上 \x0a（段落分隔）切段落，段内单个 \x0a 转 <br> 保留换行；
 * 空正文（未解析到或纯空白）返回 undefined，交调用方按整页兜底。
 */
function extractWechatTextMessageContent(html: string): string | undefined {
  const keyMatch = CONTENT_NOENCODE_RE.exec(html);
  if (!keyMatch) return undefined;
  const start = keyMatch.index + keyMatch[0].length;
  const decoded = unescapeJsStringLiteral(scanJsStringLiteral(html, start));
  const paragraphs = decoded
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`);
  return paragraphs.length > 0 ? paragraphs.join("\n") : undefined;
}

/**
 * 提取微信正文容器的 innerHTML；页面无容器或容器为空白时返回 undefined
 * （由调用方回退整页转换，绝不因提取失败而丢内容）。
 */
export function extractWechatArticleHtml(html: string): string | undefined {
  for (const re of WECHAT_BODY_CONTAINER_RES) {
    const opening = re.exec(html);
    if (!opening) continue;
    const tag = opening[1]?.toLowerCase();
    if (!tag) continue;
    const start = opening.index + opening[0].length;

    // 同名标签深度配平：正文内嵌套同名标签（div 套 div）时不能在首个闭标签就截断。
    const tokenRe = new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi");
    tokenRe.lastIndex = start;
    let depth = 1;
    let token: RegExpExecArray | null;
    while ((token = tokenRe.exec(html)) !== null) {
      if (token[0].startsWith("</")) {
        depth -= 1;
        if (depth === 0) {
          const inner = html.slice(start, token.index).trim();
          if (inner) return inner;
          break; // 容器为空白：试下一个候选容器
        }
      } else if (!token[0].endsWith("/>")) {
        depth += 1;
      }
    }
    // 未配平（截断/畸形 HTML）：容错取容器起点到文档结尾
    if (depth > 0) {
      const rest = html.slice(start).trim();
      if (rest) return rest;
    }
  }
  return extractWechatTextMessageContent(html);
}
