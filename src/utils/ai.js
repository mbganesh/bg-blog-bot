const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn(
    "⚠️ GEMINI_API_KEY is not set in .env file. AI chat will be disabled.",
  );
}

let genAI = null;
let model = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  console.log("🧠 Gemini AI initialized (gemini-2.0-flash)");
}

// Store conversation history per chat ID
const chatHistories = new Map();

/**
 * Sends a message to Gemini AI and returns the response
 * @param {number} chatId - Telegram chat ID (used to maintain conversation context)
 * @param {string} userMessage - The user's message
 * @returns {Promise<string>} The AI response text
 */
async function chat(chatId, userMessage) {
  if (!model) {
    throw new Error(
      "AI is not configured. Please set GEMINI_API_KEY in your .env file.",
    );
  }

  // Get or create conversation history for this chat
  if (!chatHistories.has(chatId)) {
    chatHistories.set(chatId, []);
  }

  const history = chatHistories.get(chatId);

  // Create a chat session with history
  const chatSession = model.startChat({
    history: history,
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.7,
    },
  });

  // Send the message
  const result = await chatSession.sendMessage(userMessage);
  const responseText = result.response.text();

  // Update history (keep last 20 exchanges to avoid token overflow)
  history.push(
    { role: "user", parts: [{ text: userMessage }] },
    { role: "model", parts: [{ text: responseText }] },
  );

  // Trim history if too long
  if (history.length > 40) {
    history.splice(0, history.length - 40);
  }

  return responseText;
}

/**
 * Clears the conversation history for a specific chat
 * @param {number} chatId
 */
function clearHistory(chatId) {
  chatHistories.delete(chatId);
}

/**
 * Checks if AI is available
 * @returns {boolean}
 */
function isAiAvailable() {
  return model !== null;
}

module.exports = { chat, clearHistory, isAiAvailable };
