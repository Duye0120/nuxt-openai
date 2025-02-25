// pages/mcp/[id].vue - 修复循环引用问题
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useChat } from '@ai-sdk/vue';
import { useRoute, useRouter } from 'vue-router';

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

// 为useChat提供固定ID，避免循环引用
const chatId = ref('mcp-session');

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
  api: '/api/mcp-chat', // 使用统一的API端点
  id: chatId, // 使用固定的引用，避免计算属性
  initialMessages: [
    {
      role: 'system',
      content: 'You are a helpful assistant.'
    }
  ],
  onResponse(response) {
    console.log('Chat response status:', response.status);
    if (!response.ok) {
      error.value = `API error: ${response.statusText}`;
    }
  },
  onFinish() {
    console.log('Chat finished, active session:', activeSession.value?.conversationId);
    // 更新会话信息
    updateSessionInfo();
  }
});

// 计算属性
const isSessionActive = computed(() => !!activeSession.value?.conversationId);
const disabled = computed(() => isLoading.value || !isSessionActive.value);

// 监听路由参数变化
watch(sessionIdFromRoute, async (newId) => {
  if (newId && newId !== 'new') {
    // 尝试获取指定ID的会话
    try {
      console.log('Loading session from route param:', newId);
      const sessionInfo = await getSessionInfo(newId);
      activeSession.value = sessionInfo;
      
      // 更新chatId，但不使用computed
      chatId.value = `mcp-${newId}`;
    } catch (err) {
      console.error('Failed to load session from route:', err);
      error.value = 'Invalid session ID. The session may have been deleted or does not exist.';
      // 如果会话不存在，重定向到新会话页面
      router.push('/mcp/new');
    } finally {
      initializing.value = false;
    }
  } else if (newId === 'new') {
    // 显示新会话界面
    activeSession.value = null;
    chatId.value = 'mcp-new-session';
    initializing.value = false;
  }
}, { immediate: true });

// 页面加载时检查路由参数
onMounted(async () => {
  if (!sessionIdFromRoute.value || sessionIdFromRoute.value === 'new') {
    // 检查localStorage中是否有保存的会话
    try {
      const savedSessionId = localStorage.getItem('mcp_session_id');
      if (savedSessionId) {
        console.log('Found saved session ID in localStorage:', savedSessionId);
        // 如果有保存的会话，重定向到对应的路由
        router.replace(`/mcp/${savedSessionId}`);
        return;
      }
    } catch (err) {
      console.error('Failed to check localStorage:', err);
      localStorage.removeItem('mcp_session_id');
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
    console.log('Creating new session');
    
    const response = await fetch('/api/mcp-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        metadata: {
          clientInfo: navigator.userAgent,
          createdBy: 'web-client'
        }
      })
    });
    
    if (!response.ok) throw new Error('Failed to create session');
    
    const data = await response.json();
    
    // 保存会话ID到localStorage
    localStorage.setItem('mcp_session_id', data.conversationId);
    
    // 导航到新会话路由
    router.replace(`/mcp/${data.conversationId}`);
    
    // 重置消息
    setMessages([{
      id: 'system-1',
      role: 'system',
      content: 'You are a helpful assistant.'
    }]);
  } catch (err: any) {
    error.value = err.message || 'Failed to create session';
    console.error('Error creating session:', err);
  }
}

// 提交消息处理函数
const submitMessage = async (e: Event) => {
  e.preventDefault();
  
  if (!input.value.trim() || disabled.value) return;
  
  console.log('Submitting message, active session:', activeSession.value?.conversationId);
  
  if (!activeSession.value) {
    console.log('No active session, creating one');
    await createSession();
    if (!activeSession.value) {
      console.error('Failed to create session before sending message');
      return;
    }
  }
  
  // 构建自定义的请求配置，包含conversationId
  const options = {
    data: {
      conversationId: activeSession.value.conversationId
    }
  };
  
  console.log('Sending message with options:', options);
  
  // 使用options调用handleSubmit
  handleSubmit(e, options);
};

// 获取MCP会话信息
async function getSessionInfo(conversationId: string): Promise<MCPSession> {
  console.log('Getting session info for:', conversationId);
  
  const response = await fetch('/api/mcp-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'get',
      conversationId
    })
  });
  
  if (!response.ok) throw new Error('Failed to get session info');
  
  return response.json();
}

// 更新会话信息
async function updateSessionInfo() {
  if (!activeSession.value) return;
  
  try {
    const sessionInfo = await getSessionInfo(activeSession.value.conversationId);
    activeSession.value = sessionInfo;
    console.log('Updated session info:', sessionInfo);
  } catch (err) {
    console.error('Failed to update session info:', err);
  }
}

// 删除当前MCP会话
async function deleteSession() {
  if (!activeSession.value || isLoading.value) return;
  
  try {
    console.log('Deleting session:', activeSession.value.conversationId);
    
    const response = await fetch('/api/mcp-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        conversationId: activeSession.value.conversationId
      })
    });
    
    if (!response.ok) throw new Error('Failed to delete session');
    
    // 清除localStorage中的会话ID
    localStorage.removeItem('mcp_session_id');
    
    // 导航到新会话页面
    router.replace('/mcp/new');
  } catch (err: any) {
    console.error('Error deleting session:', err);
  }
}
</script>

<template>
  <div class="flex flex-col w-full max-w-md py-24 mx-auto stretch">
    <h1 class="mb-4 text-2xl font-bold text-center">MCP Chat (Model Context Protocol)</h1>
    
    <!-- 会话控制按钮 -->
    <div class="flex justify-between mb-6">
      <button
        @click="createSession"
        :disabled="isLoading"
        class="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {{ isSessionActive ? 'New Session' : 'Start Session' }}
      </button>
      
      <button
        v-if="isSessionActive"
        @click="deleteSession"
        :disabled="isLoading"
        class="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50"
      >
        End Session
      </button>
    </div>
    
    <!-- 会话信息 -->
    <div v-if="isSessionActive" class="p-3 mb-4 text-sm bg-gray-100 rounded">
      <div><strong>Session ID:</strong> {{ activeSession.conversationId }}</div>
      <div><strong>Messages:</strong> {{ activeSession.messageCount }}</div>
      <div><strong>Created:</strong> {{ new Date(activeSession.createdAt).toLocaleString() }}</div>
      <div class="mt-2">
        <button 
          @click="navigator.clipboard.writeText(window.location.href)"
          class="px-2 py-1 text-xs text-white bg-blue-500 rounded hover:bg-blue-600"
        >
          Copy Share Link
        </button>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <div
      v-if="error || chatError"
      class="p-4 mb-4 text-white bg-red-500 rounded"
    >
      {{ error || chatError }}
    </div>
    
    <!-- 初始化提示 -->
    <div v-if="initializing" class="p-4 text-center">
      Loading session...
    </div>
    
    <!-- 无会话提示 -->
    <div v-else-if="!isSessionActive" class="p-4 text-center">
      No active session. Click "Start Session" to begin.
    </div>
    
    <!-- 消息列表 -->
    <div v-else class="flex-1 overflow-y-auto space-y-4">
      <div
        v-for="message in messages"
        :key="message.id"
        class="p-3 rounded"
        :class="{
          'bg-blue-100': message.role === 'user',
          'bg-gray-100': message.role === 'assistant',
          'bg-green-100': message.role === 'system'
        }"
      >
        <div class="font-bold">
          {{ message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : 'System' }}
        </div>
        <div class="whitespace-pre-wrap">{{ message.content }}</div>
      </div>
    </div>
    
    <!-- 加载指示器 -->
    <div
      v-if="isLoading"
      class="w-full h-8 max-w-md p-2 mt-4 mb-8 bg-gray-300 rounded-lg animate-pulse"
    ></div>
    
    <!-- 输入表单 -->
    <form @submit="submitMessage" class="mt-6">
      <input
        class="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
        v-model="input"
        placeholder="Type your message..."
        :disabled="disabled"
      />
    </form>
  </div>
</template>