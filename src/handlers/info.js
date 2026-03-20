const os = require("os");
const bot = require("../bot");

/**
 * Formats uptime in seconds to a human-readable string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

/**
 * Formats bytes into human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Registers the /info command handler
 */
function registerInfoHandler() {
  bot.onText(/\/(info|device)/, (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    const chat = msg.chat;

    // --- User Info ---
    const userInfo = [
      `👤 *User Info*`,
      `├ *Name:* ${user.first_name || "N/A"}${user.last_name ? " " + user.last_name : ""}`,
      `├ *Username:* ${user.username ? "@" + user.username : "Not set"}`,
      `├ *User ID:* \`${user.id}\``,
      `├ *Is Bot:* ${user.is_bot ? "Yes" : "No"}`,
      `└ *Language:* ${user.language_code || "Unknown"}`,
    ].join("\n");

    // --- Chat Info ---
    const chatLines = [`💬 *Chat Info*`];
    chatLines.push(`├ *Chat ID:* \`${chat.id}\``);
    chatLines.push(`├ *Type:* ${chat.type}`);
    if (chat.type === "private") {
      chatLines.push(
        `└ *Name:* ${chat.first_name || ""}${chat.last_name ? " " + chat.last_name : ""}`,
      );
    } else {
      chatLines.push(`├ *Title:* ${chat.title || "N/A"}`);
      chatLines.push(
        `└ *Members:* ${chat.all_members_are_administrators ? "All admins" : "Mixed roles"}`,
      );
    }
    const chatInfo = chatLines.join("\n");

    // --- Message Info ---
    const msgDate = new Date(msg.date * 1000);
    const messageInfo = [
      `📨 *Message Info*`,
      `├ *Message ID:* \`${msg.message_id}\``,
      `├ *Date:* ${msgDate.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
      `└ *Time:* ${msgDate.toLocaleTimeString("en-IN", { timeStyle: "medium", hour12: true })}`,
    ].join("\n");

    // --- Server / Bot Info ---
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();

    const serverInfo = [
      `🖥️ *Server Info*`,
      `├ *Platform:* ${os.platform()} (${os.arch()})`,
      `├ *OS:* ${os.type()} ${os.release()}`,
      `├ *Hostname:* ${os.hostname()}`,
      `├ *CPU:* ${cpus[0]?.model || "Unknown"} (${cpus.length} cores)`,
      `├ *Memory:* ${formatBytes(usedMem)} / ${formatBytes(totalMem)}`,
      `├ *Free Memory:* ${formatBytes(freeMem)}`,
      `├ *Node.js:* ${process.version}`,
      `├ *Bot Uptime:* ${formatUptime(process.uptime())}`,
      `└ *System Uptime:* ${formatUptime(os.uptime())}`,
    ].join("\n");

    // --- Compose full message ---
    const fullMessage = [
      `📱 *Device & Info Panel*`,
      ``,
      userInfo,
      ``,
      chatInfo,
      ``,
      messageInfo,
      ``,
      serverInfo,
      ``,
      `_Generated at ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium", hour12: true })}_`,
    ].join("\n");

    bot.sendMessage(chatId, fullMessage, { parse_mode: "Markdown" });
  });
}

module.exports = { registerInfoHandler };
