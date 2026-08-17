import { describe, expect, it } from "vitest";
import { extractWechatArticleHtml } from "./wechat-article.js";

describe("extractWechatArticleHtml", () => {
  it("存在 #js_content 容器时只返回容器内 HTML（正文外的导航/引流全部丢弃）", () => {
    // 条件：整页 HTML 含头部导航、#js_content 正文（内含嵌套 div/section）、底部推广；
    // 预期：只返回 #js_content 的 innerHTML，嵌套结构保留，容器外内容一律不出现。
    const html = [
      `<html><head><title>标题</title></head><body>`,
      `<div id="js_top_ad">顶部广告条</div>`,
      `<div class="rich_media_content" id="js_content" style="visibility: hidden;">`,
      `<p>正文第一段。</p>`,
      `<section><div><p>嵌套的正文第二段。</p></div></section>`,
      `</div>`,
      `<div id="js_tags">推荐阅读列表</div>`,
      `<div id="js_pc_qr_code">扫码关注二维码</div>`,
      `</body></html>`,
    ].join("\n");

    const out = extractWechatArticleHtml(html);
    expect(out).toContain("<p>正文第一段。</p>");
    expect(out).toContain("<p>嵌套的正文第二段。</p>");
    expect(out).not.toContain("顶部广告条");
    expect(out).not.toContain("推荐阅读列表");
    expect(out).not.toContain("扫码关注二维码");
  });

  it("id 属性顺序/引号变体（id 在 class 前、单引号）也能命中", () => {
    // 条件：<div id='js_content' class="rich_media_content">（单引号 + id 在前）；
    // 预期：照常提取容器内 HTML。
    const html = `<body><div id='js_content' class="rich_media_content"><p>变体正文</p></div><footer>页脚</footer></body>`;
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("<p>变体正文</p>");
  });

  it("无 #js_content 的普通页面返回 undefined（不误伤非微信页）", () => {
    // 条件：普通网页无微信正文容器；预期：undefined，调用方回退整页转换。
    const html = `<html><body><article><p>普通文章</p></article></body></html>`;
    expect(extractWechatArticleHtml(html)).toBeUndefined();
  });

  it("图片分享页（无 js_content、有 #js_image_desc）回退取图片描述容器", () => {
    // 条件：微信图片分享页正文在 #js_image_desc；预期：取该容器内文本。
    const html = `<body><div id="js_image_desc">图片页的文字描述</div><div id="js_tags">推荐</div></body>`;
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("图片页的文字描述");
  });

  it("容器存在但内容为空白时返回 undefined（空正文交调用方按整页兜底）", () => {
    // 条件：#js_content 内只有空白；预期：不返回空串，返回 undefined。
    const html = `<div id="js_content">   \n  </div><p>容器外内容</p>`;
    expect(extractWechatArticleHtml(html)).toBeUndefined();
  });

  it("残缺 HTML（容器未闭合）容错：取容器起点到文档结尾", () => {
    // 条件：#js_content 开标签后没有对应闭标签（截断的 HTML）；预期：取起点到结尾的内容，不抛错。
    const html = `<div id="js_content"><p>被截断的正文`;
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("<p>被截断的正文");
  });

  it("文字消息页（无 js_content/js_image_desc，正文在内联脚本 window.cgiDataNew.content_noencode）能提取出正文段落", () => {
    // 条件：微信「文字消息」（item_show_type=10）页面正文不在 DOM 里，只存在于
    // <script> 内的 window.cgiDataNew = { ..., content_noencode: '第一段\x0a\x0a第二段' } JS 字符串；
    // 预期：按 \x0a\x0a 分段包成 <p>，可继续走既有 HTML→Markdown 管线。
    const html = [
      `<html><body>`,
      `<script>window.cgiDataNew = {`,
      `  title: '标题',`,
      `  content_noencode: '第一段正文\\x0a\\x0a第二段正文',`,
      `  create_time: '2026-07-02 14:49',`,
      `};</script>`,
      `</body></html>`,
    ].join("\n");
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("<p>第一段正文</p>\n<p>第二段正文</p>");
  });

  it("文字消息正文内单个 \\x0a（同段内换行）转成 <br>，不当成分段", () => {
    // 条件：content_noencode 内含单个 \x0a（段内换行，非段落分隔）；
    // 预期：不拆成两个 <p>，而是同一段内用 <br> 保留换行。
    const html = `<script>window.cgiDataNew = { content_noencode: '第一行\\x0a第二行' };</script>`;
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("<p>第一行<br>第二行</p>");
  });

  it("文字消息正文含转义单引号/反斜杠/HTML 特殊字符时正确还原并转义", () => {
    // 条件：JS 字符串字面量内含转义单引号 \' 、转义反斜杠 \\（还原为单个 \）、以及会与 HTML 冲突的 < & 字符；
    // 预期：\' 还原为 '，\\ 还原为单个反斜杠，< & 在输出 HTML 中被转义，不破坏后续解析。
    const html = `<script>window.cgiDataNew = { content_noencode: '他说\\'好\\'，用了 C:\\\\path，A<B & C' };</script>`;
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("<p>他说'好'，用了 C:\\path，A&lt;B &amp; C</p>");
  });

  it("content_noencode 为空字符串时返回 undefined（交调用方整页兜底）", () => {
    // 条件：文字消息页 content_noencode 是空串（异常/未加载完成）；
    // 预期：不返回空 <p></p>，返回 undefined。
    const html = `<script>window.cgiDataNew = { content_noencode: '' };</script>`;
    expect(extractWechatArticleHtml(html)).toBeUndefined();
  });

  it("同时存在 #js_content 与 cgiDataNew 时优先取 #js_content（不误伤普通图文）", () => {
    // 条件：正常图文页偶然也带有 cgiDataNew 脚本变量；
    // 预期：容器优先级不变，#js_content 命中就直接返回，不走 content_noencode 分支。
    const html = [
      `<div id="js_content"><p>正常图文正文</p></div>`,
      `<script>window.cgiDataNew = { content_noencode: '不应该被使用' };</script>`,
    ].join("\n");
    const out = extractWechatArticleHtml(html);
    expect(out).toBe("<p>正常图文正文</p>");
  });
});
