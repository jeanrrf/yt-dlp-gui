import { defineStore } from "pinia";
import { setI18nLocale, resolveLocale } from "@/locales";

export const useSettingStore = defineStore(
  "setting",
  () => {
    const normalizeNonNegative = (value: number, fallback = 0) => {
      const normalized = Number(value);
      return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
    };

    const locale = ref(resolveLocale(""));

    watch(locale, (value) => {
      setI18nLocale(value);
    });

    const themeMode = ref<"auto" | "light" | "dark">("auto");
    const downloadDir = ref("");
    const cookieMode = ref<"none" | "text" | "file" | "browser">("none");
    const cookieText = ref("");
    const cookieFile = ref("");
    const cookieBrowser = ref("chrome");
    const proxy = ref("");
    const outputTemplate = ref("%(title).200s [%(id)s].%(ext)s");
    const concurrentFragments = ref(0);
    const noOverwrites = ref(false);
    const maxConcurrentDownloads = ref(0);
    const maxBatchSize = ref(0);
    const ignoreDuplicateDownloads = ref(true);
    const notifyMode = ref<"none" | "app" | "system" | "all">("system");
    const closeToTray = ref(true);
    const autoCheckUpdate = ref(true);
    const showTaskbarProgress = ref(true);

    watch(
      concurrentFragments,
      (value) => {
        const normalized = normalizeNonNegative(value);
        if (normalized !== value) concurrentFragments.value = normalized;
      },
      { immediate: true },
    );

    watch(
      maxConcurrentDownloads,
      (value) => {
        const normalized = normalizeNonNegative(value);
        if (normalized !== value) maxConcurrentDownloads.value = normalized;
      },
      { immediate: true },
    );

    watch(
      maxBatchSize,
      (value) => {
        const normalized = normalizeNonNegative(value);
        if (normalized !== value) maxBatchSize.value = normalized;
      },
      { immediate: true },
    );

    return {
      locale,
      themeMode,
      downloadDir,
      cookieMode,
      cookieText,
      cookieFile,
      cookieBrowser,
      proxy,
      outputTemplate,
      concurrentFragments,
      noOverwrites,
      maxConcurrentDownloads,
      maxBatchSize,
      ignoreDuplicateDownloads,
      notifyMode,
      closeToTray,
      autoCheckUpdate,
      showTaskbarProgress,
    };
  },
  {
    persist: true,
  },
);
