// pages/mcp/help.vue
<script setup lang="ts">
import { ref } from "vue";
import MCPSidebar from "~/components/MCPSidebar.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const activeTab = ref("about");

// 定义FAQ项目，避免在模板中直接包含复杂内容
const faqItems = [
  {
    label: "会话数据会保存多久？",
    content: "会话数据会长期保存在服务器上，除非你主动删除。",
  },
  {
    label: "如何删除会话？",
    content:
      '有两种方式可以删除会话：在会话详情页点击"删除会话"按钮，或者在侧边栏中悬停在会话上，点击删除图标。',
  },
  {
    label: "能否编辑或删除已发送的消息？",
    content: "目前不支持编辑或删除已发送的单条消息，只能删除整个会话。",
  },
  {
    label: "如何导出会话内容？",
    content: "当前版本暂不支持导出功能，你可以使用复制功能来获取对话内容。",
  },
  {
    label: "为什么我看不到其他人分享的会话？",
    content:
      "确保链接是完整的，并且所分享的会话ID是有效的。如果会话已被删除，则无法查看。",
  },
  {
    label: "系统支持哪些文件格式？",
    content: "当前版本仅支持文本对话，不支持文件上传和处理。",
  },
];

// 定义标签页项目
const tabItems = [
  { label: "关于 MCP", slot: "about", icon: "i-heroicons-information-circle" },
  { label: "使用指南", slot: "guide", icon: "i-heroicons-book-open" },
  { label: "常见问题", slot: "faq", icon: "i-heroicons-question-mark-circle" },
];

// 返回聊天页面
function backToChat() {
  router.push("/mcp");
}
</script>

<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 侧边栏组件 -->
    <MCPSidebar />

    <!-- 主内容区 -->
    <div class="flex flex-col flex-1 pl-16 md:pl-72 h-full">
      <div class="flex flex-col h-full max-w-5xl mx-auto w-full p-4">
        <!-- 头部区域 -->
        <header
          class="flex items-center justify-between mb-4 p-4 border-b border-gray-200 dark:border-gray-700"
        >
          <div>
            <h1 class="text-xl font-bold">帮助 &amp; 关于</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              MCP 聊天功能指南
            </p>
          </div>

          <UButton color="primary" variant="soft" @click="backToChat">
            <template #leading>
              <UIcon name="i-heroicons-arrow-left" />
            </template>
            返回聊天
          </UButton>
        </header>

        <!-- 标签页 -->
        <UTabs v-model="activeTab" :items="tabItems">
          <!-- 关于 MCP -->
          <template #about>
            <UCard class="mt-4">
              <template #header>
                <div class="flex items-center space-x-2">
                  <UIcon
                    name="i-heroicons-chat-bubble-left-right"
                    class="text-primary-500 w-6 h-6"
                  />
                  <h2 class="text-lg font-bold">MCP 聊天系统</h2>
                </div>
              </template>

              <div class="prose dark:prose-invert">
                <p>
                  <strong>MCP (Model Context Protocol)</strong> 是一个基于 Nuxt
                  和 AI SDK 构建的会话持久化系统， 它允许用户与 AI
                  进行聊天，并将聊天记录保存下来，方便随时查看和继续对话。
                </p>

                <h3>主要特点</h3>
                <ul>
                  <li>
                    <strong>会话持久化</strong> -
                    所有对话内容都会被保存，即使刷新页面或关闭浏览器
                  </li>
                  <li>
                    <strong>多会话管理</strong> -
                    可以创建多个会话，方便分类不同话题的对话
                  </li>
                  <li>
                    <strong>分享功能</strong> -
                    通过链接分享特定会话，让他人可以查看你的会话
                  </li>
                  <li>
                    <strong>响应式设计</strong> - 适配各种设备，从桌面到移动设备
                  </li>
                  <li><strong>暗黑模式</strong> - 支持明亮和暗黑两种主题</li>
                </ul>

                <h3>技术栈</h3>
                <ul>
                  <li><strong>前端</strong>：Nuxt 3, Vue 3, Nuxt UI</li>
                  <li><strong>AI 集成</strong>：AI SDK, OpenAI API</li>
                  <li><strong>存储</strong>：服务端文件系统存储</li>
                </ul>
              </div>

              <template #footer>
                <div class="text-sm text-gray-500">
                  版本 1.0.0 | 更新日期: {{ new Date().toLocaleDateString() }}
                </div>
              </template>
            </UCard>
          </template>

          <!-- 使用指南 -->
          <template #guide>
            <UCard class="mt-4">
              <template #header>
                <div class="flex items-center space-x-2">
                  <UIcon
                    name="i-heroicons-book-open"
                    class="text-primary-500 w-6 h-6"
                  />
                  <h2 class="text-lg font-bold">使用指南</h2>
                </div>
              </template>

              <div class="prose dark:prose-invert">
                <h3>创建新会话</h3>
                <p>有两种方式可以创建新会话：</p>
                <ol>
                  <li>点击侧边栏顶部的"新建会话"按钮</li>
                  <li>在当前会话页面点击"新建会话"按钮</li>
                </ol>
                <p>新会话创建后，可以立即开始与 AI 助手对话。</p>

                <h3>管理会话</h3>
                <p>所有的会话都会显示在左侧边栏中。你可以：</p>
                <ul>
                  <li>点击任意会话切换到该会话</li>
                  <li>悬停在会话上，点击删除图标删除会话</li>
                  <li>使用搜索框搜索特定会话</li>
                </ul>

                <h3>发送消息</h3>
                <p>
                  在输入框中输入你的消息，然后按 Enter
                  键或点击发送按钮发送消息。 如果需要在消息中换行，可以按 Shift
                  + Enter。
                </p>

                <h3>分享会话</h3>
                <p>
                  在会话信息卡片中，点击复制图标可以复制当前会话的链接，
                  将链接分享给他人后，他们可以查看这个会话的全部内容。
                </p>
              </div>
            </UCard>
          </template>

          <!-- 常见问题 -->
          <template #faq>
            <UCard class="mt-4">
              <template #header>
                <div class="flex items-center space-x-2">
                  <UIcon
                    name="i-heroicons-question-mark-circle"
                    class="text-primary-500 w-6 h-6"
                  />
                  <h2 class="text-lg font-bold">常见问题</h2>
                </div>
              </template>

              <UAccordion :items="faqItems" />
            </UCard>
          </template>
        </UTabs>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
