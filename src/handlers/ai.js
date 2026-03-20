const bot = require("../bot");
const { chat, clearHistory, isAiAvailable } = require("../utils/ai");

/**
 * Registers AI-related command handlers
 */
function registerAiHandler() {
  // /ai <question> — explicit AI command
  bot.onText(/\/ai (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const question = match[1];

    if (!isAiAvailable()) {
      bot.sendMessage(
        chatId,
        "🤖 AI is not configured. The bot admin needs to set up a Gemini API key.",
      );
      return;
    }

    // Show typing indicator
    bot.sendChatAction(chatId, "typing");

    try {
      const response = await chat(chatId, question);
      await bot
        .sendMessage(chatId, response, { parse_mode: "Markdown" })
        .catch(() => {
          // If markdown parsing fails, send as plain text
          bot.sendMessage(chatId, response);
        });
    } catch (error) {
      console.error("❌ AI error:", error.message);
      bot.sendMessage(
        chatId,
        "❌ Sorry, I couldn't process that. Please try again later.",
      );
    }
  });

  // /ai with no question
  bot.onText(/^\/ai$/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "🤖 Please provide a question after /ai\n\nExample: `/ai What is Node.js?`",
      { parse_mode: "Markdown" },
    );
  });

  // /clear — reset conversation history
  bot.onText(/\/clear/, (msg) => {
    const chatId = msg.chat.id;
    clearHistory(chatId);
    bot.sendMessage(chatId, "🧹 Conversation history cleared! Start fresh.");
  });
}

/**
 * Handles a plain text message as an AI chat
 * @param {number} chatId
 * @param {string} text
 */
async function handleAiChat(chatId, text) {
  if (!isAiAvailable()) {
    bot.sendMessage(
      chatId,
      "🔗 That doesn't look like a video URL.\n\n💡 *Tip:* AI chat is available! Set up a Gemini API key to chat with me.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // Show typing indicator
  bot.sendChatAction(chatId, "typing");

  try {
    const response = await chat(chatId, text);
    await bot
      .sendMessage(chatId, response, { parse_mode: "Markdown" })
      .catch(() => {
        bot.sendMessage(chatId, response);
      });
  } catch (error) {
    console.error("❌ AI chat error:", error.message);
    bot.sendMessage(
      chatId,
      "❌ Sorry, I couldn't process that. Please try again.",
    );
  }
}

module.exports = { registerAiHandler, handleAiChat };
