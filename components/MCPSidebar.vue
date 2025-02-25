// components/MCPSidebar.vue
<script setup lang="ts">
import { log } from "console";
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

const toast = useToast();

const props = defineProps<{
  activeSessionId?: string;
}>();

const router = useRouter();
const route = useRoute();
const sessions = ref<Array<{ id: string; date: string; messageCount: number }>>(
  []
);
const isLoading = ref(true);
const error = ref<string | null>(null);
const isCollapsed = ref(false);
const searchQuery = ref("");
const showNewChatModal = ref(false);
const newChatName = ref("");
const darkMode = ref(false);

// 获取所有会话列表
async function fetchSessions() {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch("/api/mcp-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "listSessions",
      }),
    });

    if (!response.ok) throw new Error("无法获取会话列表");

    const data = await response.json();
    sessions.value = data.sessions || [];
  } catch (err: any) {
    console.error("加载会话列表失败:", err);
    error.value = err.message || "无法加载会话列表";
  } finally {
    isLoading.value = false;
  }
}

// 搜索过滤的会话
const filteredSessions = computed(() => {
  if (!searchQuery.value) return sessions.value;

  const query = searchQuery.value.toLowerCase();
  return sessions.value.filter((session) =>
    session.id.toLowerCase().includes(query)
  );
});

// 格式化会话ID为更友好的显示
function formatSessionId(id: string) {
  // 从ID中移除前缀，只保留随机部分的前8个字符
  if (id.startsWith("mcp-")) {
    return id.substring(4, 12).toUpperCase();
  }
  return id.substring(0, 8).toUpperCase();
}

// 格式化日期为相对时间
function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString();
}

// 选择会话
function selectSession(sessionId: string) {
  router.push(`/mcp/${sessionId}`);
}

// 创建新会话
function createNewChat() {
  router.push("/mcp/new");
  showNewChatModal.value = false;
}

// 删除会话
async function deleteSession(sessionId: string, event: Event) {
  event.stopPropagation(); // 阻止事件冒泡到父元素

  try {
    const confirmed = await useConfirm("确定要删除这个会话吗?", {
      title: "删除会话",
      buttonColor: "red",
      confirmText: "删除",
      cancelText: "取消",
    });

    if (!confirmed) return;

    const response = await fetch("/api/mcp-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "delete",
        conversationId: sessionId,
      }),
    });

    if (!response.ok) throw new Error("删除会话失败");

    // 从列表中移除会话
    sessions.value = sessions.value.filter((s) => s.id !== sessionId);

    // 如果删除的是当前会话，则重定向到新会话
    if (props.activeSessionId === sessionId) {
      router.push("/mcp/new");
    }

    toast.add({ title: "会话已删除", timeout: 3000 });
  } catch (err: any) {
    console.error("删除会话失败:", err);
    toast.add({ title: err.message || "删除会话失败", timeout: 3000 });
  }
}

// 切换暗黑模式
function toggleDarkMode() {
  darkMode.value = !darkMode.value;
  document.documentElement.classList.toggle("dark", darkMode.value);
}

// 初始化暗黑模式状态
onMounted(() => {
  darkMode.value = document.documentElement.classList.contains("dark");

  // 定期刷新会话列表
  fetchSessions();
  const refreshInterval = setInterval(fetchSessions, 30000); // 每30秒刷新一次

  // 清理定时器
  onUnmounted(() => {
    clearInterval(refreshInterval);
  });
});

// 监听路由变化，自动刷新会话列表
watch(
  () => route.params.id,
  () => {
    fetchSessions();
  }
);
</script>

<template>
  <div
    class="fixed top-0 bottom-0 left-0 z-10 flex flex-col h-full transition-all duration-300 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    :class="isCollapsed ? 'w-16' : 'w-72'"
  >
    <!-- 收起/展开按钮 -->
    <UButton
      color="primary"
      variant="ghost"
      class="absolute z-20 p-1 rounded-full shadow-sm -right-3 top-4"
      :icon="
        isCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'
      "
      @click="isCollapsed = !isCollapsed"
      square
    />

    <div class="flex flex-col w-full h-full">
      <!-- 标题和控制区 -->
      <div
        class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700"
      >
        <div v-if="!isCollapsed" class="flex items-center space-x-2">
          <UIcon
            name="i-heroicons-chat-bubble-left-right"
            class="w-5 h-5 text-primary-500"
          />
          <h2 class="text-lg font-bold">对话列表</h2>
        </div>
        <UIcon
          v-else
          name="i-heroicons-chat-bubble-left-right"
          class="w-6 h-6 mx-auto text-primary-500"
        />

        <div v-if="!isCollapsed" class="flex space-x-2">
          <UButton
            color="gray"
            variant="ghost"
            :icon="darkMode ? 'i-heroicons-sun' : 'i-heroicons-moon'"
            @click="toggleDarkMode"
            square
            size="xs"
          />
          <UButton
            color="primary"
            variant="ghost"
            icon="i-heroicons-arrow-path"
            @click="fetchSessions"
            square
            size="xs"
            :loading="isLoading"
          />
        </div>
      </div>

      <!-- 搜索框 -->
      <div v-if="!isCollapsed" class="p-3">
        <UInput
          v-model="searchQuery"
          placeholder="搜索会话..."
          icon="i-heroicons-magnifying-glass"
          size="sm"
          color="gray"
          class="w-full"
        />
      </div>

      <!-- 新建会话按钮 -->
      <div class="p-3">
        <UButton
          v-if="!isCollapsed"
          block
          color="primary"
          @click="createNewChat"
          class="justify-start"
        >
          <template #leading>
            <UIcon name="i-heroicons-plus" />
          </template>
          新建会话
        </UButton>
        <UButton
          v-else
          color="primary"
          variant="ghost"
          icon="i-heroicons-plus"
          class="w-10 h-10 mx-auto"
          square
          @click="createNewChat"
        />
      </div>

      <!-- 加载中状态 -->
      <div v-if="isLoading" class="flex items-center justify-center flex-1 p-4">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="p-3">
        <UAlert
          :title="isCollapsed ? '' : '加载失败'"
          color="red"
          variant="soft"
          :icon="isCollapsed ? 'i-heroicons-exclamation-triangle' : ''"
        >
          <p v-if="!isCollapsed">{{ error }}</p>
        </UAlert>
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="filteredSessions.length === 0"
        class="flex flex-col items-center justify-center flex-1 p-4 text-center text-gray-500 dark:text-gray-400"
      >
        <UIcon
          v-if="searchQuery"
          name="i-heroicons-magnifying-glass"
          class="w-8 h-8 mb-2"
        />
        <UIcon
          v-else
          name="i-heroicons-chat-bubble-bottom-center-text"
          class="w-8 h-8 mb-2"
        />
        <p v-if="!isCollapsed">
          {{ searchQuery ? "未找到相关会话" : "暂无会话记录" }}
        </p>
      </div>

      <!-- 会话列表 -->
      <div v-else class="flex-1 overflow-y-auto">
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="relative group"
        >
          <UButton
            block
            :color="session.id === activeSessionId ? 'primary' : 'gray'"
            :variant="session.id === activeSessionId ? 'soft' : 'ghost'"
            class="justify-start px-3 py-3 text-left rounded-none"
            @click="selectSession(session.id)"
          >
            <template v-if="!isCollapsed">
              <div class="flex flex-col w-full overflow-hidden">
                <div class="flex items-center justify-between">
                  <span class="font-medium truncate">{{
                    formatSessionId(session.id)
                  }}</span>
                  <UBadge size="xs" color="gray" variant="soft">{{
                    session.messageCount
                  }}</UBadge>
                </div>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{
                  formatRelativeTime(session.date)
                }}</span>
              </div>
            </template>
            <template v-else>
              <div class="flex flex-col items-center">
                <span class="text-xs font-bold">{{
                  formatSessionId(session.id).substring(0, 2)
                }}</span>
                <UBadge size="xs" color="gray" variant="soft">{{
                  session.messageCount
                }}</UBadge>
              </div>
            </template>
          </UButton>

          <!-- 删除按钮 (仅在展开和悬停时显示) -->
          <UButton
            v-if="!isCollapsed"
            color="red"
            variant="ghost"
            icon="i-heroicons-trash"
            size="xs"
            class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            @click="(e) => deleteSession(session.id, e)"
            square
          />
        </div>
      </div>

      <!-- 底部工具栏 -->
      <div
        v-if="!isCollapsed"
        class="p-3 mt-auto border-t border-gray-200 dark:border-gray-700"
      >
        <UButton
          block
          color="gray"
          variant="ghost"
          class="justify-start"
          icon="i-heroicons-information-circle"
          to="/mcp/help"
        >
          帮助 & 关于
        </UButton>
      </div>
      <div
        v-else
        class="p-3 mt-auto border-t border-gray-200 dark:border-gray-700"
      >
        <UButton
          color="gray"
          variant="ghost"
          icon="i-heroicons-information-circle"
          class="mx-auto"
          square
          to="/mcp/help"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 自定义滚动条 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.8);
}

/* 暗黑模式滚动条 */
.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.8);
}
</style>
