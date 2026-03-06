import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { useSettingStore } from "@/stores/setting";
import type { VideoInfo, VideoFormat, PlaylistEntry } from "@/types";

export const useVideoStore = defineStore("video", () => {
  const url = ref("");
  const videoInfo = ref<VideoInfo | null>(null);
  const videoFormats = ref<VideoFormat[]>([]);
  const audioFormats = ref<VideoFormat[]>([]);
  const fetching = ref(false);

  // 播放列表
  const isPlaylist = ref(false);
  const playlistEntries = ref<PlaylistEntry[]>([]);
  const selectedPlaylistItems = ref<number[]>([]);

  /** 获取当前有效的 Cookie 文件路径 */
  const getCookieFile = async (): Promise<string | null> => {
    const settingStore = useSettingStore();
    const { cookieMode, cookieText, cookieFile } = settingStore;
    if (cookieMode === "text" && cookieText.trim()) {
      return await invoke<string>("save_cookie_text", { text: cookieText });
    }
    if (cookieMode === "file" && cookieFile) {
      return cookieFile;
    }
    return null;
  };

  /** 解析视频信息并填充 store，返回是否成功 */
  const fetchVideoInfo = async (targetUrl: string): Promise<boolean> => {
    const settingStore = useSettingStore();
    fetching.value = true;
    try {
      const cookieFile = await getCookieFile();
      const info = await invoke<VideoInfo>("fetch_video_info", {
        url: targetUrl,
        cookieFile,
        proxy: settingStore.proxy || null,
      });

      url.value = targetUrl;

      if (info._type === "playlist" && info.entries?.length) {
        isPlaylist.value = true;
        playlistEntries.value = info.entries.map((e, i) => ({
          id: e.id || String(i + 1),
          title: e.title || `第 ${i + 1} P`,
          duration: e.duration ?? null,
          url: e.url || "",
        }));
        selectedPlaylistItems.value = playlistEntries.value.map((_, i) => i + 1);
        const firstEntry = info.entries[0];
        const formats: VideoFormat[] = firstEntry?.formats || info.formats || [];
        videoInfo.value = {
          ...info,
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
        .filter(
          (f) => f.vcodec && f.vcodec !== "none" && (!f.acodec || f.acodec === "none"),
        )
        .sort((a, b) => (b.height || 0) - (a.height || 0));
      audioFormats.value = formats
        .filter(
          (f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none"),
        )
        .sort((a, b) => (b.abr || 0) - (a.abr || 0));

      return true;
    } catch (e: unknown) {
      window.$message.error(
        e instanceof Error ? e.message : String(e) || "获取视频信息失败",
      );
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
    getCookieFile,
    clear,
  };
});
