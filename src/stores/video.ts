import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { showErrorDialog } from "@/utils/format";
import { useSettingStore } from "@/stores/setting";
import { useStatusStore } from "@/stores/status";
import type { VideoInfo, VideoFormat, PlaylistEntry, DenoStatus } from "@/types";

export const useVideoStore = defineStore("video", () => {
  const url = ref("");
  const videoInfo = ref<VideoInfo | null>(null);
  const videoFormats = ref<VideoFormat[]>([]);
  const audioFormats = ref<VideoFormat[]>([]);
  const fetching = ref(false);

  const isPlaylist = ref(false);
  const playlistEntries = ref<PlaylistEntry[]>([]);
  const selectedPlaylistItems = ref<number[]>([]);

  const dedupePlaylistEntries = (entries: PlaylistEntry[]): PlaylistEntry[] => {
    const seenIds = new Set<string>();

    return entries.filter((entry) => {
      const videoId = entry.id?.trim();
      if (!videoId) return true;
      if (seenIds.has(videoId)) return false;
      seenIds.add(videoId);
      return true;
    });
  };

  const getCookieArgs = async (): Promise<{
    cookieFile: string | null;
    cookieBrowser: string | null;
  }> => {
    const settingStore = useSettingStore();
    const { cookieMode, cookieText, cookieFile, cookieBrowser } = settingStore;
    if (cookieMode === "text" && cookieText.trim()) {
      const path = await invoke<string>("save_cookie_text", { text: cookieText });
      return { cookieFile: path, cookieBrowser: null };
    }
    if (cookieMode === "file" && cookieFile) {
      return { cookieFile, cookieBrowser: null };
    }
    if (cookieMode === "browser" && cookieBrowser) {
      return { cookieFile: null, cookieBrowser };
    }
    return { cookieFile: null, cookieBrowser: null };
  };

  const fetchVideoInfo = async (targetUrl: string): Promise<boolean> => {
    const settingStore = useSettingStore();
    fetching.value = true;
    try {
      const { cookieFile, cookieBrowser } = await getCookieArgs();
      const info = await invoke<VideoInfo>("fetch_video_info", {
        url: targetUrl,
        cookieFile,
        cookieBrowser,
        proxy: settingStore.proxy || null,
      });

      url.value = targetUrl;

      if (info._type === "playlist" && info.entries?.length) {
        const normalizedEntries = dedupePlaylistEntries(info.entries);

        isPlaylist.value = true;
        playlistEntries.value = normalizedEntries.map((entry, index) => ({
          id: entry.id || String(index + 1),
          title: entry.title || `第 ${index + 1} P`,
          duration: entry.duration ?? null,
          url: entry.url || "",
          thumbnail: entry.thumbnail,
          formats: entry.formats,
        }));
        selectedPlaylistItems.value = playlistEntries.value.map((_, index) => index + 1);

        const firstEntry = normalizedEntries[0];
        const formats: VideoFormat[] = firstEntry?.formats || info.formats || [];
        videoInfo.value = {
          ...info,
          entries: normalizedEntries,
          playlist_count: normalizedEntries.length,
          title: info.title || firstEntry?.title || "",
          thumbnail: info.thumbnail || firstEntry?.thumbnail || "",
          duration: info.duration || firstEntry?.duration || 0,
          formats,
        };
      } else {
        isPlaylist.value = false;
        playlistEntries.value = [];
        selectedPlaylistItems.value = [];
        videoInfo.value = info;
      }

      const formats: VideoFormat[] = videoInfo.value.formats || [];
      videoFormats.value = formats
        .filter((f) => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"))
        .sort((a, b) => (b.height || 0) - (a.height || 0));
      audioFormats.value = formats
        .filter((f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"))
        .sort((a, b) => (b.abr || 0) - (a.abr || 0));

      if (/youtube\.com|youtu\.be/i.test(targetUrl)) {
        try {
          const denoStatus = await invoke<DenoStatus>("get_deno_status");
          if (!denoStatus.installed) {
            const statusStore = useStatusStore();
            statusStore.showDenoSetupModal = true;
          }
        } catch {
          // ignore
        }
      }

      return true;
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : String(e) || "获取视频信息失败";
      if (/err_ytdlp_not_installed/.test(raw)) {
        const statusStore = useStatusStore();
        statusStore.showYtdlpSetupModal = true;
      } else if (/Could not copy.*cookie database/i.test(raw)) {
        showErrorDialog(raw);
      } else if (/sign in|cookies/i.test(raw)) {
        const statusStore = useStatusStore();
        statusStore.showCookieModal = true;
      } else {
        showErrorDialog(raw);
      }
      return false;
    } finally {
      fetching.value = false;
    }
  };

  const clear = () => {
    url.value = "";
    videoInfo.value = null;
    videoFormats.value = [];
    audioFormats.value = [];
    isPlaylist.value = false;
    playlistEntries.value = [];
    selectedPlaylistItems.value = [];
  };

  return {
    url,
    videoInfo,
    videoFormats,
    audioFormats,
    fetching,
    isPlaylist,
    playlistEntries,
    selectedPlaylistItems,
    fetchVideoInfo,
    getCookieArgs,
    clear,
  };
});
