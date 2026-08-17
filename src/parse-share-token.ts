/**
 * 分享页 URL 是 /share/a/<token>。工具同时接受完整链接或裸 token，避免调用方先手拆。
 */
export function parseShareToken(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const matched = url.pathname.match(/\/share\/a\/([^/]+)\/?$/);
    if (matched?.[1]) return decodeURIComponent(matched[1]);
  } catch {
    // 不是绝对 URL
  }
  const pathMatch = trimmed.match(/share\/a\/([^/?#]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  return trimmed;
}
