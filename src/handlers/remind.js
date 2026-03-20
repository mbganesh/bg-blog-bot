const bot = require("../bot");

// In-memory store: chatId -> Map<reminderId, { timeout, message, fireAt, id }>
const activeReminders = new Map();
let nextId = 1;

/**
 * Parses a time string into milliseconds delay from now.
 *
 * Supports:
 *   Relative: 30s, 5m, 2h, 1d
 *   Absolute: 8pm, 2:30pm, 14:30, 8am
 *
 * @param {string} timeStr
 * @returns {{ delayMs: number, fireAt: Date } | null}
 */
function parseTime(timeStr) {
  if (!timeStr) return null;
  const str = timeStr.trim().toLowerCase();

  // --- Relative time: 30s, 5m, 2h, 1d ---
  const relativeMatch = str.match(/^(\d+)(s|m|h|d)$/);
  if (relativeMatch) {
    const value = parseInt(relativeMatch[1], 10);
    const unit = relativeMatch[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const delayMs = value * multipliers[unit];
    const fireAt = new Date(Date.now() + delayMs);
    return { delayMs, fireAt };
  }

  // --- Absolute time: 8pm, 2:30pm, 14:30, 8am ---
  const absoluteMatch = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (absoluteMatch) {
    let hours = parseInt(absoluteMatch[1], 10);
    const minutes = parseInt(absoluteMatch[2] || "0", 10);
    const period = absoluteMatch[3];

    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    const now = new Date();
    const fireAt = new Date(now);
    fireAt.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (fireAt <= now) {
      fireAt.setDate(fireAt.getDate() + 1);
    }

    const delayMs = fireAt.getTime() - now.getTime();
    return { delayMs, fireAt };
  }

  return null;
}

/**
 * Formats a Date for display (e.g. "3:05 PM")
 */
function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Formats milliseconds into a human-readable duration (e.g. "2h 30m")
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Gets or creates the reminders map for a chat
 */
function getReminders(chatId) {
  if (!activeReminders.has(chatId)) {
    activeReminders.set(chatId, new Map());
  }
  return activeReminders.get(chatId);
}

/**
 * Registers the /remind command handler
 */
function registerRemindHandler() {
  // --- /remind list ---
  bot.onText(/\/remind\s+list$/i, (msg) => {
    const chatId = msg.chat.id;
    const reminders = getReminders(chatId);

    if (reminders.size === 0) {
      bot.sendMessage(chatId, "📭 You have no active reminders.");
      return;
    }

    let message = "📋 *Your Active Reminders:*\n\n";
    for (const [id, reminder] of reminders) {
      const timeLeft = reminder.fireAt.getTime() - Date.now();
      message += `🔔 *#${id}* — ${reminder.message}\n`;
      message += `   ⏰ Fires at: ${formatTime(reminder.fireAt)} (in ${formatDuration(timeLeft)})\n\n`;
    }
    message += `_Use /remind cancel <id> to cancel a reminder_`;

    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  });

  // --- /remind cancel <id> ---
  bot.onText(/\/remind\s+cancel\s+(\d+)$/i, (msg, match) => {
    const chatId = msg.chat.id;
    const reminderId = parseInt(match[1], 10);
    const reminders = getReminders(chatId);

    if (!reminders.has(reminderId)) {
      bot.sendMessage(
        chatId,
        `❌ Reminder #${reminderId} not found.\n\nUse /remind list to see active reminders.`,
      );
      return;
    }

    const reminder = reminders.get(reminderId);
    clearTimeout(reminder.timeout);
    reminders.delete(reminderId);

    bot.sendMessage(
      chatId,
      `✅ Cancelled reminder #${reminderId}: "${reminder.message}"`,
    );
  });

  // --- /remind <time> <message> ---
  bot.onText(/\/remind\s+(?!list|cancel)(\S+)\s+(.+)/i, (msg, match) => {
    const chatId = msg.chat.id;
    const timeStr = match[1];
    const reminderMessage = match[2].trim();

    const parsed = parseTime(timeStr);
    if (!parsed) {
      bot.sendMessage(
        chatId,
        `❌ *Invalid time format:* \`${timeStr}\`\n\n` +
          `*Supported formats:*\n` +
          `• Relative: \`30s\`, \`5m\`, \`2h\`, \`1d\`\n` +
          `• Absolute: \`8pm\`, \`2:30pm\`, \`14:30\`\n\n` +
          `*Example:* \`/remind 10m Drink water\``,
        { parse_mode: "Markdown" },
      );
      return;
    }

    const { delayMs, fireAt } = parsed;
    const id = nextId++;
    const reminders = getReminders(chatId);

    // Schedule the reminder
    const timeout = setTimeout(() => {
      bot.sendMessage(
        chatId,
        `🔔 *Reminder!*\n\n` +
          `📝 ${reminderMessage}\n\n` +
          `_Set ${formatDuration(delayMs)} ago_`,
        { parse_mode: "Markdown" },
      );
      reminders.delete(id);
      console.log(
        `🔔 Reminder #${id} fired for chat ${chatId}: "${reminderMessage}"`,
      );
    }, delayMs);

    // Store the reminder
    reminders.set(id, {
      timeout,
      message: reminderMessage,
      fireAt,
      id,
    });

    console.log(
      `⏰ Reminder #${id} set for chat ${chatId}: "${reminderMessage}" in ${formatDuration(delayMs)}`,
    );

    bot.sendMessage(
      chatId,
      `✅ *Reminder set!* (ID: #${id})\n\n` +
        `📝 ${reminderMessage}\n` +
        `⏰ Will remind you at *${formatTime(fireAt)}* (in ${formatDuration(delayMs)})\n\n` +
        `_Use /remind list to see all reminders_`,
      { parse_mode: "Markdown" },
    );
  });

  // --- /remind with no valid args ---
  bot.onText(/\/remind\s*$/i, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
      chatId,
      `⏰ *Reminder Bot*\n\n` +
        `*Usage:*\n` +
        `• \`/remind 10m Drink water\` — remind in 10 minutes\n` +
        `• \`/remind 8pm Meeting\` — remind at 8 PM\n` +
        `• \`/remind list\` — show active reminders\n` +
        `• \`/remind cancel 1\` — cancel reminder #1\n\n` +
        `*Time formats:*\n` +
        `• Relative: \`30s\`, \`5m\`, \`2h\`, \`1d\`\n` +
        `• Absolute: \`8pm\`, \`2:30pm\`, \`14:30\``,
      { parse_mode: "Markdown" },
    );
  });
}

module.exports = { registerRemindHandler };
