import { defineStore } from "pinia";
import type { MediaFile } from "@/types";

export const usePlayerStore = defineStore(
  "player",
  () => {
    const mediaFiles = ref<MediaFile[]>([]);
    const currentTrackId = ref<string | null>(null);
    const volume = ref(0.84);
    const isMuted = ref(false);
    const lastDirectory = ref("");
    const lastLibraryRefreshAt = ref(0);
    const libraryLoaded = ref(false);
    const cachedError = ref("");

    const setLibrary = (files: MediaFile[], directory: string) => {
      mediaFiles.value = files;
      lastDirectory.value = directory;
      lastLibraryRefreshAt.value = Date.now();
      libraryLoaded.value = true;
      cachedError.value = "";

      if (currentTrackId.value && !files.some((file) => file.path === currentTrackId.value)) {
        currentTrackId.value = files[0]?.path ?? null;
      }
    };

    const setError = (message: string) => {
      cachedError.value = message;
      libraryLoaded.value = true;
    };

    const clearLibrary = () => {
      mediaFiles.value = [];
      currentTrackId.value = null;
      lastLibraryRefreshAt.value = 0;
      libraryLoaded.value = true;
      cachedError.value = "";
    };

    return {
      mediaFiles,
      currentTrackId,
      volume,
      isMuted,
      lastDirectory,
      lastLibraryRefreshAt,
      libraryLoaded,
      cachedError,
      setLibrary,
      setError,
      clearLibrary,
    };
  },
  {
    persist: true,
  },
);
