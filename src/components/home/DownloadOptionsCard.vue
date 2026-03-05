<script setup lang="ts">
import { formatFileSize } from "@/utils/format";
import type { VideoFormat } from "@/types";

const props = defineProps<{
  videoFormats: VideoFormat[];
  audioFormats: VideoFormat[];
}>();

const downloadMode = defineModel<"default" | "video" | "audio">("downloadMode", {
  required: true,
});
const selectedVideoFormat = defineModel<string>("selectedVideoFormat", {
  required: true,
});
const selectedAudioFormat = defineModel<string>("selectedAudioFormat", {
  required: true,
});

/** 视频格式下拉选项 */
const videoFormatOptions = computed(() =>
  props.videoFormats.map((f) => ({
    label: `${f.height}p${f.fps ? ` ${f.fps}fps` : ""} · ${f.ext} · ${f.filesize || f.filesize_approx ? formatFileSize(f.filesize || f.filesize_approx || 0) : "未知大小"}`,
    value: f.format_id,
  })),
);

/** 音频格式下拉选项 */
const audioFormatOptions = computed(() =>
  props.audioFormats.map((f) => ({
    label: `${f.abr ? f.abr + "kbps" : f.format_note} · ${f.ext} · ${f.filesize || f.filesize_approx ? formatFileSize(f.filesize || f.filesize_approx || 0) : "未知大小"}`,
    value: f.format_id,
  })),
);
</script>

<template>
  <n-card title="下载方式" size="small">
    <n-flex vertical :size="12">
      <n-radio-group v-model:value="downloadMode" size="small">
        <n-radio-button value="default">默认</n-radio-button>
        <n-radio-button value="video">仅视频</n-radio-button>
        <n-radio-button value="audio">仅音频</n-radio-button>
      </n-radio-group>

      <n-flex
        v-if="downloadMode !== 'audio' && videoFormatOptions.length"
        align="center"
        :size="8"
      >
        <n-text depth="3" style="font-size: 13px; flex-shrink: 0">
          视频
        </n-text>
        <n-select
          v-model:value="selectedVideoFormat"
          :options="videoFormatOptions"
          size="small"
        />
      </n-flex>

      <n-flex
        v-if="downloadMode !== 'video' && audioFormatOptions.length"
        align="center"
        :size="8"
      >
        <n-text depth="3" style="font-size: 13px; flex-shrink: 0">
          音频
        </n-text>
        <n-select
          v-model:value="selectedAudioFormat"
          :options="audioFormatOptions"
          size="small"
        />
      </n-flex>
    </n-flex>
  </n-card>
</template>
