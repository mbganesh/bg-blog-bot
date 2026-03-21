const bot = require("../bot");
const puppeteer = require("puppeteer");

console.log(`📜 Video Downloader module loaded!`);

// In-memory state: chatId -> true (waiting for URL)
const waitingForUrl = new Map();
// Temporary store for found video streams: chatId -> [{ resolution, url }]
const foundStreams = new Map();

/**
 * Uses Puppeteer to intercept network requests and find all available
 * video stream URLs across different resolutions.
 *
 * @param {string} siteUrl - The page URL to scan
 * @param {number} chatId - Telegram chat ID for status messages
 * @returns {Promise<Array<{resolution: string, url: string}>>}
 */
async function findVideoStreams(siteUrl, chatId) {
  let browser;
  let statusMsg;

  try {
    statusMsg = await bot.sendMessage(
      chatId,
      `⏳ *Scanning URL...*\nLooking for video streams on:\n\`${siteUrl}\``,
      { parse_mode: "Markdown" },
    );

    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Collect all video URLs with their resolutions
    const videoUrls = new Map(); // resolution -> url (deduplicates)

    const resolutionPatterns = [
      { pattern: "1080", label: "1080p" },
      { pattern: "720", label: "720p" },
      { pattern: "480", label: "480p" },
      { pattern: "360", label: "360p" },
      { pattern: "240", label: "240p" },
      { pattern: "144", label: "144p" },
    ];

    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();

      if (url.includes(".m3u8") || url.includes(".mp4")) {
        for (const { pattern, label } of resolutionPatterns) {
          if (url.includes(pattern) && !videoUrls.has(label)) {
            videoUrls.set(label, url);
          }
        }
        // If no resolution pattern matched, store as "Unknown"
        if (
          !Array.from(videoUrls.values()).includes(url) &&
          (url.includes(".mp4") || url.includes(".m3u8"))
        ) {
          const existingUnknown = Array.from(videoUrls.keys()).filter((k) =>
            k.startsWith("Video"),
          ).length;
          videoUrls.set(`Video ${existingUnknown + 1}`, url);
        }
      }

      request.continue();
    });

    await page
      .goto(siteUrl, { waitUntil: "networkidle2", timeout: 45000 })
      .catch(() => {
        console.log("Navigation finished or timed out.");
      });

    // Try to trigger video load
    await page.click("body").catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));

    await browser.close();

    // Convert to array and sort by resolution (highest first)
    const resolutionOrder = ["1080p", "720p", "480p", "360p", "240p", "144p"];
    const streams = Array.from(videoUrls.entries())
      .map(([resolution, url]) => ({ resolution, url }))
      .sort((a, b) => {
        const aIdx = resolutionOrder.indexOf(a.resolution);
        const bIdx = resolutionOrder.indexOf(b.resolution);
        // Known resolutions first (sorted high→low), then unknowns
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });

    console.log(
      `🚀 ~ findVideoStreams ~ found ${streams.length} streams:`,
      streams.map((s) => s.resolution),
    );

    if (streams.length > 0) {
      await bot
        .deleteMessage(chatId, statusMsg.message_id)
        .catch(() => {});
    } else {
      await bot
        .editMessageText(
          `❌ Could not find any video streams for this URL.`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
          },
        )
        .catch(() => {});
    }

    return streams;
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    await bot.sendMessage(
      chatId,
      `❌ *Error scanning URL:*\n${err.message}`,
      { parse_mode: "Markdown" },
    );
    return [];
  }
}

/**
 * Registers the /download command handler with conversational flow.
 *
 * Flow:
 *   1. User sends /download → bot asks for URL
 *   2. User sends URL → bot scans and shows resolution buttons
 *   3. User clicks resolution → bot sends CDN link
 */
function registerVideoDownloadHandler() {
  // Step 1: /download or /dl → ask for URL
  bot.onText(/\/(download|dl)(\s|$)/, async (msg, match) => {
    const chatId = msg.chat.id;

    // If they included a URL directly, handle it immediately
    const restOfMessage = msg.text.replace(/^\/(download|dl)\s*/, "").trim();
    if (restOfMessage && /^https?:\/\/[^\s]+$/.test(restOfMessage)) {
      await handleUrl(chatId, restOfMessage);
      return;
    }

    // Set waiting state and ask for URL
    waitingForUrl.set(chatId, true);

    await bot.sendMessage(
      chatId,
      `🎬 *Video Download*\n\nSend me the URL of the page containing the video:`,
      { parse_mode: "Markdown" },
    );
  });

  // Step 2: Listen for URL from users who are in "waiting" state
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    // Only handle if we're waiting for a URL from this user
    if (!waitingForUrl.has(chatId)) return;

    // Ignore commands
    if (msg.text && msg.text.startsWith("/")) return;

    // Clear waiting state
    waitingForUrl.delete(chatId);

    const url = msg.text ? msg.text.trim() : "";

    if (!url || !/^https?:\/\/[^\s]+$/.test(url)) {
      await bot.sendMessage(
        chatId,
        `❌ That doesn't look like a valid URL.\n\nPlease send /download and try again.`,
      );
      return;
    }

    await handleUrl(chatId, url);
  });

  // Step 3: Handle resolution button clicks
  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data || !data.startsWith("vdl_")) return;

    const chatId = query.message.chat.id;
    const streamIndex = parseInt(data.replace("vdl_", ""), 10);
    const streams = foundStreams.get(chatId);

    // Acknowledge the button click
    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (!streams || !streams[streamIndex]) {
      await bot.sendMessage(
        chatId,
        `❌ Session expired. Please send /download again.`,
      );
      return;
    }

    const selected = streams[streamIndex];

    // Send the CDN link as a clickable text message
    await bot.sendMessage(
      chatId,
      `✅ *${selected.resolution} — Download Link*\n\n` +
        `🔗 [Click here to download](${selected.url})\n\n` +
        `📋 *Direct URL:*\n\`${selected.url}\``,
      {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      },
    );

    // Clean up stored streams
    foundStreams.delete(chatId);
  });
}

/**
 * Handles a submitted URL: scans for video streams and shows resolution buttons.
 */
async function handleUrl(chatId, siteUrl) {
  console.log(`🚀 ~ handleUrl ~ siteUrl: ${siteUrl}`);

  const streams = await findVideoStreams(siteUrl, chatId);

  if (streams.length === 0) return;

  // Store streams for callback lookup
  foundStreams.set(chatId, streams);

  // Build inline keyboard with resolution buttons
  const keyboard = streams.map((stream, index) => [
    {
      text: `📹 ${stream.resolution}`,
      callback_data: `vdl_${index}`,
    },
  ]);

  await bot.sendMessage(
    chatId,
    `🎬 *Found ${streams.length} resolution(s)*\n\nSelect a resolution to get the download link:`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: keyboard,
      },
    },
  );
}

module.exports = { registerVideoDownloadHandler };
