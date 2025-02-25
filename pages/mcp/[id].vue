// pages/mcp/[id].vue
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useChat } from "@ai-sdk/vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios"; // 导入 axios
// 导入侧边栏组件
import MCPSidebar from "~/components/MCPSidebar.vue";
const toast = useToast();
// 获取路由和路由参数
const route = useRoute();
const router = useRouter();
const sessionIdFromRoute = computed(() => route.params.id as string);

// MCP会话相关类型声明
type MCPSession = {
  conversationId: string;
  metadata: Record<string, any>;
  createdAt: string;
  messageCount: number;
  updatedAt?: string;
};

// 当前会话状态
const activeSession = ref<MCPSession | null>(null);
const initializing = ref(true);
const error = ref<string | null>(null);
const chatContainerRef = ref<HTMLElement | null>(null);
const isPending = ref(false);

// 为useChat提供固定ID，避免循环引用
const chatId = ref("mcp-session");

// 加载会话消息历史
async function loadSessionMessages(sessionId: string) {
  try {
    console.log("加载会话消息历史:", sessionId);

    const response = await axios.post("/api/mcp-chat", {
      action: "getMessages",
      conversationId: sessionId,
    });

    return response.data.messages || [];
  } catch (err) {
    console.error("加载会话消息失败:", err);
    error.value = "无法加载消息历史。";
    return [];
  }
}

// useChat hook配置
const {
  messages,
  input,
  handleSubmit,
  isLoading,
  error: chatError,
  stop,
  setMessages,
} = useChat({
  api: "/api/mcp-chat", // 使用统一的API端点
  id: chatId as unknown as string, // 使用固定的引用，避免计算属性
  initialMessages: [
    {
      id: "system-prompt",
      role: "system",
      content: "You are a helpful assistant.",
    },
  ],
  onResponse(response) {
    console.log("Chat response status:", response.status);
    if (!response.ok) {
      error.value = `API error: ${response.statusText}`;
    }
  },
  onFinish() {
    console.log(
      "Chat finished, active session:",
      activeSession.value?.conversationId
    );
    // 更新会话信息
    updateSessionInfo();

    // 滚动到底部
    scrollToBottom();
  },
});

// 计算属性
const isSessionActive = computed(() => !!activeSession.value?.conversationId);
const disabled = computed(() => isLoading.value || !isSessionActive.value);

// 监听消息变化，自动滚动到底部
watch(messages, () => {
  scrollToBottom();
});

// 滚动到底部函数
function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
}

// 监听路由参数变化
watch(
  sessionIdFromRoute,
  async (newId) => {
    if (newId && newId !== "new") {
      // 设置加载状态
      initializing.value = true;
      isPending.value = true;

      try {
        console.log("Loading session from route param:", newId);
        // 获取会话元数据
        const sessionInfo = await getSessionInfo(newId);
        activeSession.value = sessionInfo;

        // 加载会话消息历史
        const sessionMessages = await loadSessionMessages(newId);

        // 使用会话历史更新聊天
        if (sessionMessages.length > 0) {
          // 将服务器消息格式转换为useChat格式
          const formattedMessages = sessionMessages.map(
            (msg: any, index: number) => ({
              id: `msg-${index}`,
              role: msg.role,
              content: msg.content,
            })
          );

          // 如果尚未包含系统消息，则添加
          if (!formattedMessages.some((m) => m.role === "system")) {
            formattedMessages.unshift({
              id: "system-1",
              role: "system",
              content: "You are a helpful assistant.",
            });
          }

          // 在聊天中设置消息
          setMessages(formattedMessages);
        }

        // 更新chatId，但不使用computed
        chatId.value = `mcp-${newId}`;

        // 显示成功通知
        toast.add({ title: "会话加载成功" });
      } catch (err) {
        console.error("Failed to load session from route:", err);
        error.value =
          "Invalid session ID. The session may have been deleted or does not exist.";

        // 显示错误通知
        toast.add({ title: "无法加载会话，可能已被删除或不存在" });

        // 如果会话不存在，重定向到新会话页面
        router.push("/mcp/new");
      } finally {
        initializing.value = false;
        isPending.value = false;

        // 滚动到底部
        scrollToBottom();
      }
    } else if (newId === "new") {
      // 显示新会话界面
      activeSession.value = null;
      chatId.value = "mcp-new-session";
      initializing.value = false;

      // 清空消息
      setMessages([
        {
          id: "system-1",
          role: "system",
          content: "You are a helpful assistant.",
        },
      ]);
    }
  },
  { immediate: true }
);

// 页面加载时检查路由参数
onMounted(async () => {
  if (!sessionIdFromRoute.value || sessionIdFromRoute.value === "new") {
    // 检查localStorage中是否有保存的会话
    try {
      const savedSessionId = localStorage.getItem("mcp_session_id");
      if (savedSessionId) {
        console.log("Found saved session ID in localStorage:", savedSessionId);
        // 如果有保存的会话，重定向到对应的路由
        router.replace(`/mcp/${savedSessionId}`);
        return;
      }
    } catch (err) {
      console.error("Failed to check localStorage:", err);
      localStorage.removeItem("mcp_session_id");
    } finally {
      if (!sessionIdFromRoute.value) {
        initializing.value = false;
      }
    }
  }
});

// 创建新的MCP会话
async function createSession() {
  if (isLoading.value) return;

  try {
    error.value = null;
    isPending.value = true;
    console.log("Creating new session");

    const response = await axios.post("/api/mcp-chat", {
      action: "create",
      metadata: {
        clientInfo: navigator.userAgent,
        createdBy: "web-client",
      },
    });

    const data = response.data;

    // 保存会话ID到localStorage
    localStorage.setItem("mcp_session_id", data.conversationId);

    // 导航到新会话路由
    router.replace(`/mcp/${data.conversationId}`);

    // 重置消息
    setMessages([
      {
        id: "system-1",
        role: "system",
        content: "You are a helpful assistant.",
      },
    ]);

    // 显示成功通知
    toast.add({ title: "新会话已创建" });
  } catch (err: any) {
    error.value = err.message || "Failed to create session";
    console.error("Error creating session:", err);

    // 显示错误通知
    toast.add({ title: err.message || "创建会话失败" });
  } finally {
    isPending.value = false;
  }
}

// 提交消息处理函数
const submitMessage = async (e: Event) => {
  e.preventDefault();

  if (!input.value.trim() || disabled.value) return;

  console.log(
    "Submitting message, active session:",
    activeSession.value?.conversationId
  );

  if (!activeSession.value) {
    console.log("No active session, creating one");
    await createSession();
    if (!activeSession.value) {
      console.error("Failed to create session before sending message");
      return;
    }
  }

  // 构建自定义的请求配置，包含conversationId
  const options = {
    data: {
      conversationId: activeSession.value.conversationId,
    },
  };

  console.log("Sending message with options:", options);

  // 使用options调用handleSubmit
  handleSubmit(e, options);
};

// 获取MCP会话信息
async function getSessionInfo(conversationId: string): Promise<MCPSession> {
  console.log("Getting session info for:", conversationId);

  const response = await axios.post("/api/mcp-chat", {
    action: "get",
    conversationId,
  });

  return response.data;
}

// 更新会话信息
async function updateSessionInfo() {
  if (!activeSession.value) return;

  try {
    const sessionInfo = await getSessionInfo(
      activeSession.value.conversationId
    );
    activeSession.value = sessionInfo;
    console.log("Updated session info:", sessionInfo);
  } catch (err) {
    console.error("Failed to update session info:", err);
  }
}

// 删除当前MCP会话
async function deleteSession() {
  if (!activeSession.value || isLoading.value) return;

  try {
    // 确认删除
    const confirmed = await useConfirm("确定要删除此会话吗？此操作无法撤销。", {
      title: "删除会话",
      buttonColor: "red",
      confirmText: "删除",
      cancelText: "取消",
    });

    if (!confirmed) return;

    isPending.value = true;
    console.log("Deleting session:", activeSession.value.conversationId);

    const response = await axios.post("/api/mcp-chat", {
      action: "delete",
      conversationId: activeSession.value.conversationId,
    });

    // 清除localStorage中的会话ID
    localStorage.removeItem("mcp_session_id");

    // 显示成功通知
    toast.add({ title: "会话已删除" });
    // 导航到新会话页面
    router.replace("/mcp/new");
  } catch (err: any) {
    console.error("Error deleting session:", err);

    // 显示错误通知
    toast.add({ title: err.message || "删除会话失败" });
  } finally {
    isPending.value = false;
  }
}

// 获取消息角色的图标
function getRoleIcon(role: string) {
  switch (role) {
    case "system":
      return "i-heroicons-cog-6-tooth";
    case "user":
      return "i-heroicons-user-circle";
    case "assistant":
      return "i-heroicons-chat-bubble-left-ellipsis";
    default:
      return "i-heroicons-chat-bubble-left";
  }
}

// 将消息内容中的URL转换为链接
function formatMessageContent(content: string) {
  if (!content) return "";

  // 匹配URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return content.replace(
    urlRegex,
    '<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>'
  );
}

// 复制消息内容
function copyMessage(content: string) {
  console.log("🚀 ~ copyMessage ~ content:", content);
  navigator.clipboard.writeText(content);
  const toast = useToast();
  toast.add({ title: "已复制到剪贴板" });
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 侧边栏组件 -->
    <MCPSidebar :activeSessionId="activeSession?.conversationId" />

    <!-- 主内容区 -->
    <div class="flex flex-col flex-1 pl-16 md:pl-72 h-full">
      <div class="flex flex-col h-full max-w-5xl mx-auto w-full p-4">
        <!-- 头部区域 -->
        <header class="flex items-center justify-between mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h1 class="text-xl font-bold">MCP 聊天</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Model Context Protocol
            </p>
          </div>

          <div class="flex gap-2">
            <UButton v-if="!isSessionActive" color="primary" @click="createSession" :loading="isPending"
              :disabled="isLoading">
              <template #leading>
                <UIcon name="i-heroicons-plus" />
              </template>
              开始会话
            </UButton>

            <template v-else>
              <UButton color="primary" variant="soft" @click="createSession" :loading="isPending" :disabled="isLoading">
                <template #leading>
                  <UIcon name="i-heroicons-plus" />
                </template>
                新建会话
              </UButton>

              <UButton color="red" variant="soft" @click="deleteSession" :loading="isPending" :disabled="isLoading">
                <template #leading>
                  <UIcon name="i-heroicons-trash" />
                </template>
                删除会话
              </UButton>
            </template>
          </div>
        </header>

        <!-- 会话信息卡片 -->
        <UCard v-if="isSessionActive" class="mb-4" :ui="{ body: { padding: 'p-3' } }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <UIcon name="i-heroicons-information-circle" class="text-primary-500" />
                <h3 class="text-sm font-medium">会话信息</h3>
              </div>
              <UButton color="gray" variant="ghost" size="xs" icon="i-heroicons-clipboard"
                @click="navigator.clipboard.writeText(window.location.href)" :tooltip="'复制分享链接'" />
            </div>
          </template>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="space-y-1">
              <div class="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-finger-print" class="w-3 h-3" />
                <span>会话 ID:</span>
              </div>
              <div class="font-mono text-xs truncate">
                {{ activeSession.conversationId }}
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-calendar" class="w-3 h-3" />
                <span>创建时间:</span>
              </div>
              <div>
                {{ new Date(activeSession.createdAt).toLocaleString() }}
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                <UIcon name="i-heroicons-chat-bubble-left-right" class="w-3 h-3" />
                <span>消息数量:</span>
              </div>
              <div>{{ activeSession.messageCount }} 条</div>
            </div>
          </div>
        </UCard>

        <!-- 错误提示 -->
        <UAlert v-if="error || chatError" color="red" variant="soft" :title="'错误'"
          icon="i-heroicons-exclamation-triangle" class="mb-4">
          {{ error || chatError }}
        </UAlert>

        <!-- 加载状态 -->
        <div v-if="initializing" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 mx-auto mb-2 animate-spin text-primary-500" />
            <p class="text-gray-600 dark:text-gray-300">加载会话中...</p>
          </div>
        </div>

        <!-- 无会话提示 -->
        <div v-else-if="!isSessionActive" class="flex-1 flex items-center justify-center">
          <div class="text-center max-w-md p-6">
            <UIcon name="i-heroicons-chat-bubble-left-right" class="w-12 h-12 mx-auto mb-4 text-primary-500" />
            <h2 class="text-xl font-bold mb-2">开始一个新的会话</h2>
            <p class="text-gray-600 dark:text-gray-300 mb-6">
              创建一个新的会话，开始与AI助手交流。每个会话都会被保存，方便您随时回顾。
            </p>
            <UButton color="primary" size="lg" @click="createSession" :loading="isPending" :disabled="isLoading">
              <template #leading>
                <UIcon name="i-heroicons-plus" />
              </template>
              开始会话
            </UButton>
          </div>
        </div>

        <!-- 消息列表 -->
        <div v-else ref="chatContainerRef" class="flex-1 overflow-y-auto space-y-4 mb-4 p-2">
          <div v-for="message in messages" :key="message.id" class="group rounded-lg p-4" :class="{
            'bg-blue-50 dark:bg-blue-950': message.role === 'user',
            'bg-gray-50 dark:bg-gray-800': message.role === 'assistant',
            'bg-yellow-50 dark:bg-yellow-950': message.role === 'system',
          }">
            <!-- 消息头部 -->
            <div class="flex justify-between items-center mb-2">
              <div class="flex items-center space-x-2">
                <UIcon :name="getRoleIcon(message.role)" class="w-5 h-5" :class="{
                  'text-blue-500': message.role === 'user',
                  'text-green-500': message.role === 'assistant',
                  'text-yellow-500': message.role === 'system',
                }" />
                <span class="font-medium">
                  {{
                    message.role === "user"
                      ? "你"
                      : message.role === "assistant"
                        ? "AI 助手"
                        : "系统"
                  }}
                </span>
              </div>

              <!-- 消息操作按钮 -->
              <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                <UButton color="gray" variant="ghost" icon="i-heroicons-clipboard" size="xs"
                  @click="copyMessage(message.content)" :tooltip="'复制内容'" square />
              </div>
            </div>

            <!-- 消息内容 -->
            <div class="whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert"
              v-html="formatMessageContent(message.content)"></div>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="mt-auto border-t border-gray-200 dark:border-gray-700 pt-4">
          <form @submit="submitMessage" class="relative">
            <UTextarea v-model="input" :placeholder="isSessionActive ? '输入消息...' : '请先创建会话...'" :disabled="disabled"
              :ui="{
                wrapper: 'relative',
                base: 'w-full flex-1 min-h-[100px] max-h-[400px]',
                rounded: 'rounded-lg',
                padding: 'py-3 pl-4 pr-12',
              }" autofocus resize @keydown.enter.prevent.exact="submitMessage" />

            <div class="absolute right-3 bottom-3 flex space-x-2">
              <UButton v-if="isLoading" color="gray" variant="ghost" icon="i-heroicons-stop" :disabled="!isLoading"
                @click="stop" :tooltip="'停止生成'" square />

              <UButton type="submit" color="primary" variant="solid" icon="i-heroicons-paper-airplane"
                :disabled="disabled || !input.trim()" :loading="isLoading" :tooltip="'发送消息'" square />
            </div>
          </form>

          <div class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
            <div>
              按
              <kbd
                class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">Enter</kbd>
              发送
              <span class="mx-2">|</span>
              按
              <kbd
                class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">Shift</kbd>
              +
              <kbd
                class="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">Enter</kbd>
              换行
            </div>

            <div v-if="isSessionActive">
              <span>{{ activeSession?.messageCount }} 条消息</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <UNotifications />
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

/* 响应式调整 */
@media (max-width: 768px) {
  .pl-16 {
    padding-left: 4rem;
  }

  .md\:pl-72 {
    padding-left: 4rem;
  }
}
</style>
