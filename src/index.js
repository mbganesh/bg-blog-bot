require("dotenv").config();

const bot = require("./bot");
const { registerStartHandler } = require("./handlers/start");
const { registerAiHandler } = require("./handlers/ai");
const { registerQuoteHandler } = require("./handlers/quote");
const { registerThirukkuralHandler } = require("./handlers/thirukural");
const { registerKavithaigalHandler } = require("./handlers/kavithaigal");
const { registerDownloadHandler } = require("./handlers/download");

// Register all handlers (order matters — commands first, then general message handler)
registerStartHandler();
// registerAiHandler();
registerQuoteHandler();
registerThirukkuralHandler();
registerKavithaigalHandler();
registerDownloadHandler();

// Log when bot is ready
bot.on("polling_error", (error) => {
  console.error("❌ Polling error:", error.code, error.message);
});

console.log("✅ Video Downloader Bot is running!");
console.log("📡 Waiting for messages...");
