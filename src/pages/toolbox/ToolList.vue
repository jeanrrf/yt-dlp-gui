<script setup lang="ts">
import type { Component } from "vue";
import IconMdiImageOutline from "~icons/mdi/image-outline";
import IconMdiSubtitlesOutline from "~icons/mdi/subtitles-outline";
import IconMdiMessageTextOutline from "~icons/mdi/message-text-outline";

const router = useRouter();

interface ToolItem {
  key: string;
  icon: Component;
  color: string;
  bg: string;
  title: string;
  desc: string;
}

const tools: ToolItem[] = [
  {
    key: "thumbnail",
    icon: IconMdiImageOutline,
    color: "#18a058",
    bg: "rgba(24,160,88,0.1)",
    title: "下载视频封面",
    desc: "提取视频封面图并保存为 JPG 格式",
  },
  {
    key: "subtitles",
    icon: IconMdiSubtitlesOutline,
    color: "#2080f0",
    bg: "rgba(32,128,240,0.1)",
    title: "下载视频字幕",
    desc: "下载视频的字幕文件（支持多语言）",
  },
  {
    key: "livechat",
    icon: IconMdiMessageTextOutline,
    color: "#f0a020",
    bg: "rgba(240,160,32,0.1)",
    title: "获取直播弹幕",
    desc: "获取直播回放的聊天记录 / 弹幕数据",
  },
];

const navigateTo = (key: string) => {
  router.push({ name: `toolbox-${key}` });
};
</script>

<template>
  <n-flex vertical :size="8">
    <n-card
      v-for="tool in tools"
      :key="tool.key"
      size="small"
      hoverable
      class="tool-card"
      @click="navigateTo(tool.key)"
    >
      <n-flex align="center" :size="12" :wrap="false">
        <div class="tool-icon" :style="{ background: tool.bg }">
          <n-icon :size="20" :color="tool.color">
            <component :is="tool.icon" />
          </n-icon>
        </div>
        <div class="tool-info">
          <n-text strong>{{ tool.title }}</n-text>
          <n-text depth="3" class="tool-desc">{{ tool.desc }}</n-text>
        </div>
        <n-button type="primary" secondary size="small" @click.stop="navigateTo(tool.key)">
          使用
          <template #icon>
            <n-icon><icon-mdi-chevron-right /></n-icon>
          </template>
        </n-button>
      </n-flex>
    </n-card>
  </n-flex>
</template>

<style scoped lang="scss">
.tool-card {
  cursor: pointer;
  transition: transform 0.15s;
}

.tool-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tool-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  .tool-desc {
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
