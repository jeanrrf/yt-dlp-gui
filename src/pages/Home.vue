<script setup lang="ts">
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { isValidUrl } from "@/utils/validate";
import { useVideoStore } from "@/stores/video";
import { useHistoryStore } from "@/stores/history";

const router = useRouter();
const videoStore = useVideoStore();
const historyStore = useHistoryStore();

const url = ref("");

// ========== 历史记录 ==========
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

// ========== 剪贴板 ==========
const handlePaste = async () => {
  try {
    const text = await readText();
    const trimmed = text.trim();
    if (!trimmed) {
      window.$message.warning("剪贴板为空");
      return;
    }
    if (!isValidUrl(trimmed)) {
      window.$message.warning("剪贴板内容不是有效的链接");
      return;
    }
    url.value = trimmed;
    historyIndex.value = -1;
  } catch {
    window.$message.warning("无法读取剪贴板");
  }
};

// ========== 提示文本 ==========
const tips = [
  "遇到下载问题？请前往设置中填写 Cookie 或更新 yt-dlp 版本",
  "支持 YouTube、Bilibili、Twitter 等上千个网站",
  "可选仅视频或仅音频模式，按需下载",
  "下载前请确保已设置下载目录",
  "YouTube 视频建议安装 Deno 运行时以获取完整格式列表",
  "可使用键盘 上 / 下 键来选择历史解析记录",
];

const currentTipIndex = ref(0);
let tipTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  tipTimer = setInterval(() => {
    currentTipIndex.value = (currentTipIndex.value + 1) % tips.length;
  }, 4000);
});

onUnmounted(() => {
  if (tipTimer) clearInterval(tipTimer);
});

/** 解析视频链接，获取视频信息与可用格式 */
const handleSearch = async () => {
  const trimmed = url.value.trim();
  if (!trimmed) return;
  if (!isValidUrl(trimmed)) {
    window.$message.warning("请输入有效的网址");
    return;
  }
  const success = await videoStore.fetchVideoInfo(trimmed);
  if (success) {
    historyStore.add(trimmed);
    router.push({ name: "detail" });
  }
};
</script>

<template>
  <div class="home-page">
    <div class="search-view">
      <div class="search-hero">
        <div class="hero-logo">
          <icon-mdi-youtube class="hero-icon" />
          <span class="hero-text">GUI</span>
        </div>
        <n-text depth="3" style="font-size: 16px">
          粘贴视频链接，快速下载
        </n-text>
      </div>
      <div class="search-bar">
        <n-input
          v-model:value="url"
          placeholder="请输入视频链接..."
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
          解析
        </n-button>
      </div>
      <!-- 快捷按钮 -->
      <n-flex :size="8" justify="center">
        <n-button size="small" strong secondary round @click="handlePaste">
          <template #icon>
            <n-icon size="14"><icon-mdi-content-paste /></n-icon>
          </template>
          从剪贴板粘贴
        </n-button>
        <n-popover
          v-model:show="showHistory"
          trigger="click"
          placement="bottom"
          :width="400"
          :disabled="historyStore.urls.length === 0"
        >
          <template #trigger>
            <n-button
              size="small"
              strong
              secondary
              round
              :disabled="historyStore.urls.length === 0"
            >
              <template #icon>
                <n-icon size="14"><icon-mdi-history /></n-icon>
              </template>
              解析历史
            </n-button>
          </template>
          <div class="history-popover">
            <n-flex
              align="center"
              justify="space-between"
              style="margin-bottom: 6px"
            >
              <n-text strong style="font-size: 13px">历史解析记录</n-text>
              <n-button
                size="tiny"
                strong
                secondary
                type="error"
                @click="
                  historyStore.clear();
                  showHistory = false;
                "
              >
                清空
              </n-button>
            </n-flex>
            <n-scrollbar style="max-height: 260px">
              <n-flex vertical :size="2">
                <n-button
                  v-for="(item, index) in historyStore.urls"
                  :key="index"
                  quaternary
                  size="small"
                  style="justify-content: flex-start; width: 100%"
                  @click="selectHistory(item)"
                >
                  <n-ellipsis
                    :line-clamp="1"
                    :tooltip="false"
                    style="font-size: 13px"
                  >
                    {{ item }}
                  </n-ellipsis>
                </n-button>
              </n-flex>
            </n-scrollbar>
          </div>
        </n-popover>
      </n-flex>
      <div class="tips-container">
        <Transition name="tip-fade" mode="out-in">
          <n-text :key="currentTipIndex" depth="3" class="tip-item">
            {{ tips[currentTipIndex] }}
          </n-text>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.home-page {
  height: 100%;
  position: relative;
}

.search-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  gap: 20px;

  .search-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    .hero-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;

      .hero-icon {
        font-size: 48px;
      }

      .hero-text {
        font-weight: 800;
        font-size: 28px;
        letter-spacing: 1px;
      }
    }
  }

  .search-bar {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 500px;
  }
}

.tips-container {
  width: 100%;
  max-width: 500px;
  text-align: center;
  height: 20px;
  position: relative;
  margin-top: -8px;

  .tip-item {
    font-size: 12px;
    display: inline-block;
  }
}
</style>
