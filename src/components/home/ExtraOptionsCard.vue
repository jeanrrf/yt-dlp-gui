<script setup lang="ts">
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
const noMerge = defineModel<boolean>("noMerge", { required: true });
const recodeFormat = defineModel<string>("recodeFormat", { required: true });
const limitRate = defineModel<string>("limitRate", { required: true });

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
  { label: "1M/s", value: "1M" },
  { label: "2M/s", value: "2M" },
  { label: "5M/s", value: "5M" },
  { label: "10M/s", value: "10M" },
  { label: "500K/s", value: "500K" },
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
    <n-flex vertical :size="12">
      <!-- 时间裁剪 -->
      <n-flex align="center" :size="8">
        <n-text depth="3" style="font-size: 13px; flex-shrink: 0">
          时间裁剪
        </n-text>
        <n-time-picker
          v-model:value="startTime"
          placeholder="开始时间"
          size="small"
          clearable
          format="HH:mm:ss"
          style="width: 130px"
          :actions="[]"
        />
        <n-text depth="3">—</n-text>
        <n-time-picker
          v-model:value="endTime"
          placeholder="结束时间"
          size="small"
          clearable
          format="HH:mm:ss"
          style="width: 130px"
          :actions="[]"
        />
      </n-flex>

      <!-- 转换格式 -->
      <n-flex align="center" :size="8">
        <n-text depth="3" style="font-size: 13px; flex-shrink: 0">
          转换格式
        </n-text>
        <n-select
          v-model:value="recodeFormat"
          :options="recodeOptions"
          size="small"
          style="width: 130px"
        />
      </n-flex>

      <!-- 限速 -->
      <n-flex align="center" :size="8">
        <n-text depth="3" style="font-size: 13px; flex-shrink: 0">
          下载限速
        </n-text>
        <n-select
          v-model:value="limitRate"
          :options="limitRateOptions"
          size="small"
          style="width: 130px"
        />
      </n-flex>

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
        <n-checkbox v-model:checked="noMerge" size="small">
          不合并音视频
        </n-checkbox>
      </n-flex>
    </n-flex>
  </n-card>
</template>
