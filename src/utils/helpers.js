const fs = require("fs");
const path = require("path");

/**
 * Validates if the given string is a valid URL
 * @param {string} text
 * @returns {string|null} The URL if valid, null otherwise
 */
function extractUrl(text) {
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

/**
 * Formats file size in bytes to a human-readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Ensures the downloads directory exists
 * @returns {string} The absolute path to the downloads directory
 */
function ensureDownloadDir() {
  const downloadDir = path.join(__dirname, "../../downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  return downloadDir;
}

/**
 * Deletes a file from disk
 * @param {string} filePath
 */
function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🧹 Cleaned up: ${filePath}`);
    }
  } catch (err) {
    console.error(`⚠️ Failed to clean up file: ${filePath}`, err.message);
  }
}

module.exports = {
  extractUrl,
  formatFileSize,
  ensureDownloadDir,
  cleanupFile,
};
