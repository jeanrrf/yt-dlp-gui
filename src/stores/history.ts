import { defineStore } from "pinia";

const MAX_HISTORY = 50;

export const useHistoryStore = defineStore("history", () => {
  const urls = ref<string[]>([]);

  /** 添加一条成功获取过的链接（去重，最新在前） */
  const add = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const idx = urls.value.indexOf(trimmed);
    if (idx !== -1) urls.value.splice(idx, 1);
    urls.value.unshift(trimmed);
    if (urls.value.length > MAX_HISTORY) urls.value.length = MAX_HISTORY;
  };

  /** 清空所有历史 */
  const clear = () => {
    urls.value = [];
  };

  return { urls, add, clear };
}, {
  persist: true,
});
