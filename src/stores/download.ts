import { defineStore } from "pinia";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, ProgressBarStatus } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import localforage from "localforage";
import type { DownloadTask, DownloadTaskParams } from "@/types";
import { useSettingStore } from "@/stores/setting";
import i18n from "@/locales";

const storage = localforage.createInstance({
  name: "yt-dlp-gui",
  storeName: "downloads",
});

const STORAGE_KEY = "download_tasks";
const PENDING_STORAGE_KEY = "pending_download_tasks";

interface ProgressPayload {
  id: string;
  percent: number;
  speed: string;
  eta: string;
  downloaded: string;
  total: string;
}

interface PendingDownloadTask {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  formatLabel: string;
  createdAt: number;
  params: DownloadTaskParams;
}

interface NotifyOptions {
  inApp?: boolean;
  system?: boolean;
}

export const useDownloadStore = defineStore("download", () => {
  const tasks = ref<DownloadTask[]>([]);
  const pendingTasks = ref<PendingDownloadTask[]>([]);
  const loaded = ref(false);
  let listenersSetup = false;
  const listenerDisposers: Array<() => void> = [];
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let listenerRetryCount = 0;
  const MAX_LISTENER_RETRY = 10;

  const activeCount = computed(
    () => tasks.value.filter((task) => task.status === "downloading").length,
  );

  const isBusyTask = (status: DownloadTask["status"]) =>
    status === "queued" || status === "downloading" || status === "paused";

  const hasDuplicateTask = (url: string) =>
    tasks.value.some((task) => task.url === url && isBusyTask(task.status)) ||
    pendingTasks.value.some((task) => task.url === url);

  const createTaskFromPending = (task: PendingDownloadTask): DownloadTask => ({
    id: task.id,
    url: task.url,
    title: task.title,
    thumbnail: task.thumbnail,
    formatLabel: task.formatLabel,
    status: "downloading",
    percent: 0,
    speed: "",
    eta: "",
    downloaded: "",
    total: "",
    logs: [],
    createdAt: task.createdAt,
    params: task.params,
  });

  const getPlaylistConcurrencyLimit = () => {
    const max = useSettingStore().maxConcurrentDownloads;
    return max > 0 ? max : 2;
  };

  const startTask = async (task: DownloadTask) => {
    task.status = "downloading";
    try {
      await invoke("start_download", {
        params: { id: task.id, ...task.params },
      });
    } catch {
      task.status = "error";
      task.error = i18n.global.t("downloads.startFailed");
    }
  };

  const pumpPendingTasks = async () => {
    while (pendingTasks.value.length > 0 && activeCount.value < getPlaylistConcurrencyLimit()) {
      const next = pendingTasks.value.shift();
      if (!next) break;
      const task = createTaskFromPending(next);
      tasks.value.unshift(task);
      await startTask(task);
    }
  };

  const tryStartNext = async () => {
    const max = useSettingStore().maxConcurrentDownloads;

    while (max <= 0 || activeCount.value < max) {
      const next = tasks.value.find((task) => task.status === "queued");
      if (!next) break;
      await startTask(next);
    }

    await pumpPendingTasks();
  };

  const canStartNow = (): boolean => {
    const max = useSettingStore().maxConcurrentDownloads;
    return max <= 0 || activeCount.value < max;
  };

  const notify = async (title: string, body: string, options: NotifyOptions = {}) => {
    const settingStore = useSettingStore();
    const mode = settingStore.notifyMode;
    if (mode === "none") return;

    const allowInApp = options.inApp ?? true;
    const allowSystem = options.system ?? true;

    if (allowInApp && (mode === "app" || mode === "all")) {
      window.$notification.create({ title, content: body, duration: 5000 });
    }

    if (allowSystem && (mode === "system" || mode === "all")) {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === "granted";
      }
      if (granted) {
        sendNotification({ title, body });
      }
    }
  };

  const saveState = () => {
    if (!loaded.value) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void storage.setItem(STORAGE_KEY, JSON.parse(JSON.stringify(tasks.value)));
      void storage.setItem(PENDING_STORAGE_KEY, JSON.parse(JSON.stringify(pendingTasks.value)));
    }, 500);
  };

  const loadTasks = async () => {
    const savedTasks = await storage.getItem<DownloadTask[]>(STORAGE_KEY);
    let restoredTasks = Array.isArray(savedTasks) ? savedTasks : [];

    for (const task of restoredTasks) {
      if (task.status === "downloading" || task.status === "paused" || task.status === "queued") {
        task.status = "error";
        task.error = i18n.global.t("downloads.appRestarted");
        task.speed = "";
      }
      if (!Array.isArray(task.logs)) task.logs = [];
      if (!task.createdAt) task.createdAt = Date.now();
    }

    const completedWithFile = restoredTasks.filter(
      (task) => task.status === "completed" && task.outputFile,
    );
    if (completedWithFile.length > 0) {
      try {
        const paths = completedWithFile.map((task) => task.outputFile!);
        const exists = await invoke<boolean[]>("check_files_exist", { paths });
        const missingIds = new Set<string>();
        completedWithFile.forEach((task, index) => {
          if (!exists[index]) missingIds.add(task.id);
        });
        if (missingIds.size > 0) {
          restoredTasks = restoredTasks.filter((task) => !missingIds.has(task.id));
        }
      } catch {
        // keep all tasks if existence checks fail
      }
    }

    tasks.value = restoredTasks;

    const savedPending = await storage.getItem<PendingDownloadTask[]>(PENDING_STORAGE_KEY);
    pendingTasks.value = Array.isArray(savedPending) ? savedPending : [];
    loaded.value = true;
  };

  watch([tasks, pendingTasks], saveState, { deep: true });

  const updateTaskbarProgress = () => {
    try {
      if (typeof getCurrentWindow !== "function") return;
    } catch {
      return;
    }

    const settingStore = useSettingStore();
    const appWindow = getCurrentWindow();

    if (!settingStore.showTaskbarProgress) {
      appWindow.setProgressBar({ status: ProgressBarStatus.None });
      return;
    }

    const downloading = tasks.value.filter((task) => task.status === "downloading");
    const paused = tasks.value.filter((task) => task.status === "paused");

    if (downloading.length > 0) {
      const avg = Math.round(
        downloading.reduce((sum, task) => sum + (task.percent || 0), 0) / downloading.length,
      );
      appWindow.setProgressBar({ status: ProgressBarStatus.Normal, progress: avg });
    } else if (paused.length > 0) {
      const avg = Math.round(
        paused.reduce((sum, task) => sum + (task.percent || 0), 0) / paused.length,
      );
      appWindow.setProgressBar({ status: ProgressBarStatus.Paused, progress: avg });
    } else {
      appWindow.setProgressBar({ status: ProgressBarStatus.None });
    }
  };

  const cleanupListeners = () => {
    while (listenerDisposers.length > 0) {
      const dispose = listenerDisposers.pop();
      try {
        dispose?.();
      } catch {
        // ignore cleanup failures
      }
    }
    listenersSetup = false;
  };

  const setupListeners = async () => {
    if (listenersSetup) return;

    while (listenerRetryCount < MAX_LISTENER_RETRY) {
      const disposers: Array<() => void> = [];
      try {
        disposers.push(
          await listen<ProgressPayload>("download-progress", (event) => {
            const task = tasks.value.find((item) => item.id === event.payload.id);
            if (task && task.status === "downloading") {
              task.percent = event.payload.percent;
              task.speed = event.payload.speed;
              task.eta = event.payload.eta;
              if (event.payload.downloaded) task.downloaded = event.payload.downloaded;
              if (event.payload.total) task.total = event.payload.total;
            }
            updateTaskbarProgress();
          }),
        );

        disposers.push(
          await listen<{ id: string; line: string }>("download-log", (event) => {
            const task = tasks.value.find((item) => item.id === event.payload.id);
            if (task) {
              task.logs.push(event.payload.line);
            }
          }),
        );

        disposers.push(
          await listen<{ id: string; outputFile: string }>("download-complete", (event) => {
            const task = tasks.value.find((item) => item.id === event.payload.id);
            if (task) {
              task.status = "completed";
              task.percent = 100;
              task.speed = "";
              if (event.payload.outputFile) task.outputFile = event.payload.outputFile;
              void notify(
                i18n.global.t("downloads.notifyComplete"),
                task.title || i18n.global.t("downloads.notifyCompleteBody"),
                { inApp: false, system: false },
              );
            }
            updateTaskbarProgress();
            void tryStartNext();
          }),
        );

        disposers.push(
          await listen<{ id: string; error: string }>("download-error", (event) => {
            const task = tasks.value.find((item) => item.id === event.payload.id);
            if (task && task.status !== "cancelled") {
              task.status = "error";
              task.error = event.payload.error;
              task.speed = "";
            }
            updateTaskbarProgress();
            void tryStartNext();
          }),
        );

        listenerDisposers.push(...disposers);
        listenersSetup = true;
        listenerRetryCount = 0;
        break;
      } catch (error) {
        for (const dispose of disposers) {
          try {
            dispose();
          } catch {
            // ignore
          }
        }

        listenerRetryCount++;
        if (listenerRetryCount >= MAX_LISTENER_RETRY) {
          console.error(
            "[DownloadStore] Failed to setup listeners after",
            MAX_LISTENER_RETRY,
            "attempts:",
            error,
          );
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000 * 2 ** listenerRetryCount, 10000)),
        );
      }
    }
  };

  const initialize = async () => {
    await loadTasks();
    await setupListeners();
    await tryStartNext();
  };

  onScopeDispose(() => {
    if (saveTimer) clearTimeout(saveTimer);
    cleanupListeners();
  });

  void initialize();

  const addTask = (task: DownloadTask) => {
    const settingStore = useSettingStore();

    if (settingStore.ignoreDuplicateDownloads && hasDuplicateTask(task.url)) {
      return;
    }

    tasks.value.unshift(task);
  };

  const enqueuePlaylistTasks = async (items: PendingDownloadTask[]) => {
    const settingStore = useSettingStore();

    for (const item of items) {
      if (settingStore.ignoreDuplicateDownloads && hasDuplicateTask(item.url)) {
        continue;
      }
      pendingTasks.value.push(item);
    }

    await pumpPendingTasks();
  };

  const pauseTask = async (id: string) => {
    await invoke("pause_download", { id });
    const task = tasks.value.find((item) => item.id === id);
    if (task) {
      task.status = "paused";
      task.speed = "";
    }
    updateTaskbarProgress();
  };

  const resumeTask = async (id: string) => {
    await invoke("resume_download", { id });
    const task = tasks.value.find((item) => item.id === id);
    if (task) {
      task.status = "downloading";
    }
    updateTaskbarProgress();
  };

  const cancelTask = async (id: string) => {
    const pendingIndex = pendingTasks.value.findIndex((task) => task.id === id);
    if (pendingIndex !== -1) {
      pendingTasks.value.splice(pendingIndex, 1);
      return;
    }

    const task = tasks.value.find((item) => item.id === id);
    if (!task) return;

    const wasQueued = task.status === "queued";
    task.status = "cancelled";

    if (!wasQueued) {
      try {
        await invoke("cancel_download", { id, deleteFiles: true });
      } catch {
        // process may already have exited
      }
    }

    updateTaskbarProgress();
    void tryStartNext();
  };

  const retryTask = async (id: string) => {
    const task = tasks.value.find((item) => item.id === id);
    if (!task) return;

    const newId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    task.id = newId;
    task.percent = 0;
    task.speed = "";
    task.eta = "";
    task.downloaded = "";
    task.total = "";
    task.logs = [];
    task.error = undefined;

    if (canStartNow()) {
      await startTask(task);
    } else {
      task.status = "queued";
    }
  };

  const removeTask = (id: string) => {
    const idx = tasks.value.findIndex((task) => task.id === id);
    if (idx !== -1) {
      tasks.value.splice(idx, 1);
      return;
    }

    const pendingIndex = pendingTasks.value.findIndex((task) => task.id === id);
    if (pendingIndex !== -1) pendingTasks.value.splice(pendingIndex, 1);
  };

  const clearFinished = () => {
    tasks.value = tasks.value.filter(
      (task) =>
        task.status !== "completed" && task.status !== "error" && task.status !== "cancelled",
    );
  };

  return {
    tasks,
    loaded,
    activeCount,
    canStartNow,
    addTask,
    enqueuePlaylistTasks,
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    removeTask,
    clearFinished,
  };
});
