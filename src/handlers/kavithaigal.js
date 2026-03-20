const path = require("path");
const bot = require("../bot");

// Load both kavithai files and combine them
const largeKavithaigal = require(
  path.join(__dirname, "../../content/large_tamil_kavithaigal.json"),
);
const smallKavithaigal = require(
  path.join(__dirname, "../../content/small_tamil_kavithaigal.json"),
);

// Normalize both formats into a unified structure
const allKavithaigal = [
  ...largeKavithaigal.map((k) => ({
    title: k.Title || "",
    content: k.Content || "",
    category: k.Category || "",
  })),
  ...smallKavithaigal.map((k) => ({
    title: "",
    content: k.content || "",
    category: "",
  })),
];

console.log(
  `🎭 Loaded ${allKavithaigal.length} Kavithaigal (${largeKavithaigal.length} large + ${smallKavithaigal.length} small)`,
);

/**
 * Registers the /k and /kavithaigal command handlers
 */
function registerKavithaigalHandler() {
  const regex = /\/(kavithaigal)/; // /\/(k|kavithaigal)/
  bot.onText(regex, (msg) => {
    const chatId = msg.chat.id;
    console.log('🚀 ~ kavithaigal.js:36 ~ registerKavithaigalHandler ~ chatId:', chatId)

    // Pick a random kavithai
    const randomIndex = Math.floor(Math.random() * allKavithaigal.length);
    const kavithai = allKavithaigal[randomIndex];

    // Format the content — replace \n with actual newlines
    const content = kavithai.content.replace(/\\n/g, "\n").trim();

    let message = `🎭 *தமிழ் கவிதை*\n\n`;

    if (kavithai.title) {
      message += `📌 *${kavithai.title}*\n\n`;
    }

    message += `───────────────\n\n`;
    message += `_${content}_\n\n`;
    message += `───────────────`;

    if (kavithai.category) {
      message += `\n\n📂 *வகை:* ${kavithai.category}`;
    }

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" }).catch(() => {
      // If markdown fails (special chars), send as plain text
      bot.sendMessage(chatId, message);
    });
  });
}

module.exports = { registerKavithaigalHandler };
