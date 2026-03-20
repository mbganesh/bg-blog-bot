const fs = require("fs");
const path = require("path");
const bot = require("../bot");
const puppeteer = require("puppeteer");
const ffmpeg = require("fluent-ffmpeg");

console.log(`📜 Video Downloader module loaded!`);

async function downloadVideo(siteUrl, chatId) {
  return new Promise(async (resolve, reject) => {
    let browser;
    let statusMsg;

    try {
      statusMsg = await bot.sendMessage(
        chatId,
        `⏳ *Checking URL...*\nLooking for a video stream on: \`${siteUrl}\``,
        { parse_mode: "Markdown" },
      );

      browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      let videoUrl = "";

      // Intercept network requests to find the video source
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        if (
          url.includes("720") &&
          (url.includes(".m3u8") || url.includes(".mp4"))
        ) {
          videoUrl = url;
        }
        request.continue();
      });

      await page
        .goto(siteUrl, { waitUntil: "networkidle2", timeout: 45000 })
        .catch((e) => {
          console.log("Navigation finished or timed out.");
        });

      // Try to trigger video load
      await page.click("body").catch(() => {});
      // Wait a bit to see if requests fire
      await new Promise((r) => setTimeout(r, 3000));

      await browser.close();

      console.log(
        "🚀 ~ video-download.js:54 ~ downloadVideo ~ videoUrl:",
        videoUrl,
      );
      if (videoUrl) {
        // await bot.sendMessage(chatId, videoUrl, { parse_mode: "Markdown" });
        // resolve();
        // return;
        await bot
          .editMessageText(
            `⏳ *Downloading Video...*\nFound stream URL. Starting download...\n\n ${videoUrl}`,
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
              parse_mode: "Markdown",
            },
          )
          .catch(() => {});

        const downloadsDir = path.join(__dirname, "../../downloads");
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true });
        }

        const outputFilename = `download_${chatId}_${Date.now()}.mp4`;
        const outputPath = path.join(downloadsDir, outputFilename);

        let lastUpdateTime = Date.now();
        ffmpeg(videoUrl)
          .output(outputPath)
          .on("progress", (progress) => {
            console.log("🚀 ~ downloading...:", progress.percent.toFixed(1));
            const now = Date.now();
            if (now - lastUpdateTime > 3500 && progress.percent) {
              lastUpdateTime = now;
              bot
                .editMessageText(
                  `⏳ *Downloading Video...*\n📊 Progress: \`${progress.percent.toFixed(1)}%\``,
                  {
                    chat_id: chatId,
                    message_id: statusMsg.message_id,
                    parse_mode: "Markdown",
                  },
                )
                .catch(() => {});
            }
          })
          .on("end", async () => {
            await bot
              .editMessageText(
                `📤 *Uploading to Telegram...*\nPlease wait while the file is sent.`,
                {
                  chat_id: chatId,
                  message_id: statusMsg.message_id,
                  parse_mode: "Markdown",
                },
              )
              .catch(() => {});

            bot
              .sendVideo(chatId, outputPath)
              .then(() => {
                bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                resolve();
              })
              .catch((err) => {
                bot.sendMessage(
                  chatId,
                  `❌ Failed to send video: ${err.message}`,
                );
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
              });
          })
          .on("error", (err) => {
            bot
              .editMessageText(`❌ *FFmpeg error:*\n${err.message}`, {
                chat_id: chatId,
                message_id: statusMsg.message_id,
                parse_mode: "Markdown",
              })
              .catch(() => {});
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            reject(err);
          })
          .run();
      } else {
        await bot
          .editMessageText(
            `❌ Could not find a video stream automatically for this URL.`,
            {
              chat_id: chatId,
              message_id: statusMsg.message_id,
            },
          )
          .catch(() => {});
        resolve();
      }
    } catch (err) {
      if (browser) await browser.close().catch(() => {});
      bot.sendMessage(
        chatId,
        `❌ *Error processing request:*\n${err.message}`,
        { parse_mode: "Markdown" },
      );
      reject(err);
    }
  });
}

function registerVideoDownloadHandler() {
  bot.onText(/\/(download|dl)\s+(https?:\/\/[^\s]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const siteUrl = match[2];
    console.log(
      "🚀 ~ video-download.js:161 ~ registerVideoDownloadHandler ~ siteUrl:",
      siteUrl,
    );

    try {
      await downloadVideo(siteUrl, chatId);
    } catch (e) {
      console.error("Download failed:", e);
    }
  });
}

module.exports = { registerVideoDownloadHandler, downloadVideo };
