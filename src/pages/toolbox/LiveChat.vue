<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { isValidUrl } from "@/utils/validate";
import { useSettingStore } from "@/stores/setting";
import { useStatusStore } from "@/stores/status";
import { useVideoStore } from "@/stores/video";
import type { LiveChatMessage } from "@/types";
import type { DataTableColumns, DataTableRowKey } from "naive-ui";

const settingStore = useSettingStore();
const statusStore = useStatusStore();
const videoStore = useVideoStore();
const toolUrl = inject<Ref<string>>("toolUrl")!;

const loading = ref(false);
const saving = ref(false);
const messages = ref<LiveChatMessage[]>([]);
const checkedKeys = ref<DataTableRowKey[]>([]);
const filterText = ref("");
const debouncedFilter = refDebounced(filterText, 300);
const useRegex = ref(false);

const urlValid = computed(() => isValidUrl(toolUrl.value.trim()));

// 可导出的字段定义
const fieldDefs = [
  { key: "time", label: "时间" },
  { key: "author", label: "发送者" },
  { key: "message", label: "消息内容" },
  { key: "msg_type", label: "类型" },
  { key: "amount", label: "打赏金额" },
  { key: "channel_id", label: "频道 ID" },
  { key: "timestamp_usec", label: "时间戳 (μs)" },
] as const;

type FieldKey = (typeof fieldDefs)[number]["key"];
const allFieldKeys = fieldDefs.map((f) => f.key);
const selectedFields = ref<FieldKey[]>([...allFieldKeys]);

const exportFormat = ref<"json" | "csv">("json");

// 字段全选
const allFieldsSelected = computed(() => selectedFields.value.length === allFieldKeys.length);
const someFieldsSelected = computed(
  () => selectedFields.value.length > 0 && selectedFields.value.length < allFieldKeys.length,
);
const handleFieldSelectAll = (checked: boolean) => {
  selectedFields.value = checked ? [...allFieldKeys] : [];
};

// 类型标签映射
const typeLabels: Record<string, string> = {
  text: "普通",
  paid: "打赏",
  membership: "会员",
};

// 筛选：关键词或正则
const filterRegex = computed(() => {
  const text = debouncedFilter.value.trim();
  if (!text) return null;
  if (useRegex.value) {
    try {
      return new RegExp(text, "i");
    } catch {
      return null;
    }
  }
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
});

const regexError = computed(() => {
  if (!useRegex.value || !filterText.value.trim()) return "";
  try {
    new RegExp(filterText.value.trim());
    return "";
  } catch (e) {
    return String(e).replace("SyntaxError: ", "");
  }
});

const filteredMessages = computed(() => {
  const re = filterRegex.value;
  if (!re) return messages.value;
  return messages.value.filter(
    (m) => re.test(m.message) || re.test(m.author),
  );
});

// 筛选结果变化时清空选中
watch(debouncedFilter, () => {
  checkedKeys.value = [];
});

// 数据表格列
const columns: DataTableColumns<LiveChatMessage> = [
  { type: "selection" },
  { title: "时间", key: "time", width: 100 },
  { title: "发送者", key: "author", width: 160, ellipsis: { tooltip: true } },
  {
    title: "消息内容",
    key: "message",
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: "类型",
    key: "msg_type",
    width: 80,
    render: (row) => typeLabels[row.msg_type] || row.msg_type,
  },
  { title: "金额", key: "amount", width: 100 },
];

const rowKey = (row: LiveChatMessage) => row.idx;

/** 获取弹幕数据 */
const handleFetch = async () => {
  loading.value = true;
  messages.value = [];
  checkedKeys.value = [];
  filterText.value = "";
  try {
    const cookieFile = await videoStore.getCookieFile();
    const result = await invoke<LiveChatMessage[]>("tool_fetch_live_chat", {
      url: toolUrl.value.trim(),
      cookieFile,
      proxy: settingStore.proxy || null,
    });
    messages.value = result;
  } catch (e: unknown) {
    const msg = String(e);
    if (/sign in|cookies/i.test(msg)) {
      statusStore.showCookieModal = true;
    } else {
      window.$message.error(`获取失败: ${msg}`);
    }
  } finally {
    loading.value = false;
  }
};

/** 构建导出数据：有选中导出选中行，否则导出筛选后的全部行 */
const buildExportData = () => {
  const keys = selectedFields.value;
  const checkedSet = new Set(checkedKeys.value);
  const source =
    checkedKeys.value.length > 0
      ? filteredMessages.value.filter((m) => checkedSet.has(m.idx))
      : filteredMessages.value;
  return source.map((msg) => {
    const obj: Record<string, unknown> = {};
    for (const key of keys) {
      obj[key] = msg[key];
    }
    return obj;
  });
};

const exportJson = (data: Record<string, unknown>[]) => {
  return JSON.stringify(data, null, 2);
};

const exportCsv = (data: Record<string, unknown>[]) => {
  if (data.length === 0) return "";
  const keys = Object.keys(data[0]);
  const header = keys.map((k) => `"${k}"`).join(",");
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val = String(row[k] ?? "");
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  return [header, ...rows].join("\r\n");
};

/** 导出条数提示 */
const exportCount = computed(() => {
  if (checkedKeys.value.length > 0) return checkedKeys.value.length;
  return filteredMessages.value.length;
});

/** 另存为文件 */
const handleSave = async () => {
  if (selectedFields.value.length === 0) {
    window.$message.warning("请至少选择一个导出字段");
    return;
  }

  const ext = exportFormat.value;
  const filePath = await save({
    title: "保存弹幕数据",
    defaultPath: `live_chat.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  if (!filePath) return;

  saving.value = true;
  try {
    const data = buildExportData();
    const content = ext === "json" ? exportJson(data) : exportCsv(data);
    await invoke("tool_save_text_to_file", { content, filePath });
    window.$message.success("弹幕数据已保存");
  } catch (e: unknown) {
    window.$message.error(`保存失败: ${e}`);
  } finally {
    saving.value = false;
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
      <n-text strong style="font-size: 15px">获取直播弹幕</n-text>
    </n-flex>

    <n-card size="small">
      <n-flex vertical :size="12">
        <n-text depth="3" style="font-size: 13px">
          获取直播回放的全部聊天弹幕，支持筛选字段后导出为 JSON 或 CSV
        </n-text>
        <n-button
          type="primary"
          :loading="loading"
          :disabled="!urlValid || loading"
          @click="handleFetch"
        >
          <template #icon>
            <n-icon><icon-mdi-message-text-outline /></n-icon>
          </template>
          获取弹幕
        </n-button>
      </n-flex>
    </n-card>

    <!-- 弹幕数据表格 -->
    <n-card v-if="messages.length" size="small" :title="`共 ${messages.length} 条弹幕`">
      <template #header-extra>
        <n-flex align="center" :size="8">
          <n-popover trigger="click" placement="bottom-end">
            <template #trigger>
              <n-button size="small" secondary>
                <template #icon>
                  <n-icon><icon-mdi-filter-outline /></n-icon>
                </template>
                导出字段
              </n-button>
            </template>
            <n-flex vertical :size="8" style="min-width: 140px">
              <n-checkbox
                :checked="allFieldsSelected"
                :indeterminate="someFieldsSelected"
                @update:checked="handleFieldSelectAll"
              >
                全选
              </n-checkbox>
              <n-checkbox-group v-model:value="selectedFields">
                <n-flex vertical :size="4">
                  <n-checkbox v-for="f in fieldDefs" :key="f.key" :value="f.key">
                    {{ f.label }}
                  </n-checkbox>
                </n-flex>
              </n-checkbox-group>
            </n-flex>
          </n-popover>
          <n-select
            v-model:value="exportFormat"
            :options="[
              { label: 'JSON', value: 'json' },
              { label: 'CSV', value: 'csv' },
            ]"
            size="small"
            style="width: 90px"
          />
          <n-button
            size="small"
            :loading="saving"
            :disabled="selectedFields.length === 0 || saving"
            @click="handleSave"
          >
            <template #icon>
              <n-icon><icon-mdi-content-save-outline /></n-icon>
            </template>
            另存为 ({{ exportCount }})
          </n-button>
        </n-flex>
      </template>

      <!-- 筛选输入框 -->
      <n-flex vertical :size="10">
        <n-flex align="center" :size="8">
          <n-input
            v-model:value="filterText"
            placeholder="搜索消息内容或发送者..."
            size="small"
            clearable
            style="flex: 1"
            :status="regexError ? 'error' : undefined"
          >
            <template #prefix>
              <n-icon><icon-mdi-magnify /></n-icon>
            </template>
          </n-input>
          <n-tooltip>
            <template #trigger>
              <n-button
                size="small"
                :type="useRegex ? 'primary' : 'default'"
                :secondary="useRegex"
                :quaternary="!useRegex"
                @click="useRegex = !useRegex"
                style="font-family: monospace; font-weight: bold; width: 32px"
              >
                .*
              </n-button>
            </template>
            {{ useRegex ? '正则模式已开启' : '点击启用正则匹配' }}
          </n-tooltip>
        </n-flex>
        <n-text
          v-if="filterText && !regexError"
          depth="3"
          style="font-size: 12px"
        >
          匹配 {{ filteredMessages.length }} / {{ messages.length }} 条
        </n-text>
        <n-text v-if="regexError" type="error" style="font-size: 12px">
          {{ regexError }}
        </n-text>

        <n-data-table
          v-model:checked-row-keys="checkedKeys"
          :columns="columns"
          :data="filteredMessages"
          :row-key="rowKey"
          virtual-scroll
          :max-height="480"
          size="small"
          bordered
        />
      </n-flex>
    </n-card>
  </n-flex>
</template>
