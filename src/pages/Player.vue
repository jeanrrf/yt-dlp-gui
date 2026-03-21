<script setup lang="ts">
import { convertFileSrc } from "@tauri-apps/api/core";
import PulseVisualizer from "@/components/home/PulseVisualizer.vue";
import { useDownloadStore } from "@/stores/download";
import type { DownloadTask } from "@/types";
import { useI18n } from "vue-i18n";

type PulseState = {
  energy: number;
  bass: number;
  mids: number;
  highs: number;
  peak: number;
};

type PlaylistTrack = {
  task: DownloadTask;
  src: string;
  kind: "audio" | "video";
  fileName: string;
};

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "ogg",
  "opus",
  "wav",
  "wma",
]);

const downloadStore = useDownloadStore();
const router = useRouter();
const { t } = useI18n();

const audioRef = ref<HTMLAudioElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);

const currentTaskId = ref<string | null>(null);
const isLoading = ref(false);
const isPlaying = ref(false);
const isMuted = ref(false);
const volume = ref(0.84);
const currentTime = ref(0);
const duration = ref(0);
const errorMessage = ref("");
const pulseState = reactive<PulseState>({
  energy: 0.2,
  bass: 0.16,
  mids: 0.14,
  highs: 0.12,
  peak: 0.18,
});

let audioContext: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let analyserNode: AnalyserNode | null = null;
let frameId = 0;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (current: number, target: number, amount: number) =>
  current + (target - current) * amount;

const stripQuery = (path: string) => path.split("?")[0].split("#")[0];
const getExtension = (path: string) => {
  const clean = stripQuery(path);
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() ?? "" : "";
};
const getFileName = (path: string) => {
  const clean = stripQuery(path);
  const parts = clean.split(/[/\\]/);
  return parts[parts.length - 1] || clean;
};
const isAudioFile = (path: string) => AUDIO_EXTENSIONS.has(getExtension(path));

const playlist = computed<PlaylistTrack[]>(() =>
  [...downloadStore.tasks]
    .filter((task) => task.status === "completed" && !!task.outputFile)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((task) => {
      const file = task.outputFile!;
      return {
        task,
        src: convertFileSrc(file),
        kind: isAudioFile(file) ? "audio" : "video",
        fileName: getFileName(file),
      };
    }),
);

const currentTrack = computed(() => {
  const selected = playlist.value.find((item) => item.task.id === currentTaskId.value);
  return selected ?? null;
});

const currentIndex = computed(() =>
  currentTrack.value ? playlist.value.findIndex((item) => item.task.id === currentTrack.value?.task.id) : -1,
);

const currentKind = computed(() => currentTrack.value?.kind ?? "audio");
const currentTrackTitle = computed(() => currentTrack.value?.task.title || currentTrack.value?.fileName || "");
const currentTrackFile = computed(() => currentTrack.value?.fileName || "");
const currentMediaElement = () => (currentKind.value === "video" ? videoRef.value : audioRef.value);

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
  media.volume = volume.value;
  media.muted = isMuted.value;
};

const disposeAnalyzer = async () => {
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      // ignore
    }
    sourceNode = null;
  }

  if (analyserNode) {
    try {
      analyserNode.disconnect();
    } catch {
      // ignore
    }
    analyserNode = null;
  }

  if (audioContext && audioContext.state !== "closed") {
    try {
      await audioContext.close();
    } catch {
      // ignore
    }
  }

  audioContext = null;
};

const createAnalyzer = async (media: HTMLMediaElement) => {
  await disposeAnalyzer();

  const AudioContextCtor =
    window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  audioContext = new AudioContextCtor();
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 1024;
  analyserNode.smoothingTimeConstant = 0.82;
  sourceNode = audioContext.createMediaElementSource(media);
  sourceNode.connect(analyserNode);
  analyserNode.connect(audioContext.destination);
};

const stopPlayback = async () => {
  const media = currentMediaElement();
  if (media) {
    media.pause();
    currentTime.value = media.currentTime || 0;
    duration.value = media.duration || 0;
  }
  isPlaying.value = false;
  await disposeAnalyzer();
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
  currentTaskId.value = track.task.id;
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
    media.volume = volume.value;
    media.muted = isMuted.value;
    media.preload = "metadata";
    media.load();

    await createAnalyzer(media);
    await nextTick();
    applyVolume();

    if (autoplay) {
      await audioContext?.resume();
      await media.play();
    } else {
      isPlaying.value = false;
    }
  } catch {
    await handleFailure(t("player.failed"), true);
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
    await audioContext?.resume();
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

  if (currentTaskId.value !== track.task.id) {
    await selectTrack(track, true);
    return;
  }

  const media = currentMediaElement();
  if (!media) return;

  try {
    await audioContext?.resume();
    if (media.paused) {
      await media.play();
    } else {
      media.pause();
    }
  } catch {
    await handleFailure(t("player.failed"), true);
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
  const message = t("player.failed");
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
    currentTaskId.value = null;
    void stopPlayback();
    return;
  }

  if (!currentTaskId.value || !currentTrack.value) {
    void selectTrack(playlist.value[0], false);
  }
};

const updatePulse = (timestamp: number) => {
  const time = timestamp * 0.001;
  const hasAudio = !!analyserNode;
  const data = hasAudio ? new Uint8Array(analyserNode!.frequencyBinCount) : null;

  if (analyserNode && data) {
    analyserNode.getByteFrequencyData(data);

    let sumSquares = 0;
    let peak = 0;
    for (const value of data) {
      const normalized = value / 255;
      sumSquares += normalized * normalized;
      if (normalized > peak) peak = normalized;
    }

    const bandAverage = (startRatio: number, endRatio: number) => {
      const start = Math.floor(data.length * startRatio);
      const end = Math.max(start + 1, Math.floor(data.length * endRatio));
      let sum = 0;
      let count = 0;
      for (let i = start; i < end; i += 1) {
        sum += data[i] / 255;
        count += 1;
      }
      return count > 0 ? sum / count : 0;
    };

    const rms = Math.sqrt(sumSquares / Math.max(1, data.length));
    const energy = clamp(rms * 1.45, 0.08, 1);
    const bass = clamp(bandAverage(0, 0.16) * 1.7, 0.06, 1);
    const mids = clamp(bandAverage(0.16, 0.5) * 1.55, 0.06, 1);
    const highs = clamp(bandAverage(0.5, 1) * 1.8, 0.04, 1);

    pulseState.energy = lerp(pulseState.energy, energy, 0.16);
    pulseState.bass = lerp(pulseState.bass, bass, 0.14);
    pulseState.mids = lerp(pulseState.mids, mids, 0.14);
    pulseState.highs = lerp(pulseState.highs, highs, 0.14);
    pulseState.peak = lerp(pulseState.peak, clamp(peak, 0.05, 1), 0.18);
  } else {
    const idle = {
      energy: 0.18 + 0.03 * Math.sin(time * 1.7) + 0.02 * Math.cos(time * 2.2),
      bass: 0.15 + 0.02 * Math.sin(time * 1.2 + 0.4),
      mids: 0.13 + 0.02 * Math.cos(time * 1.9),
      highs: 0.1 + 0.02 * Math.sin(time * 2.9 + 0.7),
      peak: 0.14 + 0.015 * Math.sin(time * 3.8),
    };

    pulseState.energy = lerp(pulseState.energy, idle.energy, 0.08);
    pulseState.bass = lerp(pulseState.bass, idle.bass, 0.08);
    pulseState.mids = lerp(pulseState.mids, idle.mids, 0.08);
    pulseState.highs = lerp(pulseState.highs, idle.highs, 0.08);
    pulseState.peak = lerp(pulseState.peak, idle.peak, 0.08);
  }

  frameId = window.requestAnimationFrame(updatePulse);
};

watch(
  () => playlist.value.map((item) => item.task.id).join("|"),
  () => syncSelection(),
  { immediate: true },
);

watch(volume, syncVolume);
watch(isMuted, syncVolume);

onMounted(() => {
  frameId = window.requestAnimationFrame(updatePulse);
});

onUnmounted(async () => {
  if (frameId) window.cancelAnimationFrame(frameId);
  await stopPlayback();
});
</script>

<template>
  <div class="player-page">
    <div v-if="!downloadStore.loaded" class="player-loading">
      <n-spin size="large">
        <template #description>{{ $t("player.loading") }}</template>
      </n-spin>
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
          <div class="player-stage">
            <div class="player-frame">
              <PulseVisualizer :state="pulseState" :active="!!currentTrack" class="player-visualizer" />
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
                <div class="transport-row">
                  <n-button quaternary circle size="large" :title="$t('player.previous')" @click="playPrevious">
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
                  <n-button quaternary circle size="large" :title="$t('player.next')" @click="playNext">
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
                    :disabled="!Number.isFinite(duration) || duration <= 0"
                    @update:value="handleSeek"
                  />
                </div>

                <div class="volume-row">
                  <n-button
                    quaternary
                    circle
                    size="small"
                    :title="isMuted ? $t('player.unmute') : $t('player.mute')"
                    @click="isMuted = !isMuted"
                  >
                    <template #icon>
                      <n-icon>
                        <icon-mdi-volume-off v-if="isMuted || volume === 0" />
                        <icon-mdi-volume-high v-else />
                      </n-icon>
                    </template>
                  </n-button>
                  <div class="volume-slider">
                    <n-text depth="3" class="volume-label">{{ $t("player.volume") }}</n-text>
                    <n-slider
                      v-model:value="volume"
                      :min="0"
                      :max="1"
                      :step="0.01"
                      :tooltip="false"
                      :disabled="false"
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
          <div class="playlist-card">
            <div class="playlist-header">
              <div>
                <n-text depth="3" class="playlist-kicker">{{ $t("player.playlist") }}</n-text>
                <h2 class="playlist-title">{{ playlist.length }}</h2>
              </div>
              <n-text depth="3" class="playlist-note">{{ $t("downloads.completed") }}</n-text>
            </div>

            <n-scrollbar class="playlist-scroll">
              <div class="playlist-list">
                <button
                  v-for="track in playlist"
                  :key="track.task.id"
                  class="playlist-item"
                  :class="{ active: track.task.id === currentTaskId }"
                  type="button"
                  @click="selectTrack(track, true)"
                >
                  <div class="playlist-thumb">
                    <img v-if="track.task.thumbnail" :src="track.task.thumbnail" :alt="track.task.title" />
                    <span v-else>{{ track.kind === "audio" ? "A" : "V" }}</span>
                  </div>
                  <div class="playlist-copy">
                    <n-text depth="1" class="playlist-name">
                      {{ track.task.title || track.fileName }}
                    </n-text>
                    <n-text depth="3" class="playlist-meta">
                      {{ track.fileName }}
                    </n-text>
                    <n-text depth="3" class="playlist-format">
                      {{ track.task.formatLabel || track.kind }}
                    </n-text>
                  </div>
                  <n-icon v-if="track.task.id === currentTaskId" class="playlist-playing">
                    <icon-mdi-equalizer />
                  </n-icon>
                </button>
              </div>
            </n-scrollbar>
          </div>
        </aside>
      </div>
    </template>
  </div>

  <audio
    v-if="currentKind === 'audio'"
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
  <video
    v-else
    ref="videoRef"
    class="hidden-media"
    :src="currentTrack?.src || ''"
    preload="metadata"
    muted
    playsinline
    @loadedmetadata="handleLoadedMetadata"
    @timeupdate="handleTimeUpdate"
    @play="handleMediaPlay"
    @pause="handleMediaPause"
    @ended="handleEnded"
    @error="handleMediaError"
  />
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
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 18px;
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

.player-frame {
  display: grid;
  place-items: center;
  min-height: 460px;
  padding: 20px;
  border-radius: 28px;
  border: 1px solid rgba(122, 205, 255, 0.12);
  background:
    radial-gradient(circle at 30% 28%, rgba(57, 167, 255, 0.12), transparent 34%),
    radial-gradient(circle at 70% 72%, rgba(255, 58, 226, 0.14), transparent 32%),
    linear-gradient(180deg, rgba(12, 15, 28, 0.82), rgba(8, 10, 20, 0.9));
  box-shadow:
    0 28px 70px rgba(3, 5, 12, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.player-visualizer {
  width: min(100%, 460px);
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

.playlist-card {
  position: sticky;
  top: 16px;
  padding: 18px;
  border-radius: 26px;
  border: 1px solid rgba(122, 205, 255, 0.12);
  background: rgba(10, 12, 22, 0.82);
  box-shadow:
    0 22px 60px rgba(3, 5, 12, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.playlist-title {
  margin: 6px 0 0;
  font-size: 28px;
}

.playlist-scroll {
  max-height: calc(100vh - 248px);
  margin-top: 16px;
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  border-color: rgba(125, 212, 255, 0.34);
  background:
    linear-gradient(180deg, rgba(81, 60, 255, 0.16), rgba(255, 61, 221, 0.1)),
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
  color: rgba(124, 212, 255, 0.92);
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

  .playlist-card {
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
  .playlist-card {
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
