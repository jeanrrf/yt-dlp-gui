<script setup lang="ts">
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { isValidUrl } from "@/utils/validate";
import { useVideoStore } from "@/stores/video";
import { useHistoryStore } from "@/stores/history";
import PulseVisualizer from "@/components/home/PulseVisualizer.vue";
import { useI18n } from "vue-i18n";

const { t, tm } = useI18n();
const router = useRouter();
const videoStore = useVideoStore();
const historyStore = useHistoryStore();

const url = ref("");

const historyIndex = ref(-1);
const showHistory = ref(false);

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    handleSearch();
    return;
  }

  if (historyStore.urls.length === 0) return;

  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (historyIndex.value < historyStore.urls.length - 1) {
      historyIndex.value++;
    }
    url.value = historyStore.urls[historyIndex.value];
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (historyIndex.value > 0) {
      historyIndex.value--;
      url.value = historyStore.urls[historyIndex.value];
    } else {
      historyIndex.value = -1;
      url.value = "";
    }
  }
};

const handleInput = () => {
  historyIndex.value = -1;
};

const selectHistory = (item: string) => {
  url.value = item;
  showHistory.value = false;
  historyIndex.value = -1;
};

const handlePaste = async () => {
  try {
    const text = await readText();
    const trimmed = text.trim();
    if (!trimmed) {
      window.$message.warning(t("clipboard.empty"));
      return;
    }
    if (!isValidUrl(trimmed)) {
      window.$message.warning(t("clipboard.invalidUrl"));
      return;
    }
    url.value = trimmed;
    historyIndex.value = -1;
    window.$message.success(t("clipboard.pasteSuccess"));
  } catch {
    window.$message.warning(t("clipboard.readFailed"));
  }
};

/** 格式化历史记录时间 */
const formatHistoryTime = (time: number): string => {
  if (!time) return "";
  const now = new Date();
  const d = new Date(time);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (today.getTime() - target.getTime()) / 86400000;
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  if (diff === 0) return `${t("downloads.today")} ${timeStr}`;
  if (diff === 1) return `${t("downloads.yesterday")} ${timeStr}`;
  if (diff === 2) return `${t("downloads.dayBeforeYesterday")} ${timeStr}`;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${timeStr}`;
};

const currentTipIndex = ref(0);
let tipTimer: ReturnType<typeof setInterval> | null = null;

const route = useRoute();

onMounted(() => {
  tipTimer = setInterval(() => {
    const tips = tm("home.tips");
    currentTipIndex.value = (currentTipIndex.value + 1) % tips.length;
  }, 4000);
  // 从深链接 query 参数自动填充 URL 并触发解析
  const deepLinkUrl = route.query.url as string | undefined;
  if (deepLinkUrl) {
    url.value = deepLinkUrl;
    router.replace({ name: "home", query: {} });
    handleSearch();
  }
});

// 监听 query 变化（已在首页时收到新深链接）
watch(
  () => route.query.url,
  (newUrl) => {
    if (newUrl && typeof newUrl === "string") {
      url.value = newUrl;
      router.replace({ name: "home", query: {} });
      handleSearch();
    }
  },
);

onUnmounted(() => {
  if (tipTimer) clearInterval(tipTimer);
});

/** 解析视频链接，获取视频信息与可用格式 */
const handleSearch = async () => {
  let trimmed = url.value.trim();
  if (!trimmed) return;

  // 如果用户粘贴的是 youtube playlist/watch query（没有前缀），自动补全
  if (/^playlist\?/i.test(trimmed) || /^watch\?/i.test(trimmed)) {
    trimmed = `https://www.youtube.com/${trimmed}`;
    url.value = trimmed;
  }

  if (!isValidUrl(trimmed)) {
    window.$message.warning(t("home.enterValidUrl"));
    return;
  }
  const success = await videoStore.fetchVideoInfo(trimmed);
  if (success) {
    historyStore.add(trimmed, videoStore.videoInfo?.title);
    router.push({ name: "detail" });
  }
};
</script>

<template>
  <div class="home-page">
    <n-flex vertical align="center" justify="center" :size="20" class="search-view">
      <div class="hero-stage">
        <div class="hero-copy">
          <span class="hero-badge">{{ $t("home.brandBadge") }}</span>
          <img src="/sentinnell-logo.png" alt="SENTINNELL PLAY NOW" class="hero-lockup" />
          <n-text class="hero-headline">
            {{ $t("home.brandHeadline") }}
          </n-text>
          <n-text depth="3" class="hero-description">
            {{ $t("home.brandSubline") }}
          </n-text>
          <div class="hero-chip-row">
            <span class="hero-chip">TAURI 2</span>
            <span class="hero-chip">MIC REACTIVE</span>
            <span class="hero-chip">NEON DOWNLOAD</span>
          </div>
          <n-text depth="3" class="hero-slogan">
            {{ $t("home.slogan") }}
          </n-text>
        </div>
        <PulseVisualizer class="hero-visualizer" />
      </div>
      <n-flex :size="8" :wrap="false" class="search-bar">
        <n-input
          v-model:value="url"
          :placeholder="$t('home.inputPlaceholder')"
          size="large"
          round
          clearable
          :disabled="videoStore.fetching"
          @keydown="handleKeydown"
          @input="handleInput"
        />
        <n-button
          type="primary"
          size="large"
          round
          strong
          secondary
          :loading="videoStore.fetching"
          :disabled="!url.trim()"
          @click="handleSearch"
        >
          <template #icon>
            <n-icon>
              <icon-mdi-magnify />
            </n-icon>
          </template>
          {{ $t("home.parse") }}
        </n-button>
      </n-flex>
      <n-flex :size="8" justify="center">
        <n-button size="small" strong secondary round @click="handlePaste">
          <template #icon>
            <n-icon size="14"><icon-mdi-content-paste /></n-icon>
          </template>
          {{ $t("home.pasteFromClipboard") }}
        </n-button>
        <n-button
          size="small"
          strong
          secondary
          round
          :disabled="historyStore.items.length === 0"
          @click="showHistory = true"
        >
          <template #icon>
            <n-icon size="14"><icon-mdi-history /></n-icon>
          </template>
          {{ $t("home.parseHistory") }}
        </n-button>
      </n-flex>
      <div class="tips-container">
        <Transition name="tip-fade" mode="out-in">
          <n-text :key="currentTipIndex" depth="3" class="tip-item">
            {{ $t(`home.tips[${currentTipIndex}]`) }}
          </n-text>
        </Transition>
      </div>
    </n-flex>

    <n-drawer v-model:show="showHistory" :width="360" placement="right">
      <n-drawer-content :native-scrollbar="false">
        <template #header>
          <n-flex align="center" justify="space-between" style="width: 100%">
            <span>{{ $t("home.parseHistory") }}</span>
            <n-button
              size="tiny"
              strong
              secondary
              type="error"
              :disabled="historyStore.items.length === 0"
              @click="historyStore.clear()"
            >
              {{ $t("common.clear") }}
            </n-button>
          </n-flex>
        </template>
        <n-empty
          v-if="historyStore.items.length === 0"
          :description="$t('home.noHistory')"
          style="margin-top: 80px"
        />
        <n-list v-else bordered clickable>
          <n-list-item
            v-for="(item, index) in historyStore.items"
            :key="index"
            @click="selectHistory(item.url)"
          >
            <n-flex vertical :size="2" style="min-width: 0">
              <n-flex :size="4" :wrap="false" align="center" style="min-width: 0">
                <n-ellipsis :line-clamp="1" :tooltip="false" class="history-title">
                  {{ item.title || item.url }}
                </n-ellipsis>
              </n-flex>
              <n-flex :size="8" :wrap="false" align="center">
                <n-text depth="3" class="history-url">
                  <n-ellipsis :line-clamp="1" :tooltip="false">
                    {{ item.url }}
                  </n-ellipsis>
                </n-text>
                <n-text depth="3" class="history-time">
                  {{ formatHistoryTime(item.time) }}
                </n-text>
              </n-flex>
            </n-flex>
            <template #suffix>
              <n-button
                quaternary
                circle
                size="tiny"
                class="history-delete"
                @click.stop="historyStore.remove(item.url)"
              >
                <template #icon>
                  <n-icon size="14"><icon-mdi-close /></n-icon>
                </template>
              </n-button>
            </template>
          </n-list-item>
        </n-list>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  height: 100%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.home-page::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 18% 20%, rgba(54, 150, 255, 0.18), transparent 28%),
    radial-gradient(circle at 82% 28%, rgba(194, 66, 255, 0.18), transparent 24%),
    radial-gradient(circle at 60% 82%, rgba(255, 48, 214, 0.14), transparent 26%),
    linear-gradient(180deg, rgba(8, 10, 20, 0.12), rgba(8, 10, 20, 0));
}

.home-page::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.18;
  background-image:
    linear-gradient(transparent, rgba(115, 214, 255, 0.35), transparent),
    linear-gradient(transparent, rgba(255, 82, 226, 0.28), transparent);
  background-size:
    56px 160px,
    72px 220px;
  background-position:
    0 0,
    28px 0;
  animation: digital-rain 18s linear infinite;
}

.search-view {
  height: 100%;
  min-height: 300px;
  width: min(100%, 980px);
  margin: 0 auto;
  padding: clamp(20px, 4vh, 36px) 0;

  .search-bar {
    width: 100%;
    max-width: 640px;
  }
}

.hero-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
  align-items: center;
  gap: clamp(20px, 4vw, 52px);
  width: 100%;
  padding: 10px 0 6px;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.hero-badge {
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(109, 207, 255, 0.18);
  background: rgba(7, 10, 24, 0.56);
  box-shadow: 0 18px 44px rgba(3, 5, 14, 0.18);
  color: rgba(231, 244, 255, 0.92);
  font-family: "Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif;
  font-size: 12px;
  letter-spacing: 0.16em;
}

.hero-lockup {
  width: min(100%, 560px);
  height: auto;
  pointer-events: none;
  filter: drop-shadow(0 16px 40px rgba(18, 10, 54, 0.28));
}

.hero-headline {
  font-family: "Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif;
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.05;
  letter-spacing: 0.02em;
}

.hero-description {
  max-width: 560px;
  font-size: 15px;
  line-height: 1.7;
}

.hero-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-chip {
  padding: 9px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(228, 240, 255, 0.82);
  font-family: "Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif;
  font-size: 11px;
  letter-spacing: 0.16em;
}

.hero-slogan {
  font-size: 14px;
}

.hero-visualizer {
  justify-self: end;
}

.tips-container {
  width: 100%;
  max-width: 640px;
  text-align: center;
  height: 20px;
  position: relative;
  margin-top: -8px;

  .tip-item {
    font-size: 12px;
    display: inline-block;
  }
}

.history-title {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  min-width: 0;
}

.history-url {
  font-size: 11px;
  flex: 1;
  min-width: 0;
}

.history-time {
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
}

.history-delete {
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

:deep(.n-list-item):hover .history-delete {
  opacity: 1;
}

@keyframes digital-rain {
  from {
    transform: translateY(-80px);
  }

  to {
    transform: translateY(80px);
  }
}

@media (max-width: 900px) {
  .hero-stage {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .hero-copy {
    align-items: center;
    text-align: center;
  }

  .hero-badge {
    align-self: center;
  }

  .hero-description {
    max-width: 640px;
  }

  .hero-visualizer {
    justify-self: center;
  }
}

@media (max-width: 640px) {
  .search-view {
    padding-top: 8px;
  }

  .hero-lockup {
    width: 100%;
  }

  .hero-chip-row {
    justify-content: center;
  }

  .search-bar {
    :deep(.n-button) {
      padding-inline: 16px;
    }
  }
}
</style>
