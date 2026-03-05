import { defineStore } from "pinia";

export const useSettingStore = defineStore("setting", () => {
  /** 主题模式: auto 跟随系统, light 亮色, dark 暗色 */
  const themeMode = ref<"auto" | "light" | "dark">("auto");

  /** 默认下载目录 */
  const downloadDir = ref("");

  /** Cookie 模式: none 不使用, text 手动输入, file 文件读取 */
  const cookieMode = ref<"none" | "text" | "file">("none");

  /** Cookie 文本内容（Netscape 格式） */
  const cookieText = ref("");

  /** Cookie 文件路径 */
  const cookieFile = ref("");

  return {
    themeMode,
    downloadDir,
    cookieMode,
    cookieText,
    cookieFile,
  };
}, {
  persist: true,
});
