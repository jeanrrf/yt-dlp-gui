<script setup lang="ts">
import { useSettingStore } from "@/stores/setting";

const settingStore = useSettingStore();

const startTime = defineModel<number | null>("startTime", {
  required: true,
});
const endTime = defineModel<number | null>("endTime", {
  required: true,
});
const embedSubs = defineModel<boolean>("embedSubs", { required: true });
const embedThumbnail = defineModel<boolean>("embedThumbnail", {
  required: true,
});
const embedMetadata = defineModel<boolean>("embedMetadata", {
  required: true,
});
const embedChapters = defineModel<boolean>("embedChapters", {
  required: true,
});
const sponsorblockRemove = defineModel<boolean>("sponsorblockRemove", {
  required: true,
});
const extractAudio = defineModel<boolean>("extractAudio", {
  required: true,
});
const audioConvertFormat = defineModel<string>("audioConvertFormat", {
  required: true,
});
const noMerge = defineModel<boolean>("noMerge", { required: true });
const recodeFormat = defineModel<string>("recodeFormat", { required: true });
const limitRate = defineModel<string>("limitRate", { required: true });

// 文件名模板预设
const DEFAULT_TEMPLATE = "%(title).200s.%(ext)s";
const outputTemplatePresets = [
  { label: "默认", value: DEFAULT_TEMPLATE },
  { label: "标题 + 画质", value: "%(title).200s [%(height)sp].%(ext)s" },
  { label: "作者 - 标题", value: "%(uploader)s - %(title).200s.%(ext)s" },
  { label: "日期 - 标题", value: "%(upload_date)s - %(title).200s.%(ext)s" },
  { label: "标题 + ID", value: "%(title).200s [%(id)s].%(ext)s" },
  { label: "自定义", value: "__custom__" },
];

// 可快速插入的模板变量（扩展名由 yt-dlp 自动处理，不允许自定义）
const templateVars = [
  { label: "标题", value: "%(title)s" },
  { label: "作者", value: "%(uploader)s" },
  { label: "日期", value: "%(upload_date)s" },
  { label: "ID", value: "%(id)s" },
  { label: "画质", value: "%(height)sp" },
  { label: "分辨率", value: "%(resolution)s" },
  { label: "时长", value: "%(duration)s" },
];

const EXT_SUFFIX = ".%(ext)s";

// 当前选中的预设值，"__custom__" 表示自定义模式
const getInitialPreset = () => {
  const cur = settingStore.outputTemplate;
  const match = outputTemplatePresets.find(
    (p) => p.value !== "__custom__" && p.value === cur,
  );
  return match ? cur : "__custom__";
};
const selectedPreset = ref(getInitialPreset());

const customMode = computed(() => selectedPreset.value === "__custom__");

const handleTemplateSelect = (val: string) => {
  selectedPreset.value = val;
  if (val !== "__custom__") {
    settingStore.outputTemplate = val;
  }
};

// 编辑的是不含扩展名后缀的部分
const templateBase = computed({
  get: () => {
    const cur = settingStore.outputTemplate;
    return cur.endsWith(EXT_SUFFIX)
      ? cur.slice(0, -EXT_SUFFIX.length)
      : cur;
  },
  set: (val: string) => {
    settingStore.outputTemplate = val + EXT_SUFFIX;
  },
});

const resetTemplate = () => {
  settingStore.outputTemplate = DEFAULT_TEMPLATE;
};

const insertVar = (v: string) => {
  templateBase.value = templateBase.value + " " + v;
};

const recodeOptions = [
  { label: "不转换", value: "" },
  { label: "MP4", value: "mp4" },
  { label: "MKV", value: "mkv" },
  { label: "WebM", value: "webm" },
  { label: "MP3", value: "mp3" },
  { label: "FLAC", value: "flac" },
];

const limitRateOptions = [
  { label: "不限速", value: "" },
  { label: "500K/s", value: "500K" },
  { label: "1M/s", value: "1M" },
  { label: "2M/s", value: "2M" },
  { label: "5M/s", value: "5M" },
  { label: "10M/s", value: "10M" },
];

const audioConvertOptions = [
  { label: "不转换", value: "" },
  { label: "MP3", value: "mp3" },
  { label: "FLAC", value: "flac" },
  { label: "WAV", value: "wav" },
  { label: "AAC", value: "aac" },
  { label: "OPUS", value: "opus" },
  { label: "M4A", value: "m4a" },
];

/** 开始时间变化时，若结束时间早于等于开始时间则清空 */
watch(startTime, (val) => {
  if (val != null && endTime.value != null && endTime.value <= val) {
    endTime.value = null;
  }
});

/** 结束时间变化时，若早于等于开始时间则清空并提示 */
watch(endTime, (val) => {
  if (val != null && startTime.value != null && val <= startTime.value) {
    endTime.value = null;
    window.$message.warning("结束时间不能早于或等于开始时间");
  }
});
</script>

<template>
  <n-card title="额外选项" size="small">
    <n-flex vertical :size="14">
      <!-- 文件名模板 -->
      <div class="option-grid">
        <span class="option-label">文件名</span>
        <n-flex vertical :size="6" style="flex: 1; min-width: 0">
          <n-select
            :value="selectedPreset"
            :options="outputTemplatePresets"
            size="small"
            @update:value="handleTemplateSelect"
          />
          <template v-if="customMode">
            <n-flex align="center" :size="6">
              <n-input
                v-model:value="templateBase"
                placeholder="%(title).200s"
                size="small"
                style="flex: 1"
              >
                <template #suffix>
                  <n-text depth="3" style="font-size: 12px; white-space: nowrap">.%(ext)s</n-text>
                </template>
              </n-input>
              <n-button size="small" secondary @click="resetTemplate">
                <template #icon>
                  <n-icon size="14"><icon-mdi-refresh /></n-icon>
                </template>
              </n-button>
            </n-flex>
            <n-flex :size="6" wrap>
              <n-tag
                v-for="v in templateVars"
                :key="v.value"
                size="small"
                round
                :bordered="false"
                style="cursor: pointer"
                @click="insertVar(v.value)"
              >
                {{ v.label }}
              </n-tag>
            </n-flex>
          </template>
        </n-flex>
      </div>

      <!-- 时间裁剪 -->
      <div class="option-grid">
        <span class="option-label">时间裁剪</span>
        <n-flex align="center" :size="8">
          <n-time-picker
            v-model:value="startTime"
            placeholder="开始"
            size="small"
            clearable
            format="HH:mm:ss"
            style="width: 120px"
            :actions="[]"
          />
          <n-text depth="3">—</n-text>
          <n-time-picker
            v-model:value="endTime"
            placeholder="结束"
            size="small"
            clearable
            format="HH:mm:ss"
            style="width: 120px"
            :actions="[]"
          />
        </n-flex>
      </div>

      <!-- 格式与限速 -->
      <n-flex :size="16" wrap>
        <div class="option-grid">
          <span class="option-label">转换格式</span>
          <n-select
            v-model:value="recodeFormat"
            :options="recodeOptions"
            size="small"
            style="width: 110px"
          />
        </div>
        <div class="option-grid">
          <span class="option-label">下载限速</span>
          <n-select
            v-model:value="limitRate"
            :options="limitRateOptions"
            size="small"
            style="width: 110px"
          />
        </div>
      </n-flex>

      <!-- 提取音频 -->
      <div class="option-grid">
        <n-checkbox v-model:checked="extractAudio" size="small">
          提取音频
        </n-checkbox>
        <n-select
          v-model:value="audioConvertFormat"
          :options="audioConvertOptions"
          :style="{ visibility: extractAudio ? 'visible' : 'hidden' }"
          size="small"
          style="width: 110px"
          placeholder="音频格式"
        />
      </div>

      <n-divider style="margin: 0" />

      <!-- 开关选项 -->
      <n-flex :size="[16, 8]" wrap>
        <n-checkbox v-model:checked="embedSubs" size="small">
          嵌入字幕
        </n-checkbox>
        <n-checkbox v-model:checked="embedThumbnail" size="small">
          嵌入缩略图
        </n-checkbox>
        <n-checkbox v-model:checked="embedMetadata" size="small">
          嵌入元数据
        </n-checkbox>
        <n-checkbox v-model:checked="embedChapters" size="small">
          嵌入章节
        </n-checkbox>
        <n-checkbox v-model:checked="sponsorblockRemove" size="small">
          跳过赞助片段
        </n-checkbox>
        <n-checkbox v-model:checked="noMerge" size="small">
          不合并音视频
        </n-checkbox>
      </n-flex>
    </n-flex>
  </n-card>
</template>

<style scoped lang="scss">
.option-grid {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label {
  font-size: 13px;
  color: var(--n-text-color-3, #999);
  flex-shrink: 0;
  min-width: 56px;
}
</style>
