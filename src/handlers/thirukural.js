const path = require("path");
const bot = require("../bot");

// Load thirukkural data once at startup
const kurals = require(path.join(__dirname, "../../content/thirukkural.json"));

console.log(`📖 Loaded ${kurals.length} Thirukkurals`);

/**
 * Registers the /t and /thirukural command handlers
 */
function registerThirukkuralHandler() {
  const regex = /\/(thirukural)/; // /\/(t|thirukural)/
  bot.onText(regex, (msg) => {
    const chatId = msg.chat.id;
    console.log(
      "🚀 ~ thirukural.js:15 ~ registerThirukkuralHandler ~ chatId:",
      chatId,
    );

    // Pick a random kural
    const randomIndex = Math.floor(Math.random() * kurals.length);
    const kural = kurals[randomIndex];

    const message = `
📖 *திருக்குறள் — Kural #${kural.Number}*

*${kural.Line1}*
*${kural.Line2}*

───────────────

🌐 *Translation:*
${kural.Translation}

📝 *Couplet:*
_${kural.couplet}_

───────────────

💡 *Explanation:*
${kural.explanation}

🔤 *Transliteration:*
_${kural.transliteration1}_
_${kural.transliteration2}_

───────────────

📚 *உரைகள் (Commentaries):*

*மு.வ:* ${kural.mv}

*சாலமன் பாப்பையா:* ${kural.sp}

*மு.க:* ${kural.mk}
    `.trim();

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" }).catch(() => {
      // If markdown fails, send as plain text
      bot.sendMessage(chatId, message);
    });
  });
}

module.exports = { registerThirukkuralHandler };
