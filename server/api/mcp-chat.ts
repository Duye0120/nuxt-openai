// server/api/mcp-chat.ts
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import fs from "fs";
import path from "path";

// 用于跟踪MCP会话的类型声明
type MCPSession = {
  conversationId: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

// 内存缓存
const sessionsCache = new Map<string, MCPSession>();

// 持久化存储路径
const DATA_DIR = path.resolve(process.cwd(), ".data");
const SESSIONS_FILE = path.join(DATA_DIR, "mcp-sessions.json");

// 确保数据目录存在
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
} catch (err) {
  console.error("Error creating data directory:", err);
}

// 加载会话数据
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, "utf8");
      const sessionsData = JSON.parse(data);

      // 将字符串日期转换回Date对象
      for (const [id, session] of Object.entries(sessionsData)) {
        const typedSession = session as MCPSession;
        typedSession.createdAt = new Date(typedSession.createdAt);
        typedSession.updatedAt = new Date(typedSession.updatedAt);
        sessionsCache.set(id, typedSession);
      }

      console.log(`Loaded ${sessionsCache.size} sessions from disk`);
    } else {
      console.log("No sessions file found, starting with empty sessions");
    }
  } catch (err) {
    console.error("Error loading sessions:", err);
  }
}

// 保存会话数据
function saveSessions() {
  try {
    const sessionsData: Record<string, MCPSession> = {};
    for (const [id, session] of sessionsCache.entries()) {
      sessionsData[id] = session;
    }

    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
    console.log(`Saved ${sessionsCache.size} sessions to disk`);
  } catch (err) {
    console.error("Error saving sessions:", err);
  }
}

// 初始加载会话
loadSessions();

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  console.log("MCP-Chat API received request:", body);

  // 获取API密钥
  const apiKey = useRuntimeConfig().openaiApiKey;
  if (!apiKey) {
    console.error("Missing OpenAI API key");
    throw createError({
      statusCode: 500,
      message: "Missing OpenAI API key",
    });
  }

  try {
    const openai = createOpenAI({
      apiKey,
      baseURL: "https://aihubmix.com/v1", // 使用您的自定义基础URL
    });

    // 处理不同类型的请求
    const action = body.action || "chat";

    switch (action) {
      case "create":
        // 创建新的会话
        return createSession(body.metadata || {});

      case "get":
        // 获取会话信息
        if (!body.conversationId) {
          throw createError({
            statusCode: 400,
            message: "Missing conversationId for get action",
          });
        }
        return getSessionInfo(body.conversationId);

      case "delete":
        // 删除会话
        if (!body.conversationId) {
          throw createError({
            statusCode: 400,
            message: "Missing conversationId for delete action",
          });
        }
        return deleteSession(body.conversationId);

      case "chat":
      default:
        // 处理聊天请求
        const conversationId = body.data?.conversationId;

        if (!conversationId) {
          // 如果没有会话ID，使用传入的消息直接调用API
          console.log("No conversationId provided, using direct messages");
          return handleDirectChat(body.messages, openai);
        }

        // 验证会话存在
        let session = sessionsCache.get(conversationId);
        if (!session) {
          console.log(`Session not found: ${conversationId}`);
          console.log(
            `Available sessions: ${Array.from(sessionsCache.keys())}`
          );
          throw createError({
            statusCode: 404,
            message: `Session not found: ${conversationId}`,
          });
        }

        console.log(
          `Found session: ${conversationId} with ${session.messages.length} messages`
        );

        // 获取用户最新的消息
        const latestUserMessage = body.messages[body.messages.length - 1];
        if (!latestUserMessage || latestUserMessage.role !== "user") {
          throw createError({
            statusCode: 400,
            message: "Invalid message format",
          });
        }

        // 将新消息添加到会话历史
        session.messages.push({
          role: "user",
          content: latestUserMessage.content,
        });

        // 更新会话的最后修改时间
        session.updatedAt = new Date();

        // 保存更新的会话
        saveSessions();

        // 使用会话历史调用聊天API
        return handleSessionChat(session, openai);
    }
  } catch (error) {
    console.error("Error in mcp-chat API:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to process request",
    });
  }
});

// 创建新的会话
function createSession(metadata: Record<string, any> = {}) {
  const conversationId = generateId();
  const now = new Date();

  const session: MCPSession = {
    conversationId,
    messages: [],
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  sessionsCache.set(conversationId, session);
  console.log(`Created new session: ${conversationId}`);

  // 保存到持久化存储
  saveSessions();

  return {
    conversationId,
    metadata,
    createdAt: now.toISOString(),
    messageCount: 0,
  };
}

// 处理不使用会话的直接聊天
async function handleDirectChat(messages: any[], openai: any) {
  console.log("Handling direct chat with messages:", messages);

  const result = streamText({
    model: openai("gpt-4o"),
    messages: messages || [],
    async onFinish({ text }) {
      console.log("Response generated successfully");
    },
  });

  return result.toDataStreamResponse();
}

// 处理使用会话的聊天
async function handleSessionChat(session: MCPSession, openai: any) {
  console.log(`Handling session chat for: ${session.conversationId}`);

  // 准备要发送给模型的消息数组
  const formattedMessages = session.messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
    name: msg.name,
  }));

  console.log(`Sending ${formattedMessages.length} messages to the model`);

  const result = streamText({
    model: openai("gpt-4o"),
    messages: formattedMessages,
    async onFinish({ text }) {
      // 将助手的回复添加到会话
      session.messages.push({
        role: "assistant",
        content: text,
      });

      console.log(
        `Saved assistant response to session ${session.conversationId}`
      );
      console.log(`Session now has ${session.messages.length} messages`);

      // 保存更新的会话
      saveSessions();
    },
  });

  return result.toDataStreamResponse();
}

// 获取会话信息
function getSessionInfo(conversationId: string) {
  const session = sessionsCache.get(conversationId);
  if (!session) {
    throw createError({
      statusCode: 404,
      message: `Session not found: ${conversationId}`,
    });
  }

  return {
    conversationId: session.conversationId,
    metadata: session.metadata,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messageCount: session.messages.length,
  };
}

// 删除会话
function deleteSession(conversationId: string) {
  const exists = sessionsCache.has(conversationId);
  sessionsCache.delete(conversationId);

  // 保存更新的会话列表
  if (exists) {
    saveSessions();
  }

  return {
    success: exists,
    message: exists ? "Session deleted" : "Session not found",
  };
}

// 生成唯一ID的辅助函数
function generateId() {
  return (
    "mcp-" +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
