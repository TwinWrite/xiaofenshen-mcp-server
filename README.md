# 小分身开放 MCP Server

把小分身（[xiaofenshen](https://github.com/TwinWrite/xiaofenshen)）里**可以无身份提供**的创作能力，沉淀成独立 MCP，供 Cursor、Claude Desktop 等 Agent 调用。

本仓库不代理分身对话、记忆、积分或后台。那些能力绑定用户归属与计费，不能做成开放工具。

## 开放原则

一条能力能进本 MCP，必须同时满足：

1. **不读不写用户私有数据**（分身、对话、记忆、梦境、未分享文章都不行）。
2. **不消耗小分身付费凭据池**（微信 Cookie、即梦、Pexels、按次搜索都不行）。
3. **对中文创作者有独特价值**，而不是再封装一个通用搜索。

对照小分身现役 Agent 工具面与公开 HTTP 路由后，第一波只开放下面这些。

## 第一波工具

| 工具 | 做什么 | 小分身来源 | 为何能开放 |
| --- | --- | --- | --- |
| `hot_topics` | 微博/知乎/抖音/百度等 12 平台热点快照 | `hot_topics` 工具 + NewsNow 采集 | 热搜本身公开；MCP 直连 NewsNow，不经登录 |
| `fetch_url` | 抓取公开网页为 Markdown；微信文章抽 `#js_content` | `fetch_url` + `infra/web-fetch` | 只读公网；带 SSRF 护栏；**不含**微信 Cookie 池 |
| `check_writing_naturalness` | 检测套话、小标题、踩雷词等绝对禁区 | `naturalness-check` | 纯计算 |
| `list_image_prompt_templates` | 列出启用的生图提示词模板 | `GET /api/image-prompt-templates` | 系统级只读，产品本身就不挂登录 |
| `read_public_share` | 读取用户主动公开的文章快照 | `GET /api/share/:token` | 仅公开快照，无对话上下文 |
| `get_product_docs` | 读 `/llms.txt` 或帮助文档 Markdown | Web GEO 资产 | 本就是给 LLM 抓的 |

资源和提示：

- `xiaofenshen://catalog` — 完整开放/封闭/未来目录
- `xiaofenshen://writing-standards` — 写作手法与绝对禁区
- `xiaofenshen://hot-topic-sources` — 12 个平台 id
- prompt `research-hot-topic` — 热点选题调研
- prompt `rewrite-natural` — 按自然表达改写

## 明确不开放

| 能力 | 原因 |
| --- | --- |
| 分身 / 档案 / 风格 | 用户身份与长期设定 |
| 对话、文章卡、资料库 | 私有作品与会话 |
| 记忆、梦境、训练反馈 | 高敏感，且会改分身 |
| 即梦生图、Pexels 配图 | 供应商凭据 + 按次计费 |
| `web_search` | 通用搜索已有公开 MCP；小分身实现绑定计费 |
| 公众号搜号 / 历史文章列表 | 共享 Cookie 池 + 按次扣费 |
| 积分、套餐、支付、Admin | 商业与内部运营 |
| 自动化、连接器 | 代表用户执行副作用 |

以后若要让 Cursor 直接驱动某个分身，应先在小分身发独立 API token，再作为第二阶段接入，不能复用浏览器 cookie。

## 使用

需要 Node 22+。

```bash
pnpm install
pnpm test
pnpm build
```

### Cursor

在 `~/.cursor/mcp.json` 或项目 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "xiaofenshen": {
      "command": "npx",
      "args": ["-y", "github:TwinWrite/xiaofenshen-mcp-server"],
      "env": {
        "NEWSNOW_BASE_URL": "https://your-newsnow.example"
      }
    }
  }
}
```

本地开发：

```json
{
  "mcpServers": {
    "xiaofenshen": {
      "command": "node",
      "args": ["/absolute/path/xiaofenshen-mcp-server/dist/index.js"],
      "env": {
        "XIAOFENSHEN_WEB_ORIGIN": "https://xiaofenshen.com",
        "XIAOFENSHEN_API_BASE_URL": "https://api.xiaofenshen.com"
      }
    }
  }
}
```

### 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `XIAOFENSHEN_WEB_ORIGIN` | `https://xiaofenshen.com` | 帮助文档 / llms.txt |
| `XIAOFENSHEN_API_BASE_URL` | `https://api.xiaofenshen.com` | 公开 API（模板、分享） |
| `NEWSNOW_BASE_URL` | `https://newsnow.busiyi.world` | 热点上游。公开 demo 常被 Cloudflare 拦机房 IP，**生产请自建 NewsNow** |
| `NEWSNOW_TIMEOUT_MS` | `8000` | 单源超时 |
| `FETCH_TIMEOUT_MS` | `15000` | 网页抓取超时 |
| `HTTPS_PROXY` / `HTTP_PROXY` | 空 | 可选出站代理 |

## 安全

`fetch_url` 对齐小分身 SSRF 护栏：只允许公网 `http`/`https`，拒绝回环、RFC1918、链路本地、CGNAT（含阿里云 IMDS `100.100.100.200`）以及 `localhost` 一类保留主机名。重定向每一跳都会重新校验。

抓取结果是不可信外部正文，调用方应按数据而不是指令处理。

## 开发

```bash
pnpm test          # Vitest
pnpm typecheck
pnpm dev           # stdio MCP（给编辑器连）
```

行为变化先补失败测试。工具名必须能从 `src/catalog.ts` 的 `status: "open"` 项机械推导，目录测试会锁住这一点。
