import { defineStore } from "pinia";

export const useStatusStore = defineStore("status", () => {
  /** Cookie 设置弹窗 */
  const showCookieModal = ref(false);

  return {
    showCookieModal,
  };
});
