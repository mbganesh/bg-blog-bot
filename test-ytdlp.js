const { spawn } = require("child_process");

const format = "bestvideo[height<=144]+bestaudio/best[height<=144]";
const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const p = spawn("yt-dlp", [
  "-f", format,
  "--merge-output-format", "mp4",
  "-o", "test.mp4",
  "--newline",
  url
]);

p.stdout.on("data", d => console.log(d.toString().trim()));
p.stderr.on("data", d => console.error("ERR:", d.toString().trim()));
p.on("close", code => console.log("Exit code:", code));
