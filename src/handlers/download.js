const fs = require("fs");
const bot = require("../bot");
const { downloadVideo } = require("../utils/downloader");
const { extractUrl, formatFileSize, cleanupFile } = require("../utils/helpers");
const { handleAiChat } = require("./ai");

/**
 * Registers the message handler that processes video download requests
 */
function registerDownloadHandler() {
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands (handled by other handlers)
    if (!text || text.startsWith("/")) return;

    // Try to extract a URL from the message
    const url = extractUrl(text);

    if (!url) {
      // No URL found — route to AI chat
      await handleAiChat(chatId, text);
      return;
    }

    // Send a status message that we'll update with progress
    const statusMsg = await bot.sendMessage(
      chatId,
      "⏳ *Downloading your video...*\n\nThis may take a moment depending on the video size.",
      { parse_mode: "Markdown" },
    );

    let lastUpdateTime = Date.now();

    try {
      // Download the video with progress updates
      const { filePath, title, fileSize } = await downloadVideo(
        url,
        (progress) => {
          // Throttle progress updates to avoid hitting Telegram API limits
          const now = Date.now();
          if (now - lastUpdateTime > 3000) {
            lastUpdateTime = now;
            bot
              .editMessageText(
                `⏳ *Downloading your video...*\n\n📊 Progress: \`${progress}\``,
                {
                  chat_id: chatId,
                  message_id: statusMsg.message_id,
                  parse_mode: "Markdown",
                },
              )
              .catch(() => {
                // Ignore edit errors (e.g. message not modified)
              });
          }
        },
      );

      // Update status — uploading to Telegram
      await bot
        .editMessageText("📤 *Uploading to Telegram...*", {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: "Markdown",
        })
        .catch(() => {});

      // Send the video file as a document
      await bot.sendDocument(chatId, filePath, {
        caption: `🎬 *${title}*\n📦 Size: ${formatFileSize(fileSize)}`,
        parse_mode: "Markdown",
      });

      // Delete the status message after successful upload
      await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

      // Clean up the downloaded file
      cleanupFile(filePath);

      console.log(
        `✅ Successfully sent video to user ${msg.from.first_name} (${chatId})`,
      );
    } catch (error) {
      console.error("❌ Download error:", error.message);

      let errorMessage = "❌ *Download Failed*\n\n";

      if (error.message.includes("not installed")) {
        errorMessage +=
          "⚠️ `yt-dlp` is not installed on the server. Please contact the bot admin.";
      } else if (error.message.includes("too large")) {
        errorMessage += `📦 ${error.message}`;
      } else if (
        error.message.includes("Unsupported URL") ||
        error.message.includes("is not a valid URL")
      ) {
        errorMessage +=
          "🔗 This URL is not supported. Please try a different link.";
      } else if (error.message.includes("Private video")) {
        errorMessage += "🔒 This video is private and cannot be downloaded.";
      } else {
        errorMessage += `Something went wrong. Please try again later.\n\n_Error: ${error.message.substring(0, 200)}_`;
      }

      // Update the status message with the error
      await bot
        .editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: "Markdown",
        })
        .catch(() => {
          // If edit fails, send a new message
          bot.sendMessage(chatId, errorMessage, {
            parse_mode: "Markdown",
          });
        });
    }
  });
}

module.exports = { registerDownloadHandler };
