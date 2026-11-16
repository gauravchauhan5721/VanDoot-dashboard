// Local-only static export server, including byte ranges for bundled recordings.
import http from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, sep, extname } from "node:path";
const root = resolve("dist");
const port = Number(process.argv[process.argv.indexOf("--port") + 1]) || 4173;
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".txt":"text/plain", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".mp4":"video/mp4", ".wav":"audio/wav", ".woff2":"font/woff2" };
http.createServer(async (req,res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = resolve(root, "." + (name === "/" ? "/index.html" : name));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || "");
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]),info.size-1) : info.size-1;
    if (start > end || start >= info.size) { res.writeHead(416, {"Content-Range":`bytes */${info.size}`}).end(); return; }
    res.writeHead(match ? 206 : 200, {"Content-Type":mime[extname(file)] || "application/octet-stream", "Content-Length":end-start+1, "Accept-Ranges":"bytes", ...(match ? {"Content-Range":`bytes ${start}-${end}/${info.size}`} : {})});
    if (req.method === "HEAD") res.end(); else createReadStream(file,{start,end}).pipe(res);
  } catch { res.writeHead(404).end("Not found. Run node scripts/build-preview.mjs first."); }
}).listen(port,"127.0.0.1",()=>console.log(`VanDoot Demo: http://localhost:${port}`));
