import { defineStore } from "pinia";

export const useStatusStore = defineStore("status", () => {
  /** Cookie 设置弹窗 */
  const showCookieModal = ref(false);

  /** 应用更新弹窗 */
  const showUpdateModal = ref(false);
  const updateVersion = ref("");
  const updateNotes = ref("");

  return {
    showCookieModal,
    showUpdateModal,
    updateVersion,
    updateNotes,
  };
});
