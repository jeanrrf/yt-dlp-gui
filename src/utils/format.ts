import i18n from "@/locales";

const t = i18n.global.t;

/** 将错误消息转换为用户友好的提示 */
export const formatError = (raw: string): string => {
  // 解析 Rust 返回的 error key（格式：err_key 或 err_key:detail）
  const errMatch = raw.match(/^(err_[a-z_]+)(?::(.*))?$/);
  if (errMatch) {
    const [, key, detail] = errMatch;
    const i18nKey = `errors.${key}`;
    const translated = t(i18nKey);
    // 如果 i18n 有对应翻译（不等于 key 本身），使用翻译
    if (translated !== i18nKey) {
      return detail ? `${translated}: ${detail}` : translated;
    }
  }

  // yt-dlp 原生错误匹配
  if (/Unsupported URL/i.test(raw)) return t("errors.unsupportedUrl");
  if (/is not a valid URL/i.test(raw)) return t("errors.invalidUrl");
  if (/Video unavailable/i.test(raw)) return t("errors.videoUnavailable");
  if (/Private video/i.test(raw)) return t("errors.privateVideo");
  if (/HTTP Error 403/i.test(raw)) return t("errors.http403");
  if (/HTTP Error 404/i.test(raw)) return t("errors.http404");
  if (/HTTP Error 429/i.test(raw)) return t("errors.http429");
  if (/No video formats found/i.test(raw)) return t("errors.noFormats");
  if (/Unable to download webpage/i.test(raw)) return t("errors.cannotDownload");
  if (/urlopen error|Connection refused|timed out/i.test(raw)) return t("errors.networkError");
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
