const path = require("path");
const bot = require("../bot");

// Load quotes once at startup
const quotes = require(path.join(__dirname, "../../content/quotes.json"));

console.log(`📜 Loaded ${quotes.length} quotes`);

/**
 * Registers the /q and /quote command handlers
 */
function registerQuoteHandler() {
  const regex = /\/(quote)/; // /\/(q|quote)/
  bot.onText(regex, (msg) => {
    const chatId = msg.chat.id;
    console.log("🚀 ~ quote.js:15 ~ registerQuoteHandler ~ chatId:", chatId);

    // Pick a random quote
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const quoteObj = quotes[randomIndex];

    const quoteText = quoteObj.quote.replace(/\\n/g, "\n");

    bot.sendMessage(chatId, `💬 _${quoteText}_`, {
      parse_mode: "Markdown",
    });
  });
}

module.exports = { registerQuoteHandler };
