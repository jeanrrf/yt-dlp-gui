<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingStore } from "@/stores/setting";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const settingStore = useSettingStore();

const cookieModeOptions = computed(() => [
  { label: t("cookie.none"), value: "none" },
  { label: t("cookie.manual"), value: "text" },
  { label: t("cookie.file"), value: "file" },
]);

/** 保存 Cookie 文本到应用数据目录 */
const handleSaveCookieText = async () => {
  if (!settingStore.cookieText.trim()) {
    window.$message.warning(t("cookie.emptyContent"));
    return;
  }
  try {
    const path = await invoke<string>("save_cookie_text", {
      text: settingStore.cookieText,
    });
    window.$message.success(t("cookie.savedTo", { path }));
  } catch (e: unknown) {
    window.$message.error(t("common.saveFailed", { e }));
  }
};

/** 选择 Cookie 文件 */
const handleSelectFile = async () => {
  const selected = await open({
    multiple: false,
    title: t("cookie.selectFile"),
    filters: [
      { name: t("cookie.cookieFiles"), extensions: ["txt", "cookie", "cookies"] },
      { name: t("cookie.allFiles"), extensions: ["*"] },
    ],
  });
  if (selected) {
    settingStore.cookieFile = selected as string;
  }
};
</script>

<template>
  <n-card title="Cookie" size="small">
    <n-flex vertical :size="12">
      <n-text depth="3" style="font-size: 13px">
        {{ $t('cookie.desc') }}
      </n-text>

      <n-radio-group v-model:value="settingStore.cookieMode" size="small">
        <n-radio-button
          v-for="opt in cookieModeOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </n-radio-button>
      </n-radio-group>

      <template v-if="settingStore.cookieMode === 'text'">
        <n-input
          v-model:value="settingStore.cookieText"
          type="textarea"
          :placeholder="$t('cookie.textPlaceholder')"
          :autosize="{ minRows: 3, maxRows: 8 }"
          size="small"
        />
        <n-flex justify="end">
          <n-button
            size="small"
            :disabled="!settingStore.cookieText.trim()"
            @click="handleSaveCookieText"
          >
            <template #icon>
              <n-icon>
                <icon-mdi-content-save-outline />
              </n-icon>
            </template>
            {{ $t('common.save') }}
          </n-button>
        </n-flex>
      </template>

      <template v-if="settingStore.cookieMode === 'file'">
        <n-flex align="center" :size="8">
          <n-input
            :value="settingStore.cookieFile"
            :placeholder="$t('cookie.noFileSelected')"
            size="small"
            readonly
            style="flex: 1"
          />
          <n-button size="small" @click="handleSelectFile">
            <template #icon>
              <n-icon>
                <icon-mdi-file-search-outline />
              </n-icon>
            </template>
            {{ $t('common.select') }}
          </n-button>
        </n-flex>
      </template>
    </n-flex>
  </n-card>
</template>
