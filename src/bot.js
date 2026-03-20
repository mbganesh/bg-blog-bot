const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not set in .env file!");
  console.error("   Please add your bot token to the .env file.");
  console.error("   Get one from @BotFather on Telegram.");
  process.exit(1);
}

// const bot = new TelegramBot(token, { polling: true });

const bot = new TelegramBot(token, {
  polling: true,
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4,
    },
  },
});

console.log("🤖 Bot instance created successfully");

module.exports = bot;
