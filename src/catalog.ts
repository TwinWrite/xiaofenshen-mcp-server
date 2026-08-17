/**
 * 开放 MCP 能力目录。
 *
 * WHY：小分身产品里大量能力绑定分身归属、会话、计费或抓取凭据池，不能原样对外。
 * 本文件是「哪些能开放、哪些明确不开放」的单一真相源；MCP 工具名必须能从
 * status=open 且 mcp.kind=tool 的条目机械推导，避免目录与实现漂移。
 */

export type CapabilityStatus = "open" | "closed" | "future";

export type McpSurface = {
  kind: "tool" | "resource" | "prompt";
  name: string;
};

export type Capability = {
  id: string;
  name: string;
  status: CapabilityStatus;
  /** 为什么开放或为什么不能开放。 */
  reason: string;
  /** 小分身仓库中的来源（路径或系统名），便于回溯。 */
  source: string;
  mcp?: McpSurface;
};

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "hot_topics",
    name: "中文互联网热点快照",
    status: "open",
    reason:
      "数据本身是公开热搜，不绑定用户。MCP 直连 NewsNow，不经小分身登录态。",
    source: "apps/api/src/modules/hot-topics + infra/hot-topics",
    mcp: { kind: "tool", name: "hot_topics" },
  },
  {
    id: "fetch_url",
    name: "公开网页抓取（含微信正文提取）",
    status: "open",
    reason:
      "读取公网 URL 转 Markdown；微信文章只抽 #js_content 等正文容器。带 SSRF 护栏，不含微信 Cookie 池与按篇计费。",
    source: "packages/agent-tools fetch_url + apps/api/src/infra/web-fetch",
    mcp: { kind: "tool", name: "fetch_url" },
  },
  {
    id: "writing_naturalness",
    name: "自然表达 / 去 AI 味校验",
    status: "open",
    reason:
      "纯计算，不依赖用户数据或模型调用。词表对齐小分身全局写作标准的绝对禁区。",
    source: "apps/api/src/agent/naturalness-check.ts + writing-style.md",
    mcp: { kind: "tool", name: "check_writing_naturalness" },
  },
  {
    id: "image_prompt_templates",
    name: "生图提示词模板",
    status: "open",
    reason: "系统级只读资产，小分身 API 本身就不挂登录守卫。",
    source: "apps/api/src/modules/image-prompt-templates",
    mcp: { kind: "tool", name: "list_image_prompt_templates" },
  },
  {
    id: "public_share",
    name: "公开分享文章",
    status: "open",
    reason: "用户主动公开的正文快照，免登录可读；不暴露对话上下文。",
    source: "apps/api/src/modules/growth/public-share.route.ts",
    mcp: { kind: "tool", name: "read_public_share" },
  },
  {
    id: "product_docs",
    name: "产品帮助文档",
    status: "open",
    reason: "站点 /llms.txt 与 /docs/*.md 本就是给 LLM 抓取的公开 GEO 资产。",
    source: "apps/web/lib/llms-txt.ts + apps/web/app/docs",
    mcp: { kind: "tool", name: "get_product_docs" },
  },
  {
    id: "catalog",
    name: "开放能力目录",
    status: "open",
    reason: "让接入方先看清边界，再决定调用哪些工具。",
    source: "xiaofenshen-mcp-server/src/catalog.ts",
    mcp: { kind: "resource", name: "xiaofenshen://catalog" },
  },
  {
    id: "writing_standards",
    name: "全局写作标准",
    status: "open",
    reason: "创作手法与绝对禁区是公开产品原则，适合作为 MCP 资源注入上下文。",
    source: "docs/architecture/systems/writing-style.md",
    mcp: { kind: "resource", name: "xiaofenshen://writing-standards" },
  },
  {
    id: "hot_topic_sources",
    name: "热点平台目录",
    status: "open",
    reason: "12 个固定平台 id，供模型在调用 hot_topics 前查阅。",
    source: "apps/api/src/modules/hot-topics/hot-topics.catalog.ts",
    mcp: { kind: "resource", name: "xiaofenshen://hot-topic-sources" },
  },
  {
    id: "prompt_research_hot_topic",
    name: "热点选题调研",
    status: "open",
    reason: "把热点工具与抓取串成可复用的创作调研提示。",
    source: "docs/product/flows/hot-topics.md",
    mcp: { kind: "prompt", name: "research-hot-topic" },
  },
  {
    id: "prompt_rewrite_natural",
    name: "按自然表达改写",
    status: "open",
    reason: "把写作标准变成可调用的改写提示，而不是再包一层模型。",
    source: "docs/architecture/systems/writing-style.md",
    mcp: { kind: "prompt", name: "rewrite-natural" },
  },
  {
    id: "twins",
    name: "分身 / 档案 / 风格",
    status: "closed",
    reason: "绑定用户归属与长期身份，不是公开资产；开放会泄漏创作身份。",
    source: "apps/api/src/modules/twins",
  },
  {
    id: "conversations",
    name: "对话与 Agent Runtime",
    status: "closed",
    reason: "需要会话、HITL、计费和分身上下文；不是无身份工具面。",
    source: "apps/api/src/agent + modules/conversations",
  },
  {
    id: "memory_dreams",
    name: "记忆与梦境",
    status: "closed",
    reason: "高敏感用户数据，必须鉴权、可审阅、可纠正。",
    source: "apps/api/src/modules/memory + dreams",
  },
  {
    id: "articles_library",
    name: "文章与资料库",
    status: "closed",
    reason: "用户作品私有；仅用户主动分享的快照走 read_public_share。",
    source: "apps/api/src/modules/articles + library",
  },
  {
    id: "training_skills",
    name: "训练反馈与产品 Skill 执行",
    status: "closed",
    reason: "会改分身风格/记忆，且 skill 执行绑定授权快照与工具面。",
    source: "apps/api/src/agent/domains/writing/tools + modules/skills",
  },
  {
    id: "generate_images",
    name: "即梦生图",
    status: "closed",
    reason: "依赖供应商凭据、OSS 与按张计费，不能匿名开放。",
    source: "apps/api/src/agent/domains/writing/tools/generate-images.tool.ts",
  },
  {
    id: "stock_photos",
    name: "Pexels 配图",
    status: "closed",
    reason: "第三方配额与用户归属图库，不适合无身份 MCP。",
    source: "apps/api/src/modules/stock-photos",
  },
  {
    id: "web_search",
    name: "联网搜索",
    status: "closed",
    reason: "通用搜索已有公开 MCP；小分身实现绑定计费，不重复开放。",
    source: "packages/agent-tools/src/web-search",
  },
  {
    id: "wechat_account_crawl",
    name: "公众号搜号 / 历史文章列表",
    status: "closed",
    reason: "消费共享 Cookie 池并按次扣费，匿名开放会打穿凭据与成本。",
    source: "apps/api/src/modules/wechat",
  },
  {
    id: "billing_pay",
    name: "积分、套餐与支付",
    status: "closed",
    reason: "商业与资金面，不属于开放创作工具。",
    source: "apps/api/src/modules/credits + payments; apps/pay",
  },
  {
    id: "automations_connectors",
    name: "自动化与外部账号连接",
    status: "closed",
    reason: "代表用户执行副作用，必须登录与授权。",
    source: "apps/api/src/modules/automations + connectors",
  },
  {
    id: "admin",
    name: "管理后台",
    status: "closed",
    reason: "内部运营面，禁止进入开放 MCP。",
    source: "apps/admin + apps/api/src/modules/admin",
  },
  {
    id: "authenticated_twin_api",
    name: "带身份的分身对话 API",
    status: "future",
    reason:
      "产品尚无面向第三方的 API token。若以后要让 Cursor 直接驱动某个分身，应先在小分身发独立凭证，再作为第二阶段 MCP 接入，不能用 cookie 会话。",
    source: "docs/architecture/systems/auth-identity.md",
  },
];

export type CapabilityId = (typeof CAPABILITIES)[number]["id"];

export function openCapabilities(): Capability[] {
  return CAPABILITIES.filter((item) => item.status === "open");
}

function withMcp(
  item: Capability,
): item is Capability & { mcp: McpSurface } {
  return item.mcp !== undefined;
}

export function mcpToolsFromCatalog(): string[] {
  return CAPABILITIES.filter(withMcp)
    .filter((item) => item.mcp.kind === "tool")
    .map((item) => item.mcp.name);
}

export function mcpResourcesFromCatalog(): string[] {
  return CAPABILITIES.filter(withMcp)
    .filter((item) => item.mcp.kind === "resource")
    .map((item) => item.mcp.name);
}

export function mcpPromptsFromCatalog(): string[] {
  return CAPABILITIES.filter(withMcp)
    .filter((item) => item.mcp.kind === "prompt")
    .map((item) => item.mcp.name);
}
