const bot = require("../bot");

/**
 * Registers the /start command handler
 */
function registerStartHandler() {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || "there";

    const welcomeMessage = `
👋 *Hey ${firstName}!*

I'm your *Smart Bot* 🤖✨

Here's everything I can do:

*📋 Available Commands:*
/start — Show this welcome message
/help — Show detailed help
/q or /quote — Get a random motivational quote
/t or /thirukural — Get a random Thirukkural
/k or /kavithaigal — Get a random Tamil Kavithai

    `.trim();

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
🆘 *Help — Smart Bot*

*🎬 Download Videos:*
1️⃣ Copy a video URL from any supported platform
2️⃣ Paste it here in the chat
3️⃣ Wait for the download to complete
4️⃣ Receive the video file!

*🧠 AI Chat:*
• Just type any message to chat with AI
• Use /ai followed by a question
• Use /clear to reset conversation history

*💬 Quotes:*
• Use /q or /quote to get a random motivational quote

*📖 திருக்குறள்:*
• Use /t or /thirukural to get a random Thirukkural with details

*🎭 கவிதைகள்:*
• Use /k or /kavithaigal to get a random Tamil poem

*Tips:*
• Make sure videos are under 50 MB
• Some private/age-restricted videos may not work
• AI remembers your conversation context

*Having issues?* Make sure the URL is correct and the video is publicly accessible.
    `.trim();

    bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  });
}

module.exports = { registerStartHandler };
