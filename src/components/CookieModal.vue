<script setup lang="ts">
import { useStatusStore } from "@/stores/status";

const statusStore = useStatusStore();
</script>

<template>
  <n-modal
    v-model:show="statusStore.showCookieModal"
    preset="card"
    title="需要 Cookie 验证"
    size="small"
    :bordered="false"
    :style="{ width: '480px' }"
  >
    <n-flex vertical :size="12">
      <n-alert type="warning" :bordered="false">目标网站要求登录验证，请配置 Cookie 后重试</n-alert>
      <CookieCard />
    </n-flex>
  </n-modal>
</template>
