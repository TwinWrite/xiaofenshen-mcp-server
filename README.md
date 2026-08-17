<p align="center">
  <a href="https://xiaofenshen.com">
    <img
      src="https://xiaofenshen.com/brand/xiaofenshen.svg"
      alt="小分身 TwinWrite Logo"
      width="128"
      height="128"
    />
  </a>
</p>

<h1 align="center">小分身 TwinWrite</h1>

<p align="center">
  <strong>官方网站：<a href="https://xiaofenshen.com">https://xiaofenshen.com</a></strong><br />
  训练一个会越来越像你的写手分身。5 分钟，长出一个跟你写得一样的人。
</p>

<p align="center">
  <a href="https://xiaofenshen.com">官网</a>
  ·
  <a href="https://xiaofenshen.com/intro">产品介绍</a>
  ·
  <a href="https://xiaofenshen.com/docs">帮助文档</a>
  ·
  <a href="https://xiaofenshen.com/llms.txt">llms.txt</a>
</p>

# 小分身公开 MCP

这是 [小分身](https://xiaofenshen.com)（TwinWrite）的公开 MCP 仓库，把已经免登录的只读接口转成 MCP 工具，给 Cursor、Claude Desktop 等外部 Agent 使用。

## 小分身是什么

[小分身](https://xiaofenshen.com) 是一个通过对话、长期记忆和「造梦」持续进化的个人 AI 创作分身。官网：[xiaofenshen.com](https://xiaofenshen.com)。

你通过对话与训练告诉它你的语气、句式与偏好，它再用你的口吻帮你写下一篇。你可以创建多个分身，各自专注不同的创作场景；随着对话、记忆与反馈不断积累，它对你的理解会越来越深，输出也越来越像你本人。

常见用法是模仿你的风格写公众号、小红书等自媒体内容：在对话里粘贴代表作或直接训练，让分身学你的表达，再把 AI 写出来的稿子改得不像 AI、更像你本人。

本仓库是公开的薄客户端：只保存工具契约和 HTTP 转发。业务数据与实现都在小分身线上服务（[xiaofenshen.com](https://xiaofenshen.com)），这里不复制抓取、计费或分身逻辑。

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

## 相关链接

- 官网：https://xiaofenshen.com
- 产品介绍：https://xiaofenshen.com/intro
- 帮助文档：https://xiaofenshen.com/docs
- 给模型看的站点索引：https://xiaofenshen.com/llms.txt
