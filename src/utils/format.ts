/** 将 yt-dlp 错误消息转换为用户友好的提示 */
export const formatError = (raw: string): string => {
  if (/Unsupported URL/i.test(raw)) return "该平台暂不支持，请检查链接是否正确";
  if (/is not a valid URL/i.test(raw)) return "无效的链接地址";
  if (/Video unavailable/i.test(raw)) return "视频不可用，可能已被删除或设为私享";
  if (/Private video/i.test(raw)) return "该视频为私享视频，需要登录才能访问";
  if (/HTTP Error 403/i.test(raw)) return "访问被拒绝 (403)，可能需要配置 Cookie 或代理";
  if (/HTTP Error 404/i.test(raw)) return "资源不存在 (404)，请检查链接是否正确";
  if (/HTTP Error 429/i.test(raw)) return "请求过于频繁 (429)，请稍后再试";
  if (/No video formats found/i.test(raw)) return "未找到可用的视频格式";
  if (/Unable to download webpage/i.test(raw)) return "无法访问页面，请检查网络连接或代理设置";
  if (/urlopen error|Connection refused|timed out/i.test(raw)) return "网络连接失败，请检查网络或代理设置";
  // 清理 ERROR: [extractor] id: 前缀
  return raw.replace(/^ERROR:\s*(\[.*?\]\s*\w+:\s*)?/i, "").trim() || raw;
};

/** 格式化文件大小为可读字符串（B / KB / MB / GB） */
export const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};
