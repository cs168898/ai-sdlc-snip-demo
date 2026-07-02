// server.js — Snip URL shortener (Bun, zero npm dependencies)

import { join, extname } from "path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const PUBLIC_DIR = process.env.PUBLIC_DIR ?? "";

function getBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.RAILWAY_PUBLIC_DOMAIN)
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${PORT}`;
}

/** @type {Map<string, {code:string,url:string,shortUrl:string,hits:number,createdAt:string}>} */
const links = new Map();

const BASE62 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += BASE62[Math.floor(Math.random() * 62)];
  }
  return code;
}

function isValidUrl(str) {
  try {
    const { protocol } = new URL(str);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function tryStatic(pathname) {
  if (!PUBLIC_DIR) return null;
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = join(PUBLIC_DIR, rel);
  const file = Bun.file(filePath);
  if (!(await file.exists())) return null;
  const ext = extname(filePath).toLowerCase();
  return new Response(file, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": MIME[ext] ?? "application/octet-stream",
    },
  });
}

Bun.serve({
  port: PORT,

  async fetch(req) {
    const { pathname } = new URL(req.url);
    const method = req.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // POST /api/links — create a short link
    if (method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (typeof body?.url !== "string" || !isValidUrl(body.url)) {
        return json({ error: "url must be a valid http(s) URL" }, 400);
      }

      let code;
      do {
        code = generateCode();
      } while (links.has(code));

      const link = {
        code,
        url: body.url,
        shortUrl: `${getBaseUrl()}/${code}`,
        hits: 0,
        createdAt: new Date().toISOString(),
      };
      links.set(code, link);
      return json(link, 201);
    }

    // GET /api/links — list all links
    if (method === "GET" && pathname === "/api/links") {
      return json([...links.values()]);
    }

    // GET — static files win over short codes when PUBLIC_DIR is set
    if (method === "GET") {
      const staticRes = await tryStatic(pathname);
      if (staticRes) return staticRes;
    }

    // GET /:code — redirect
    if (method === "GET" && pathname.length > 1) {
      const code = pathname.slice(1);
      const link = links.get(code);
      if (link) {
        link.hits++;
        return new Response(null, {
          status: 302,
          headers: { ...CORS_HEADERS, Location: link.url },
        });
      }
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Snip listening on port ${PORT}`);
