// pages/mcp/index.vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  // 检查localStorage中是否有保存的会话
  const savedSessionId = localStorage.getItem('mcp_session_id');
  
  if (savedSessionId) {
    // 如果有保存的会话，重定向到对应的路由
    router.replace(`/mcp/${savedSessionId}`);
  } else {
    // 否则重定向到新会话页面
    router.replace('/mcp/new');
  }
});
</script>

<template>
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Redirecting...</h1>
      <p class="mt-4">Please wait, you are being redirected.</p>
    </div>
  </div>
</template>