require("dotenv").config();

// Disable node-telegram-bot-api deprecation warnings
process.env.NTBA_FIX_350 = 1;
process.env.NTBA_FIX_319 = 1;

const bot = require("./bot");
const { registerDownloadHandler } = require("./handlers/download");
const { registerAiHandler } = require("./handlers/ai");
const { registerStartHandler } = require("./handlers/start");
const { registerQuoteHandler } = require("./handlers/quote");
const { registerThirukkuralHandler } = require("./handlers/thirukural");
const { registerKavithaigalHandler } = require("./handlers/kavithaigal");
const { registerRemindHandler } = require("./handlers/remind");
const { registerInfoHandler } = require("./handlers/info");
const { registerVideoDownloadHandler } = require("./handlers/video-download");
const { registerGetMediaHandler } = require("./handlers/get-media");

// Register all handlers (order matters — commands first, then general message handler)
registerStartHandler();
registerQuoteHandler();
registerThirukkuralHandler();
registerKavithaigalHandler();
registerRemindHandler();
registerInfoHandler();
registerVideoDownloadHandler();
registerGetMediaHandler();

// Log when bot is ready
bot.on("polling_error", (error) => {
  console.error("❌ Polling error:", error.code, error.message);
});

console.log("✅ Video Downloader Bot is running!");
console.log("📡 Waiting for messages...");
