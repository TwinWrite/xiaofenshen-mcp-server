import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, errorResult } from "../mcp-result.js";
import { checkNaturalnessViolations } from "../infra/naturalness.js";

export async function executeCheckWritingNaturalness(input: {
  text: string;
}): Promise<CallToolResult> {
  if (!input.text.trim()) return errorResult("text 不能为空");
  const result = checkNaturalnessViolations(input.text);
  return jsonResult({
    ok: true,
    clean: result.violationKinds === 0,
    ...result,
  });
}

export const CHECK_NATURALNESS_DESCRIPTION =
  "按小分身全局写作标准检测正文是否踩绝对禁区（套话、小标题、bullet、冒号/破折号/双引号、踩雷词、教科书开头）。" +
  "只检测不改写。改写请用 prompt rewrite-natural。协议字段/代码/用户明确要求的列表不要拿来检测。";
