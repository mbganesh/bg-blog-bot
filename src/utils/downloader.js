const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { ensureDownloadDir } = require("./helpers");

/**
 * Downloads a video using yt-dlp
 * @param {string} url - The video URL to download
 * @param {function} onProgress - Callback for progress updates (optional)
 * @returns {Promise<{filePath: string, title: string, fileSize: number}>}
 */
function downloadVideo(url, onProgress = null) {
  return new Promise((resolve, reject) => {
    const downloadDir = ensureDownloadDir();
    const outputTemplate = path.join(downloadDir, "%(title).50s.%(ext)s");

    // yt-dlp arguments:
    // -f : select best video+audio under 50MB (Telegram limit)
    // -o : output filename template
    // --no-playlist : download single video only
    // --print-json : print video info as JSON after download (on last line)
    // --progress : show progress updates
    // --newline : print progress on new lines (easier to parse)
    const args = [
      "-f",
      "best[filesize<50M]/bestvideo[filesize<50M]+bestaudio[filesize<50M]/best",
      "-o",
      outputTemplate,
      "--no-playlist",
      "--newline",
      "--no-warnings",
      "--restrict-filenames",
      url,
    ];

    console.log(`📥 Starting download: ${url}`);
    const process = spawn("yt-dlp", args);

    let stdoutData = "";
    let stderrData = "";
    let lastProgress = "";

    process.stdout.on("data", (data) => {
      const output = data.toString();
      stdoutData += output;

      // Parse progress from yt-dlp output
      const progressMatch = output.match(
        /\[download\]\s+([\d.]+%.*?)(?:\r|\n)/,
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
        console.error(`❌ yt-dlp exited with code ${code}`);
        console.error(`stderr: ${stderrData}`);
        return reject(
          new Error(stderrData || `yt-dlp process exited with code ${code}`),
        );
      }

      // Find the downloaded file — pick the most recently modified file in downloads/
      try {
        const files = fs.readdirSync(downloadDir);
        if (files.length === 0) {
          return reject(new Error("No file was downloaded"));
        }

        // Get the most recently modified file
        const latestFile = files
          .map((file) => ({
            name: file,
            path: path.join(downloadDir, file),
            mtime: fs.statSync(path.join(downloadDir, file)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime)[0];

        const stats = fs.statSync(latestFile.path);
        const fileSizeMB = stats.size / (1024 * 1024);

        console.log(
          `✅ Downloaded: ${latestFile.name} (${fileSizeMB.toFixed(2)} MB)`,
        );

        // Telegram has a 50MB upload limit for bots
        if (fileSizeMB > 50) {
          return reject(
            new Error(
              `File is too large (${fileSizeMB.toFixed(2)} MB). Telegram bots can only send files up to 50 MB.`,
            ),
          );
        }

        resolve({
          filePath: latestFile.path,
          title: path.parse(latestFile.name).name,
          fileSize: stats.size,
        });
      } catch (err) {
        reject(new Error(`Error finding downloaded file: ${err.message}`));
      }
    });

    process.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "yt-dlp is not installed. Please install it:\n" +
              "  sudo apt install yt-dlp\n" +
              "  OR\n" +
              "  pip install yt-dlp",
          ),
        );
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { downloadVideo };
