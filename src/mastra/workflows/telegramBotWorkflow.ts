import { createStep, createWorkflow } from "../inngest";
import { z } from "zod";
import { sherlockAgent } from "../agents/sherlockAgent";

const processMessageWithAgent = createStep({
  id: "process-message-with-agent",
  description: "Processes the incoming Telegram message using the Sherlock Holmes AI agent",

  inputSchema: z.object({
    userName: z.string().describe("The Telegram username of the sender"),
    message: z.string().describe("The message text from Telegram"),
    chatId: z.number().describe("The Telegram chat ID to reply to"),
  }),

  outputSchema: z.object({
    agentResponse: z.string(),
    chatId: z.number(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("🔍 [Step 1] Sherlock Holmes is examining the message...", {
      userName: inputData.userName,
      message: inputData.message,
    });

    const threadId = `telegram-${inputData.chatId}`;

    const response = await sherlockAgent.generate(
      [{ role: "user", content: inputData.message }],
      {
        resourceId: "telegram-bot",
        threadId: threadId,
        maxSteps: 5,
      }
    );

    logger?.info("✅ [Step 1] Sherlock Holmes has formulated a response", {
      responseLength: response.text?.length,
    });

    return {
      agentResponse: response.text || "I find myself at a loss for words. Most unusual.",
      chatId: inputData.chatId,
    };
  },
});

const sendTelegramResponse = createStep({
  id: "send-telegram-response",
  description: "Sends the agent's response back to the Telegram chat",

  inputSchema: z.object({
    agentResponse: z.string(),
    chatId: z.number(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.number().optional(),
  }),

  execute: async ({ inputData, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info("📤 [Step 2] Sending response to Telegram...", {
      chatId: inputData.chatId,
      responseLength: inputData.agentResponse.length,
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      logger?.error("❌ [Step 2] TELEGRAM_BOT_TOKEN is not configured");
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: inputData.chatId,
        text: inputData.agentResponse,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger?.error("❌ [Step 2] Failed to send Telegram message", {
        status: response.status,
        error: errorText,
      });
      
      const retryResponse = await fetch(telegramApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: inputData.chatId,
          text: inputData.agentResponse,
        }),
      });

      if (!retryResponse.ok) {
        throw new Error(`Failed to send Telegram message: ${errorText}`);
      }

      const retryResult = await retryResponse.json();
      logger?.info("✅ [Step 2] Message sent successfully (retry without markdown)", {
        messageId: retryResult.result?.message_id,
      });

      return {
        success: true,
        messageId: retryResult.result?.message_id,
      };
    }

    const result = await response.json();
    logger?.info("✅ [Step 2] Message sent successfully", {
      messageId: result.result?.message_id,
    });

    return {
      success: true,
      messageId: result.result?.message_id,
    };
  },
});

export const telegramBotWorkflow = createWorkflow({
  id: "telegram-sherlock-bot",

  inputSchema: z.object({
    userName: z.string().describe("The Telegram username of the sender"),
    message: z.string().describe("The message text from Telegram"),
    chatId: z.number().describe("The Telegram chat ID to reply to"),
  }) as any,

  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.number().optional(),
  }),
})
  .then(processMessageWithAgent as any)
  .then(sendTelegramResponse as any)
  .commit();
