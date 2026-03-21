const fs = require("fs");
const path = require("path");
const { execFile, spawn } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const bot = require("../bot");
const { formatFileSize, cleanupFile } = require("../utils/helpers");

console.log(`📜 GetMedia module loaded!`);

// In-memory state: chatId -> true (waiting for URL)
const waitingForUrl = new Map();
// Temporary store for available formats: chatId -> [{ formatId, resolution, ext, filesize }]
const availableFormats = new Map();
// Track the original URL per chat: chatId -> url
const escapeMd = (str) => String(str || "").replace(/([_*\[`])/g, "\\$1");
const pendingUrls = new Map();

const DOWNLOADS_DIR = path.join(__dirname, "../../downloads");

/**
 * Splits a video into smaller segments (under 50MB each for Telegram limit).
 * Returns an array of file paths.
 */
async function splitVideo(inputPath, fileSizeMB) {
  return new Promise((resolve, reject) => {
    // Chunks of ~45MB to be safely under the 50MB limit
    const numChunks = Math.ceil(fileSizeMB / 45);

    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err)
        return reject(
          new Error("Failed to read video metadata: " + err.message),
        );

      const duration = metadata.format.duration;
      if (!duration)
        return reject(new Error("Could not determine video duration"));

      const chunkDuration = Math.ceil(duration / numChunks);
      const parsedPath = path.parse(inputPath);
      const outputPattern = path.join(
        parsedPath.dir,
        `${parsedPath.name}_part%03d${parsedPath.ext}`,
      );

      ffmpeg(inputPath)
        .outputOptions([
          "-c",
          "copy",
          "-map",
          "0",
          "-segment_time",
          `${chunkDuration}`,
          "-f",
          "segment",
          "-reset_timestamps",
          "1",
        ])
        .output(outputPattern)
        .on("end", () => {
          // Find all the generated parts
          const parts = fs
            .readdirSync(parsedPath.dir)
            .filter(
              (f) =>
                f.startsWith(`${parsedPath.name}_part`) &&
                f.endsWith(parsedPath.ext),
            )
            .sort()
            .map((f) => path.join(parsedPath.dir, f));

          resolve(parts);
        })
        .on("error", (err) => {
          reject(new Error("Failed to split video: " + err.message));
        })
        .run();
    });
  });
}

/**
 * Runs yt-dlp to list available formats for a URL.
 * Returns an array of format objects capped at 720p.
 */
function listFormats(url) {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      ["--dump-json", "--no-warnings", "--no-playlist", url],
      { timeout: 30000, maxBuffer: 5 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
          return;
        }

        try {
          // Robust JSON parsing to ignore non-JSON warnings from yt-dlp
          const jsonStart = stdout.indexOf("{");
          const jsonEnd = stdout.lastIndexOf("}");
          if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error("No JSON object found in yt-dlp output");
          }
          const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
          const info = JSON.parse(jsonStr);
          const formats = (info.formats || [])
            .filter((f) => {
              // Only video formats with known resolution, max 720p
              if (!f.height || f.height > 720) return false;
              // Prefer formats that have both video (some are audio-only)
              if (f.vcodec === "none") return false;
              return true;
            })
            .map((f) => ({
              formatId: f.format_id,
              resolution: `${f.height}p`,
              ext: f.ext || "mp4",
              filesize: f.filesize || f.filesize_approx || 0,
              note: f.format_note || "",
            }));

          // Deduplicate by resolution — keep best quality per height
          const byResolution = new Map();
          for (const fmt of formats) {
            const existing = byResolution.get(fmt.resolution);
            if (!existing || fmt.filesize > existing.filesize) {
              byResolution.set(fmt.resolution, fmt);
            }
          }

          // Sort highest first
          const result = Array.from(byResolution.values()).sort((a, b) => {
            return parseInt(b.resolution) - parseInt(a.resolution);
          });

          resolve({ formats: result, title: info.title || "media" });
        } catch (parseErr) {
          reject(new Error("Failed to parse yt-dlp output"));
        }
      },
    );
  });
}

/**
 * Downloads a video using yt-dlp with the given format ID.
 * Returns the output file path.
 */
function downloadMedia(url, formatId, outputPath, onProgress = null) {
  return new Promise((resolve, reject) => {
    // Arguments for yt-dlp:
    // -f : select the specific format ID
    // --merge-output-format : ensured it's mp4
    // -o : output file path
    // --newline : for easier progress parsing
    const args = [
      "-f",
      formatId,
      "--merge-output-format",
      "mp4",
      "-o",
      outputPath,
      "--no-warnings",
      "--no-playlist",
      "--newline",
      "--progress",
      url,
    ];

    console.log(`📥 Starting GetMedia download: ${url} (format: ${formatId})`);
    const process = spawn("yt-dlp", args);

    let stderrData = "";
    let lastProgress = "";

    process.stdout.on("data", (data) => {
      const output = data.toString();

      // Parse progress: [download]  12.3% of 45.67MiB at 1.23MiB/s ETA 00:05
      const progressMatch = output.match(
        /\[download\]\s+([\d.]+%.*?)(?:\r|\n|$)/,
      );
      if (progressMatch && onProgress) {
        const progress = progressMatch[1].trim();
        if (progress !== lastProgress) {
          lastProgress = progress;
          onProgress(progress);
        }
      }
    });

    process.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    process.on("close", (code) => {
      if (code !== 0) {
        console.error(`❌ yt-dlp (GetMedia) exited with code ${code}`);
        return reject(
          new Error(stderrData || `yt-dlp process exited with code ${code}`),
        );
      }
      resolve(outputPath);
    });

    process.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Registers the /getmedia command handler.
 *
 * Flow:
 *   1. User sends /getmedia → bot asks for URL
 *   2. User sends URL → bot lists available resolutions (max 720p)
 *   3. User clicks resolution → bot downloads and sends the file
 */
function registerGetMediaHandler() {
  // Step 1: /getmedia → ask for URL
  bot.onText(
    /^\/getmedia(?:@[a-zA-Z0-9_]+)?(?:\s+(.+))?$/,
    async (msg, match) => {
      const chatId = msg.chat.id;

      // If URL was included inline, handle immediately
      const inlineText = match[1] ? match[1].trim() : "";
      if (inlineText && /^https?:\/\/[^\s]+$/.test(inlineText)) {
        await handleMediaUrl(chatId, inlineText);
        return;
      }

      // Set waiting state
      waitingForUrl.set(chatId, true);

      await bot.sendMessage(
        chatId,
        `📥 *Get Media*\n\nSend me the URL to download from (YouTube, Twitter, etc.):`,
        { parse_mode: "Markdown" },
      );
    },
  );

  // Step 2: Listen for URL from users in "waiting" state
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;

    if (!waitingForUrl.has(chatId)) return;
    if (msg.text && msg.text.startsWith("/")) return;

    waitingForUrl.delete(chatId);

    const url = msg.text ? msg.text.trim() : "";

    if (!url || !/^https?:\/\/[^\s]+$/.test(url)) {
      await bot.sendMessage(
        chatId,
        `❌ That doesn't look like a valid URL.\n\nPlease send /getmedia and try again.`,
      );
      return;
    }

    await handleMediaUrl(chatId, url);
  });

  // Step 3: Handle resolution button clicks
  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data || !data.startsWith("gm_")) return;

    const chatId = query.message.chat.id;
    const formatIndex = parseInt(data.replace("gm_", ""), 10);
    const formats = availableFormats.get(chatId);
    const siteUrl = pendingUrls.get(chatId);

    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (!formats || !formats[formatIndex] || !siteUrl) {
      await bot.sendMessage(
        chatId,
        `❌ Session expired. Please send /getmedia again.`,
      );
      return;
    }

    const selected = formats[formatIndex];

    // Parse the actual height from the resolution (e.g., '720p' -> 720)
    // We use a resolution-based format string which is much more robust
    // across different sites (like XHamster) than a hardcoded formatId
    const height = parseInt(selected.resolution, 10);
    const downloadFormat = Number.isNaN(height)
      ? selected.formatId
      : `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;

    // Clean up state immediately to prevent multiple clicks
    availableFormats.delete(chatId);
    pendingUrls.delete(chatId);

    // Ensure downloads dir exists
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }

    const outputFilename = `media_${chatId}_${Date.now()}.mp4`;
    const outputPath = path.join(DOWNLOADS_DIR, outputFilename);

    const statusMsg = await bot.sendMessage(
      chatId,
      `⏳ *Downloading ${selected.resolution}...*\n\n📊 Progress: \`0%\``,
      { parse_mode: "Markdown" },
    );

    let lastProgressUpdate = Date.now();

    try {
      await downloadMedia(siteUrl, downloadFormat, outputPath, (progress) => {
        // Throttle updates to Telegram (once every 3 seconds)
        const now = Date.now();
        if (now - lastProgressUpdate > 3000) {
          lastProgressUpdate = now;

          let message = `⏳ *Downloading ${selected.resolution}...*\n\n📊 Progress: \`${progress}\``;
          // console.log("[LOG]:", message);
          bot
            .editMessageText(message, {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: "Markdown",
            })
            .catch(() => {});
        }
      });

      // Verify file size before uploading
      const stats = fs.statSync(outputPath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > 50) {
        await bot
          .editMessageText(
            `⏳ *File is large (${fileSizeMB.toFixed(1)} MB)*.\nSplitting into parts for Telegram's limits...`,
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: "Markdown",
            },
          )
          .catch(() => {});

        try {
          const parts = await splitVideo(outputPath, fileSizeMB);

          await bot
            .editMessageText(
              `📤 *Uploading ${parts.length} parts to Telegram...*\n📦 Total Size: ${formatFileSize(stats.size)}`,
              {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: "Markdown",
              },
            )
            .catch(() => {});

          for (let i = 0; i < parts.length; i++) {
            const partPath = parts[i];
            const safeUrl = siteUrl.replace(/\)/g, "%29");
            const caption = `🎬 *${selected.resolution} Downloaded (Part ${i + 1}/${parts.length})*\n[🔗 Original Video Link](${safeUrl})`;

            await bot
              .sendVideo(chatId, partPath, {
                caption,
                parse_mode: "Markdown",
              })
              .catch(async (err) => {
                console.warn(
                  "sendVideo failed for part, trying sendDocument:",
                  err.message,
                );
                await bot.sendDocument(chatId, partPath, {
                  caption,
                  parse_mode: "Markdown",
                });
              });

            cleanupFile(partPath);
          }
          await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
        } catch (splitErr) {
          throw new Error(`Failed to process large file: ${splitErr.message}`);
        }
      } else {
        await bot
          .editMessageText(
            `📤 *Uploading to Telegram...*\n📦 Size: ${formatFileSize(stats.size)}`,
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: "Markdown",
            },
          )
          .catch(() => {});

        // Send the video file
        const safeUrl = siteUrl.replace(/\)/g, "%29");
        await bot
          .sendVideo(chatId, outputPath, {
            caption: `🎬 *${selected.resolution} Downloaded*\n[🔗 Original Video Link](${safeUrl})`,
            parse_mode: "Markdown",
          })
          .catch(async (err) => {
            console.warn("sendVideo failed, trying sendDocument:", err.message);
            // Fallback to sending as a document if video format is weird
            await bot.sendDocument(chatId, outputPath, {
              caption: `🎬 *${selected.resolution} Downloaded*\n[🔗 Original Video Link](${safeUrl})`,
              parse_mode: "Markdown",
            });
          });

        // Clean up status message
        await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
      }
    } catch (err) {
      console.error("GetMedia download error:", err.message);
      await bot
        .editMessageText(`❌ *Download failed:*\n${escapeMd(err.message)}`, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: "Markdown",
        })
        .catch(() => {});
    } finally {
      // Always cleanup the file
      cleanupFile(outputPath);
    }
  });
}

/**
 * Handles a submitted URL: lists formats and shows resolution buttons.
 */
async function handleMediaUrl(chatId, siteUrl) {
  console.log(`🚀 ~ handleMediaUrl ~ siteUrl: ${siteUrl}`);

  const safeUrlForCode = siteUrl.replace(/`/g, "%60");
  const statusMsg = await bot.sendMessage(
    chatId,
    `⏳ *Fetching available formats...*\nAnalyzing: \`${safeUrlForCode}\``,
    { parse_mode: "Markdown" },
  );

  try {
    const { formats, title } = await listFormats(siteUrl);

    if (formats.length === 0) {
      await bot
        .editMessageText(
          `❌ No downloadable video formats found (up to 720p) for this URL.`,
          {
            chat_id: chatId,
            message_id: statusMsg.message_id,
          },
        )
        .catch(() => {});
      return;
    }

    // Store for callback
    availableFormats.set(chatId, formats);
    pendingUrls.set(chatId, siteUrl);

    // Build inline keyboard
    const keyboard = formats.map((fmt, index) => {
      const sizeStr = fmt.filesize ? ` (${formatFileSize(fmt.filesize)})` : "";
      return [
        {
          text: `📹 ${fmt.resolution}${sizeStr}`,
          callback_data: `gm_${index}`,
        },
      ];
    });

    // Replace status with format selection
    await bot
      .editMessageText(
        `🎬 *${escapeMd(title)}*\n\n` +
          `Found ${formats.length} resolution(s) — select one to download:`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: keyboard,
          },
        },
      )
      .catch(() => {});
  } catch (err) {
    console.error("GetMedia listFormats error:", err.message);
    await bot
      .editMessageText(
        `❌ *Failed to fetch formats:*\n${escapeMd(err.message)}`,
        {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: "Markdown",
        },
      )
      .catch(() => {});
  }
}

module.exports = { registerGetMediaHandler };
