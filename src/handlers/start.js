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
/k or /kavithaigal — Get a random Tamil Kavithai
/remind — Set a timed reminder
/info — Show user, chat & server info
/download <url> — Download a video stream


    `.trim();

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
🆘 *Help — Smart Bot*

*🎬 Download Videos:*
• Paste a supported video URL directly in the chat to download it
• OR use /download <url> to grab a 720p stream if available


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

*⏰ Reminders:*
• Use /remind 10m Drink water — remind in 10 minutes
• Use /remind 8pm Meeting — remind at 8 PM
• Use /remind list — see active reminders
• Use /remind cancel 1 — cancel a reminder

*📱 Info:*
• Use /info or /device — view your user, chat & server details

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
