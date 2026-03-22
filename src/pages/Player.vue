<script setup lang="ts">
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import PulseVisualizer from "@/components/home/PulseVisualizer.vue";
import { useDownloadStore } from "@/stores/download";
import { usePlayerStore } from "@/stores/player";
import { useSettingStore } from "@/stores/setting";
import type { MediaFile } from "@/types";
import { useI18n } from "vue-i18n";

type PulseState = {
  energy: number;
  bass: number;
  mids: number;
  highs: number;
  peak: number;
};

type LibraryFilter = "all" | "audio" | "video";

type PlaylistTrack = {
  id: string;
  path: string;
  src: string;
  kind: "audio" | "video";
  title: string;
  fileName: string;
  thumbnail?: string;
  modifiedAt: number;
};

const AUDIO_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "ogg", "opus", "wav", "wma"]);

const downloadStore = useDownloadStore();
const playerStore = usePlayerStore();
const settingStore = useSettingStore();
const router = useRouter();
const { t } = useI18n();
const isDesktopShell = ref(typeof window !== "undefined" && isTauri());
const libraryQuery = ref("");
const libraryFilter = ref<LibraryFilter>("all");

const audioRef = ref<HTMLAudioElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);

const isLoading = ref(false);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const errorMessage = ref("");
let libraryPollTimer: ReturnType<typeof setInterval> | null = null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const stripQuery = (path: string) => path.split("?")[0].split("#")[0];
const getExtension = (path: string) => {
  const clean = stripQuery(path);
  const parts = clean.split(".");
  return parts.length > 1 ? (parts.pop()?.toLowerCase() ?? "") : "";
};
const getFileName = (path: string) => {
  const clean = stripQuery(path);
  const parts = clean.split(/[/\\]/);
  return parts[parts.length - 1] || clean;
};
const getDisplayTitle = (path: string) => {
  const fileName = getFileName(path);
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
};
const isAudioFile = (path: string) => AUDIO_EXTENSIONS.has(getExtension(path));
const toMediaFile = (path: string, modifiedAt = Date.now()): MediaFile => ({
  path,
  fileName: getFileName(path),
  modifiedAt,
});

const fallbackMediaFiles = computed<MediaFile[]>(() =>
  [...downloadStore.tasks]
    .filter((task) => task.status === "completed" && !!task.outputFile)
    .map((task) => toMediaFile(task.outputFile!, task.createdAt || Date.now()))
    .sort((a, b) => b.modifiedAt - a.modifiedAt),
);

const librarySource = computed(() => {
  if (playerStore.mediaFiles.length > 0) {
    return settingStore.downloadDir ? "directory" : "downloads-cache";
  }
  if (fallbackMediaFiles.value.length > 0) {
    return "downloads-cache";
  }
  return "empty";
});

const librarySourceLabel = computed(() => {
  switch (librarySource.value) {
    case "directory":
      return "Pasta configurada";
    case "downloads-cache":
      return "Cache dos downloads concluídos";
    default:
      return "Nenhuma origem disponível";
  }
});

const libraryDirectoryLabel = computed(() => settingStore.downloadDir || "Nenhuma pasta configurada");
const normalizedLibraryQuery = computed(() => libraryQuery.value.trim().toLowerCase());

const playlist = computed<PlaylistTrack[]>(() =>
  [...(playerStore.mediaFiles.length ? playerStore.mediaFiles : fallbackMediaFiles.value)]
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .map((file) => {
      return {
        id: file.path,
        path: file.path,
        src: resolveTrackSrc(file.path),
        kind: isAudioFile(file.path) ? "audio" : "video",
        title: getDisplayTitle(file.path),
        fileName: file.fileName,
        modifiedAt: file.modifiedAt,
      };
    }),
);

const filteredPlaylist = computed(() =>
  playlist.value.filter((track) => {
    if (libraryFilter.value !== "all" && track.kind !== libraryFilter.value) {
      return false;
    }

    if (!normalizedLibraryQuery.value) {
      return true;
    }

    const haystack = `${track.title} ${track.fileName}`.toLowerCase();
    return haystack.includes(normalizedLibraryQuery.value);
  }),
);

const currentTrack = computed(() => {
  const selected = playlist.value.find((item) => item.id === playerStore.currentTrackId);
  return selected ?? null;
});

const currentIndex = computed(() =>
  currentTrack.value
    ? playlist.value.findIndex((item) => item.id === currentTrack.value?.id)
    : -1,
);

const currentKind = computed(() => currentTrack.value?.kind ?? "audio");
const currentTrackTitle = computed(() => currentTrack.value?.title || currentTrack.value?.fileName || "");
const currentTrackFile = computed(() => currentTrack.value?.fileName || "");
const currentMediaElement = () => (currentKind.value === "video" ? videoRef.value : audioRef.value);
const resolveTrackSrc = (path: string) => (isDesktopShell.value ? convertFileSrc(path, "asset") : "");
const visualizerState = computed<PulseState>(() => {
  const activity = isPlaying.value && !playerStore.isMuted ? clamp(playerStore.volume, 0.1, 1) : 0.18;
  const drift = currentTime.value || 0;

  return {
    energy: clamp(0.22 + activity * 0.42 + Math.sin(drift * 1.4) * 0.06, 0.16, 0.94),
    bass: clamp(0.18 + activity * 0.34 + Math.sin(drift * 0.92 + 0.4) * 0.08, 0.14, 0.88),
    mids: clamp(0.14 + activity * 0.28 + Math.cos(drift * 1.2) * 0.05, 0.1, 0.8),
    highs: clamp(0.12 + activity * 0.24 + Math.sin(drift * 1.8 + 0.8) * 0.05, 0.08, 0.76),
    peak: clamp(0.18 + activity * 0.38 + Math.abs(Math.sin(drift * 2.1)) * 0.08, 0.14, 0.96),
  };
});

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const applyVolume = () => {
  const media = currentMediaElement();
  if (!media) return;
  media.volume = playerStore.volume;
  media.muted = playerStore.isMuted;
};

const loadMediaFiles = async () => {
  if (!isDesktopShell.value && typeof window === "undefined") {
    playerStore.clearLibrary();
    return;
  }

  if (!settingStore.downloadDir) {
    if (fallbackMediaFiles.value.length > 0) {
      playerStore.setLibrary(fallbackMediaFiles.value, "");
      if (!playerStore.currentTrackId && fallbackMediaFiles.value[0]) {
        playerStore.currentTrackId = fallbackMediaFiles.value[0].path;
      }
    } else {
      playerStore.clearLibrary();
    }
    return;
  }

  try {
    const files = await invoke<MediaFile[]>("list_media_files", {
      downloadDir: settingStore.downloadDir,
    });
    isDesktopShell.value = true;
    const nextFiles = files.length > 0 ? files : fallbackMediaFiles.value;
    playerStore.setLibrary(nextFiles, settingStore.downloadDir);
    if (!playerStore.currentTrackId && nextFiles[0]) {
      playerStore.currentTrackId = nextFiles[0].path;
    }
  } catch (error) {
    if (fallbackMediaFiles.value.length > 0) {
      playerStore.setLibrary(fallbackMediaFiles.value, settingStore.downloadDir);
      if (!playerStore.currentTrackId && fallbackMediaFiles.value[0]) {
        playerStore.currentTrackId = fallbackMediaFiles.value[0].path;
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      playerStore.setError(message);
      errorMessage.value = message;
    }
  }
};

const stopPlayback = async () => {
  const media = currentMediaElement();
  if (media) {
    media.pause();
    currentTime.value = media.currentTime || 0;
    duration.value = media.duration || 0;
  }
  isPlaying.value = false;
};

const handleFailure = async (message: string, skipNext = true) => {
  errorMessage.value = message;
  window.$message?.error?.(message);
  await stopPlayback();

  if (!skipNext) return;
  if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length - 1) {
    const next = playlist.value[currentIndex.value + 1];
    if (next) {
      void selectTrack(next, true);
    }
  }
};

const loadTrack = async (track: PlaylistTrack, autoplay: boolean) => {
  if (!isDesktopShell.value) {
    playerStore.currentTrackId = track.id;
    errorMessage.value = t("player.onlyTauri");
    isLoading.value = false;
    isPlaying.value = false;
    return;
  }

  playerStore.currentTrackId = track.id;
  errorMessage.value = "";
  isLoading.value = true;

  try {
    await nextTick();
    const media = currentMediaElement();
    if (!media) {
      throw new Error("Media element not ready");
    }

    media.pause();
    media.src = track.src;
    media.currentTime = 0;
    media.volume = playerStore.volume;
    media.muted = playerStore.isMuted;
    media.preload = "metadata";
    media.load();

    await nextTick();
    applyVolume();

    if (autoplay) {
      await media.play();
    } else {
      isPlaying.value = false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : t("player.failed");
    await handleFailure(`${t("player.failed")} (${message})`, true);
    return;
  } finally {
    isLoading.value = false;
  }
};

const selectTrack = async (track: PlaylistTrack, autoplay = true) => {
  await loadTrack(track, autoplay);
};

const selectByIndex = async (index: number, autoplay = true) => {
  const track = playlist.value[index];
  if (!track) return;
  await selectTrack(track, autoplay);
};

const playPrevious = async () => {
  if (!playlist.value.length) return;
  if (currentIndex.value > 0) {
    await selectByIndex(currentIndex.value - 1, true);
    return;
  }

  const media = currentMediaElement();
  if (media) {
    media.currentTime = 0;
    await media.play();
  }
};

const playNext = async () => {
  if (!playlist.value.length) return;
  const next = playlist.value[currentIndex.value + 1];
  if (next) {
    await selectTrack(next, true);
    return;
  }
  await stopPlayback();
};

const togglePlayPause = async () => {
  if (!playlist.value.length) return;

  const track = currentTrack.value ?? playlist.value[0];
  if (!track) return;

  if (playerStore.currentTrackId !== track.id) {
    await selectTrack(track, true);
    return;
  }

  const media = currentMediaElement();
  if (!media) return;

  try {
    if (media.paused) {
      await media.play();
    } else {
      media.pause();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : t("player.failed");
    await handleFailure(`${t("player.failed")} (${message})`, true);
  }
};

const handleSeek = (value: number) => {
  const media = currentMediaElement();
  if (!media || !Number.isFinite(media.duration) || media.duration <= 0) return;
  media.currentTime = (media.duration * value) / 100;
  currentTime.value = media.currentTime;
};

const handleLoadedMetadata = (event: Event) => {
  const media = event.target as HTMLMediaElement;
  duration.value = media.duration || 0;
  currentTime.value = media.currentTime || 0;
};

const handleTimeUpdate = (event: Event) => {
  const media = event.target as HTMLMediaElement;
  currentTime.value = media.currentTime || 0;
  duration.value = media.duration || 0;
};

const handleMediaPlay = () => {
  isPlaying.value = true;
  applyVolume();
};

const handleMediaPause = () => {
  isPlaying.value = false;
};

const handleMediaError = async () => {
  const media = currentMediaElement();
  const nativeMessage =
    media?.error?.message || (media?.error ? `MediaError code ${media.error.code}` : "");
  const message = nativeMessage ? `${t("player.failed")} (${nativeMessage})` : t("player.failed");
  errorMessage.value = message;
  window.$message?.warning?.(message);
  await stopPlayback();
  if (currentIndex.value >= 0 && currentIndex.value < playlist.value.length - 1) {
    const next = playlist.value[currentIndex.value + 1];
    if (next) {
      void selectTrack(next, true);
      return;
    }
  }
};

const handleEnded = async () => {
  await playNext();
};

const syncVolume = () => {
  applyVolume();
};

const syncSelection = () => {
  if (!playlist.value.length) {
    playerStore.currentTrackId = null;
    void stopPlayback();
    return;
  }

  if (!playerStore.currentTrackId || !currentTrack.value) {
    void selectTrack(playlist.value[0], false);
  }
};

watch(
  () => playlist.value.map((item) => item.id).join("|"),
  () => syncSelection(),
  { immediate: true },
);

watch(
  () => settingStore.downloadDir,
  () => {
    void loadMediaFiles();
  },
  { immediate: true },
);

watch(
  () => fallbackMediaFiles.value.map((file) => `${file.path}:${file.modifiedAt}`).join("|"),
  () => {
    if (!playerStore.mediaFiles.length || !settingStore.downloadDir) {
      void loadMediaFiles();
    }
  },
);

watch(() => playerStore.volume, syncVolume);
watch(() => playerStore.isMuted, syncVolume);

onMounted(() => {
  if (isDesktopShell.value) {
    libraryPollTimer = window.setInterval(() => {
      void loadMediaFiles();
    }, 5000);
  }
});

onUnmounted(async () => {
  if (libraryPollTimer) window.clearInterval(libraryPollTimer);
  await stopPlayback();
});
</script>

<template>
  <div class="player-page">
    <div v-if="!playerStore.libraryLoaded && playlist.length === 0" class="player-loading">
      <div class="page-loading-card">
        <n-spin size="large" />
        <n-text depth="3" class="page-loading-text">{{ $t("player.loading") }}</n-text>
      </div>
    </div>

    <template v-else>
      <div v-if="!playlist.length" class="player-empty">
        <n-empty :description="$t('player.emptyDesc')">
          <template #icon>
            <n-icon size="42">
              <icon-mdi-play-box-outline />
            </n-icon>
          </template>
          <template #extra>
            <n-button type="primary" round strong @click="router.push({ name: 'home' })">
              {{ $t("player.openDownloads") }}
            </n-button>
          </template>
          <template #default>
            <div class="player-empty-title">{{ $t("player.emptyTitle") }}</div>
          </template>
        </n-empty>
      </div>

      <div v-else class="player-layout">
        <section class="player-main">
          <div class="player-overview">
            <div class="overview-card">
              <span class="overview-label">Biblioteca</span>
              <strong class="overview-value">{{ playlist.length }}</strong>
            </div>
            <div class="overview-card overview-card-wide">
              <span class="overview-label">Pasta atual</span>
              <n-ellipsis :tooltip="{ width: 560 }" class="overview-value overview-path">
                {{ libraryDirectoryLabel }}
              </n-ellipsis>
            </div>
            <div class="overview-card">
              <span class="overview-label">Origem</span>
              <strong class="overview-value">{{ librarySourceLabel }}</strong>
            </div>
          </div>

          <div class="player-stage">
            <div class="player-frame">
              <video
                v-if="isDesktopShell && currentKind === 'video' && currentTrack"
                ref="videoRef"
                class="player-video"
                :src="currentTrack.src"
                :poster="currentTrack.thumbnail || undefined"
                preload="metadata"
                :muted="playerStore.isMuted"
                playsinline
                @loadedmetadata="handleLoadedMetadata"
                @timeupdate="handleTimeUpdate"
                @play="handleMediaPlay"
                @pause="handleMediaPause"
                @ended="handleEnded"
                @error="handleMediaError"
              />
              <PulseVisualizer
                v-else
                :state="visualizerState"
                :active="!!currentTrack && isPlaying"
                class="player-visualizer"
              />
            </div>

            <div class="player-now">
              <div class="player-track-meta">
                <n-text depth="3" class="player-label">{{ $t("player.title") }}</n-text>
                <h1 class="player-title">{{ currentTrackTitle || $t("player.title") }}</h1>
                <n-text depth="3" class="player-subtitle">
                  {{ currentTrackFile || $t("player.subtitle") }}
                </n-text>
              </div>

              <div class="player-controls">
                <n-alert
                  v-if="!isDesktopShell"
                  type="info"
                  :bordered="false"
                  class="player-alert"
                >
                  {{ $t("player.onlyTauri") }}
                </n-alert>

                <div class="transport-row">
                  <n-button
                    quaternary
                    circle
                    size="large"
                    :title="$t('player.previous')"
                    :disabled="!isDesktopShell"
                    @click="playPrevious"
                  >
                    <template #icon>
                      <n-icon><icon-mdi-skip-previous /></n-icon>
                    </template>
                  </n-button>
                  <n-button
                    type="primary"
                    strong
                    circle
                    size="large"
                    class="play-button"
                    :loading="isLoading"
                    :disabled="!isDesktopShell"
                    :title="isPlaying ? $t('player.pause') : $t('player.play')"
                    @click="togglePlayPause"
                  >
                    <template #icon>
                      <n-icon>
                        <icon-mdi-pause v-if="isPlaying" />
                        <icon-mdi-play v-else />
                      </n-icon>
                    </template>
                  </n-button>
                  <n-button
                    quaternary
                    circle
                    size="large"
                    :title="$t('player.next')"
                    :disabled="!isDesktopShell"
                    @click="playNext"
                  >
                    <template #icon>
                      <n-icon><icon-mdi-skip-next /></n-icon>
                    </template>
                  </n-button>
                </div>

                <div class="seek-panel">
                  <div class="seek-header">
                    <n-text depth="3">{{ $t("player.seek") }}</n-text>
                    <n-text depth="3" class="time-readout">
                      {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
                    </n-text>
                  </div>
                  <n-slider
                    :value="duration > 0 ? (currentTime / duration) * 100 : 0"
                    :max="100"
                    :step="0.1"
                    :tooltip="false"
                    :disabled="!isDesktopShell || !Number.isFinite(duration) || duration <= 0"
                    @update:value="handleSeek"
                  />
                </div>

                <div class="volume-row">
                  <n-button
                    quaternary
                    circle
                    size="small"
                    :title="playerStore.isMuted ? $t('player.unmute') : $t('player.mute')"
                    @click="playerStore.isMuted = !playerStore.isMuted"
                  >
                    <template #icon>
                      <n-icon>
                        <icon-mdi-volume-off
                          v-if="playerStore.isMuted || playerStore.volume === 0"
                        />
                        <icon-mdi-volume-high v-else />
                      </n-icon>
                    </template>
                  </n-button>
                  <div class="volume-slider">
                    <n-text depth="3" class="volume-label">{{ $t("player.volume") }}</n-text>
                    <n-slider
                      v-model:value="playerStore.volume"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :tooltip="false"
                      :disabled="!isDesktopShell"
                    />
                  </div>
                </div>
              </div>

              <n-alert v-if="errorMessage" type="warning" :bordered="false" class="player-alert">
                {{ errorMessage }}
              </n-alert>
            </div>
          </div>
        </section>

        <aside class="player-sidebar">
          <div class="library-card">
            <div class="library-header">
              <div>
                <n-text depth="3" class="playlist-kicker">Biblioteca</n-text>
                <h2 class="playlist-title">{{ filteredPlaylist.length }}</h2>
              </div>
              <n-text depth="3" class="playlist-note">{{ playlist.length }} no total</n-text>
            </div>

            <div class="library-toolbar">
              <n-input
                v-model:value="libraryQuery"
                clearable
                placeholder="Buscar faixa ou arquivo"
                class="library-search"
              >
                <template #prefix>
                  <n-icon><icon-mdi-magnify /></n-icon>
                </template>
              </n-input>
              <div class="library-filters">
                <button
                  type="button"
                  class="filter-pill"
                  :class="{ active: libraryFilter === 'all' }"
                  @click="libraryFilter = 'all'"
                >
                  Tudo
                </button>
                <button
                  type="button"
                  class="filter-pill"
                  :class="{ active: libraryFilter === 'audio' }"
                  @click="libraryFilter = 'audio'"
                >
                  Áudio
                </button>
                <button
                  type="button"
                  class="filter-pill"
                  :class="{ active: libraryFilter === 'video' }"
                  @click="libraryFilter = 'video'"
                >
                  Vídeo
                </button>
              </div>
            </div>

            <n-scrollbar class="playlist-scroll">
              <div class="playlist-list">
                <div v-if="!filteredPlaylist.length" class="library-empty">
                  <span>Nenhum item encontrado para esse filtro.</span>
                </div>
                <button
                  v-for="track in filteredPlaylist"
                  :key="track.id"
                  class="playlist-item"
                  :class="{ active: track.id === playerStore.currentTrackId }"
                  type="button"
                  @click="selectTrack(track, true)"
                >
                  <div class="playlist-thumb">
                    <img
                      v-if="track.thumbnail"
                      :src="track.thumbnail"
                      :alt="track.title"
                    />
                    <span v-else>{{ track.kind === "audio" ? "A" : "V" }}</span>
                  </div>
                  <div class="playlist-copy">
                    <n-text depth="1" class="playlist-name">
                      {{ track.title || track.fileName }}
                    </n-text>
                    <n-text depth="3" class="playlist-meta">
                      {{ track.fileName }}
                    </n-text>
                    <n-text depth="3" class="playlist-format">
                      {{ track.kind === "audio" ? "Faixa local" : "Vídeo local" }}
                    </n-text>
                  </div>
                  <n-icon v-if="track.id === playerStore.currentTrackId" class="playlist-playing">
                    <icon-mdi-equalizer />
                  </n-icon>
                </button>
              </div>
            </n-scrollbar>
          </div>
        </aside>
      </div>
    </template>

    <audio
      v-if="isDesktopShell && currentKind === 'audio'"
      ref="audioRef"
      class="hidden-media"
      :src="currentTrack?.src || ''"
      preload="metadata"
      @loadedmetadata="handleLoadedMetadata"
      @timeupdate="handleTimeUpdate"
      @play="handleMediaPlay"
      @pause="handleMediaPause"
      @ended="handleEnded"
      @error="handleMediaError"
    />
  </div>
</template>

<style scoped lang="scss">
.player-page {
  min-height: 100%;
  position: relative;
}

.player-loading,
.player-empty {
  min-height: calc(100vh - 160px);
  display: grid;
  place-items: center;
}

.player-empty-title {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
}

.player-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 420px);
  gap: 20px;
  align-items: start;
}

.player-main,
.player-sidebar {
  min-width: 0;
}

.player-stage {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.player-overview {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 180px;
  gap: 12px;
  margin-bottom: 16px;
}

.overview-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(123, 208, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(15, 20, 34, 0.92), rgba(8, 11, 20, 0.92)),
    rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.overview-card-wide {
  background:
    radial-gradient(circle at 18% 20%, rgba(74, 232, 198, 0.14), transparent 32%),
    linear-gradient(180deg, rgba(15, 20, 34, 0.92), rgba(8, 11, 20, 0.92));
}

.overview-label {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.overview-value {
  font-size: 14px;
  font-weight: 700;
  color: rgba(244, 248, 255, 0.94);
}

.overview-path {
  min-width: 0;
}

.player-frame {
  display: grid;
  place-items: center;
  min-height: 520px;
  padding: 28px;
  border-radius: 32px;
  border: 1px solid rgba(122, 205, 255, 0.14);
  background:
    radial-gradient(circle at 28% 22%, rgba(68, 181, 255, 0.16), transparent 30%),
    radial-gradient(circle at 72% 82%, rgba(26, 214, 163, 0.16), transparent 30%),
    linear-gradient(180deg, rgba(8, 14, 28, 0.96), rgba(8, 10, 19, 0.98));
  box-shadow:
    0 28px 70px rgba(3, 5, 12, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.player-visualizer {
  width: min(100%, 560px);
}

.player-video {
  width: min(100%, 920px);
  max-height: 560px;
  border-radius: 24px;
  display: block;
  background: #05080d;
  box-shadow:
    0 24px 60px rgba(1, 6, 12, 0.44),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.player-now {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
  gap: 18px;
  align-items: start;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(10, 12, 22, 0.72);
  box-shadow: 0 16px 40px rgba(2, 4, 10, 0.24);
}

.player-track-meta {
  min-width: 0;
}

.player-label,
.playlist-kicker,
.playlist-note {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.player-title {
  margin: 8px 0 6px;
  font-size: clamp(22px, 3vw, 34px);
  line-height: 1.08;
}

.player-subtitle {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
}

.player-controls {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.transport-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.play-button {
  width: 56px;
  height: 56px;
}

.seek-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seek-header,
.volume-row,
.playlist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.time-readout {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.volume-row {
  align-items: flex-end;
}

.volume-slider {
  flex: 1;
  min-width: 0;
}

.volume-label {
  font-size: 11px;
  display: inline-block;
  margin-bottom: 4px;
  letter-spacing: 0.12em;
}

.player-alert {
  margin-top: 4px;
}

.library-card {
  position: sticky;
  top: 16px;
  padding: 18px;
  border-radius: 26px;
  border: 1px solid rgba(122, 205, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(11, 15, 28, 0.95), rgba(8, 10, 20, 0.98)),
    rgba(10, 12, 22, 0.82);
  box-shadow:
    0 22px 60px rgba(3, 5, 12, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.library-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.playlist-title {
  margin: 6px 0 0;
  font-size: 28px;
}

.library-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.library-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-pill {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(242, 246, 255, 0.82);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.filter-pill.active {
  border-color: rgba(101, 237, 203, 0.42);
  background: rgba(84, 230, 191, 0.14);
  color: rgba(204, 255, 244, 0.96);
}

.playlist-scroll {
  max-height: calc(100vh - 320px);
  margin-top: 16px;
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.library-empty {
  padding: 18px 14px;
  border-radius: 18px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.62);
  text-align: center;
  font-size: 13px;
}

.playlist-item {
  width: 100%;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 10px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease;
}

.playlist-item:hover {
  transform: translateY(-1px);
  border-color: rgba(124, 212, 255, 0.24);
  background: rgba(255, 255, 255, 0.05);
}

.playlist-item.active {
  border-color: rgba(101, 237, 203, 0.34);
  background:
    linear-gradient(180deg, rgba(47, 167, 146, 0.18), rgba(30, 111, 204, 0.14)),
    rgba(255, 255, 255, 0.04);
}

.playlist-thumb {
  width: 54px;
  height: 54px;
  border-radius: 16px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(235, 245, 255, 0.9);
  font-weight: 700;
  flex-shrink: 0;
}

.playlist-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playlist-name {
  font-size: 14px;
  font-weight: 600;
}

.playlist-meta,
.playlist-format {
  font-size: 11px;
  line-height: 1.4;
  word-break: break-word;
}

.playlist-playing {
  color: rgba(101, 237, 203, 0.92);
}

.hidden-media {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

@media (max-width: 1180px) {
  .player-layout {
    grid-template-columns: 1fr;
  }

  .player-overview {
    grid-template-columns: 1fr;
  }

  .library-card {
    position: static;
  }

  .playlist-scroll {
    max-height: none;
  }
}

@media (max-width: 820px) {
  .player-now {
    grid-template-columns: 1fr;
  }

  .player-frame {
    min-height: 380px;
  }
}

@media (max-width: 640px) {
  .player-frame {
    min-height: 320px;
    padding: 14px;
    border-radius: 22px;
  }

  .player-now,
  .library-card {
    padding: 14px;
    border-radius: 20px;
  }

  .playlist-item {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .playlist-playing {
    display: none;
  }
}
</style>
