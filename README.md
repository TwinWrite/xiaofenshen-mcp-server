# 小分身公开 MCP

把小分身**已经免登录**的只读接口转成 MCP 工具，给 Cursor、Claude Desktop 等外部 Agent 用。

本仓库是公开的薄客户端：只保存工具契约和 HTTP 转发。业务数据与实现都在小分身线上服务，这里不复制抓取、计费或分身逻辑。

## 当前开放

| 工具 | 上游 |
| --- | --- |
| `read_public_share` | `GET /api/share/:token` |
| `list_image_prompt_templates` | `GET /api/image-prompt-templates` |
| `get_product_docs` | `GET /llms.txt`、`GET /docs/<slug>.md` |

这三条产品侧本来就不挂登录。MCP 不新增鉴权，也不扩大可读范围。

## 明确不做（本版本）

热点、网页/微信抓取、分身对话、记忆、生图、公众号搜号等，都要用户身份或付费凭据。后续会走**用户 token 授权**，再在小分身加稳定 API，本仓库只增加对应工具名和转发，不把实现搬过来。

## 使用

需要 Node 22+。

```bash
pnpm install
pnpm test
pnpm build
```

Cursor `mcp.json` 示例：

```json
{
  "mcpServers": {
    "xiaofenshen": {
      "command": "npx",
      "args": ["-y", "github:TwinWrite/xiaofenshen-mcp-server"]
    }
  }
}
```

| 环境变量 | 默认 |
| --- | --- |
| `XIAOFENSHEN_WEB_ORIGIN` | `https://xiaofenshen.com` |
| `XIAOFENSHEN_API_BASE_URL` | `https://api.xiaofenshen.com` |
