<script setup lang="ts">
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { isValidUrl } from "@/utils/validate";
import { useVideoStore } from "@/stores/video";
import { useHistoryStore } from "@/stores/history";
import { useI18n } from "vue-i18n";

const { t, tm } = useI18n();
const router = useRouter();
const route = useRoute();
const videoStore = useVideoStore();
const historyStore = useHistoryStore();

const url = ref("");
const historyIndex = ref(-1);
const showHistory = ref(false);
const currentTipIndex = ref(0);
let tipTimer: ReturnType<typeof setInterval> | null = null;

const tips = computed(() => tm("home.tips") as string[]);

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

const handleSearch = async () => {
  let trimmed = url.value.trim();
  if (!trimmed) return;

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

onMounted(() => {
  tipTimer = setInterval(() => {
    currentTipIndex.value = (currentTipIndex.value + 1) % tips.value.length;
  }, 4000);

  const deepLinkUrl = route.query.url as string | undefined;
  if (deepLinkUrl) {
    url.value = deepLinkUrl;
    router.replace({ name: "home", query: {} });
    void handleSearch();
  }
});

watch(
  () => route.query.url,
  (newUrl) => {
    if (newUrl && typeof newUrl === "string") {
      url.value = newUrl;
      router.replace({ name: "home", query: {} });
      void handleSearch();
    }
  },
);

onUnmounted(() => {
  if (tipTimer) clearInterval(tipTimer);
});
</script>

<template>
  <div class="home-page">
    <div class="home-shell">
      <div class="home-brand">
        <img src="/sentinnell-mark.png" alt="SENTINNELL PLAY NOW" class="home-mark" />
        <div class="home-copy">
          <span class="home-kicker">SENTINNELL PLAY NOW</span>
          <n-text depth="3" class="home-slogan">
            {{ $t("home.slogan") }}
          </n-text>
        </div>
      </div>

      <div class="home-actions">
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

        <n-flex :size="8" justify="center" wrap class="action-row">
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
      </div>

      <div class="tips-container">
        <Transition name="tip-fade" mode="out-in">
          <n-text :key="currentTipIndex" depth="3" class="tip-item">
            {{ tips[currentTipIndex] }}
          </n-text>
        </Transition>
      </div>
    </div>

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
  min-height: 100%;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
}

.home-page::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 18% 20%, rgba(54, 150, 255, 0.14), transparent 28%),
    radial-gradient(circle at 82% 28%, rgba(194, 66, 255, 0.14), transparent 24%),
    radial-gradient(circle at 60% 82%, rgba(255, 48, 214, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(8, 10, 20, 0.08), rgba(8, 10, 20, 0));
}

.home-page::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: 0.14;
  background-image:
    linear-gradient(transparent, rgba(115, 214, 255, 0.34), transparent),
    linear-gradient(transparent, rgba(255, 82, 226, 0.24), transparent);
  background-size:
    56px 160px,
    72px 220px;
  background-position:
    0 0,
    28px 0;
  animation: digital-rain 18s linear infinite;
}

.home-shell {
  width: min(100%, 760px);
  margin: 0 auto;
  padding: clamp(24px, 6vh, 52px) 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}

.home-brand {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid rgba(124, 212, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(11, 14, 28, 0.92), rgba(9, 10, 18, 0.78));
  box-shadow:
    0 24px 70px rgba(4, 8, 18, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.home-mark {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  flex-shrink: 0;
  box-shadow: 0 16px 30px rgba(9, 12, 24, 0.34);
}

.home-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.home-kicker {
  color: rgba(230, 240, 255, 0.95);
  font-family: "Bahnschrift", "Segoe UI Variable Display", "Segoe UI", sans-serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.home-slogan {
  font-size: 14px;
  line-height: 1.5;
}

.home-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.search-bar {
  width: 100%;
}

.tips-container {
  width: 100%;
  text-align: center;
  min-height: 20px;
  position: relative;

  .tip-item {
    font-size: 12px;
    display: inline-block;
  }
}

.action-row {
  width: 100%;
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

@media (max-width: 640px) {
  .home-shell {
    padding-top: 14px;
  }

  .home-brand {
    padding: 16px;
    border-radius: 20px;
  }

  .home-mark {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .home-kicker {
    font-size: 12px;
  }

  .home-slogan {
    font-size: 13px;
  }
}
</style>
