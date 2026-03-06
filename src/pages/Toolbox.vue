<script setup lang="ts">
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { isValidUrl } from "@/utils/validate";

const toolUrl = ref("");
provide("toolUrl", toolUrl);

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
    toolUrl.value = trimmed;
  } catch {
    window.$message.warning("无法读取剪贴板");
  }
};
</script>

<template>
  <div class="toolbox-page">
    <!-- URL 输入 -->
    <n-flex :size="8">
      <n-input
        v-model:value="toolUrl"
        placeholder="请输入视频链接..."
        clearable
        style="flex: 1"
      />
      <n-button strong secondary @click="handlePaste">
        <template #icon>
          <n-icon><icon-mdi-content-paste /></n-icon>
        </template>
        粘贴
      </n-button>
    </n-flex>

    <router-view v-slot="{ Component: RouteComponent }">
      <Transition name="fade-slide" mode="out-in">
        <component :is="RouteComponent" />
      </Transition>
    </router-view>
  </div>
</template>

<style scoped lang="scss">
.toolbox-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
