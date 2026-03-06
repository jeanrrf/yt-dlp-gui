<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { isValidUrl } from "@/utils/validate";
import { useSettingStore } from "@/stores/setting";
import { useVideoStore } from "@/stores/video";

const settingStore = useSettingStore();
const videoStore = useVideoStore();
const toolUrl = inject<Ref<string>>("toolUrl")!;

const loading = ref(false);
const downloadDir = ref(settingStore.downloadDir || "");
const subLangs = ref("all");
const writeAutoSubs = ref(false);

const urlValid = computed(() => isValidUrl(toolUrl.value.trim()));

const handleSelectDir = async () => {
  const selected = await open({ directory: true, multiple: false, title: "选择保存目录" });
  if (selected) downloadDir.value = selected as string;
};

const handleExecute = async () => {
  if (!downloadDir.value) {
    window.$message.warning("请先选择保存目录");
    return;
  }
  loading.value = true;
  try {
    const cookieFile = await videoStore.getCookieFile();
    await invoke("tool_download_subtitles", {
      url: toolUrl.value.trim(),
      downloadDir: downloadDir.value,
      subLangs: subLangs.value,
      writeAutoSubs: writeAutoSubs.value,
      cookieFile,
      proxy: settingStore.proxy || null,
    });
    window.$message.success("字幕下载完成");
  } catch (e: unknown) {
    window.$message.error(`下载失败: ${e}`);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <n-flex vertical :size="12">
    <n-flex align="center" :size="8">
      <n-button strong secondary size="small" @click="$router.back()">
        <template #icon>
          <n-icon><icon-mdi-arrow-left /></n-icon>
        </template>
        返回
      </n-button>
      <n-text strong style="font-size: 15px">下载视频字幕</n-text>
    </n-flex>

    <n-card size="small">
      <n-flex vertical :size="12">
        <n-text depth="3" style="font-size: 13px">
          下载视频的字幕文件，支持指定语言代码（如 en, zh-Hans, all）
        </n-text>
        <n-flex align="center" :size="8">
          <n-input
            v-model:value="downloadDir"
            placeholder="选择保存目录"
            readonly
            size="small"
            style="flex: 1"
          />
          <n-button size="small" @click="handleSelectDir">
            <template #icon>
              <n-icon><icon-mdi-folder-open-outline /></n-icon>
            </template>
            选择
          </n-button>
        </n-flex>
        <n-flex align="center" :size="8">
          <n-input
            v-model:value="subLangs"
            placeholder="字幕语言，如 all, en, zh-Hans"
            size="small"
            style="flex: 1"
          />
          <n-checkbox v-model:checked="writeAutoSubs" size="small">
            包含自动生成字幕
          </n-checkbox>
        </n-flex>
        <n-button
          type="primary"
          :loading="loading"
          :disabled="!urlValid || loading || !downloadDir"
          @click="handleExecute"
        >
          <template #icon>
            <n-icon><icon-mdi-download /></n-icon>
          </template>
          下载字幕
        </n-button>
      </n-flex>
    </n-card>
  </n-flex>
</template>
