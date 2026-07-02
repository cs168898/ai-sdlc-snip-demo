#!/usr/bin/env node
'use strict';

const BASE = (process.env.SNIP_API || 'http://localhost:3000').replace(/\/$/, '');
const [cmd, arg] = process.argv.slice(2);

// ── helpers ────────────────────────────────────────────────────────────────

const die = (msg) => { process.stderr.write(msg + '\n'); process.exit(1); };

function usage() {
  console.log(
    'Snip \u2013 tiny URL shortener CLI\n' +
    '\n' +
    'Usage:\n' +
    '  snip add <url>    Shorten a URL; prints the short link\n' +
    '  snip ls           List all short links\n' +
    '  snip open <code>  Open a short link in the OS browser\n' +
    '  snip help         Show this message\n' +
    '\n' +
    'Backend: ' + BASE + '  (override with SNIP_API=<url>)'
  );
}

// ── GET /:code without following the redirect ──────────────────────────────
// fetch(redirect:'manual') returns an opaque response in Node.js (no headers),
// so we use the built-in http/https module which does NOT follow redirects.

const getRedirectTarget = (code) =>
  new Promise((resolve, reject) => {
    const url = new URL(BASE + '/' + code);
    const mod = require(url.protocol === 'https:' ? 'https' : 'http');
    mod
      .get({ host: url.host, path: url.pathname + url.search }, (res) => {
        res.resume(); // discard body
        if (res.statusCode === 404) {
          reject(new Error('Unknown code: ' + code));
        } else if (res.headers.location) {
          resolve(res.headers.location);
        } else {
          reject(new Error('No redirect for code "' + code + '" (HTTP ' + res.statusCode + ')'));
        }
      })
      .on('error', (e) =>
        reject(new Error('Cannot reach backend at ' + BASE + ': ' + e.message))
      );
  });

// ── commands ───────────────────────────────────────────────────────────────

async function cmdAdd(url) {
  if (!url) die('Usage: snip add <url>');
  let res;
  try {
    res = await fetch(BASE + '/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch (e) {
    die('Cannot reach backend at ' + BASE + ': ' + e.message);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die('Error ' + res.status + ': ' + (body.error || res.statusText));
  console.log(body.shortUrl);
}

async function cmdLs() {
  let res;
  try {
    res = await fetch(BASE + '/api/links');
  } catch (e) {
    die('Cannot reach backend at ' + BASE + ': ' + e.message);
  }
  if (!res.ok) die('Error ' + res.status + ': ' + res.statusText);
  const links = await res.json();
  if (links.length === 0) { console.log('No links yet.'); return; }

  const codeW = Math.max(4, ...links.map((l) => l.code.length));
  const hitsW = Math.max(4, ...links.map((l) => String(l.hits).length));
  const row = (code, hits, url) =>
    code.padEnd(codeW) + '  ' + hits.padStart(hitsW) + '  ' + url;

  console.log(row('CODE', 'HITS', 'URL'));
  console.log(row('-'.repeat(codeW), '-'.repeat(hitsW), '-'.repeat(45)));
  for (const l of links) {
    console.log(row(l.code, String(l.hits), l.url));
  }
}

async function cmdOpen(code) {
  if (!code) die('Usage: snip open <code>');
  const location = await getRedirectTarget(code);
  const { spawn } = require('child_process');
  const child =
    process.platform === 'win32'
      ? spawn('cmd', ['/c', 'start', '', location], { detached: true, stdio: 'ignore' })
      : process.platform === 'darwin'
      ? spawn('open', [location], { detached: true, stdio: 'ignore' })
      : spawn('xdg-open', [location], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('Opening ' + location);
}

// ── dispatch ────────────────────────────────────────────────────────────────

(async () => {
  try {
    switch (cmd) {
      case 'add':  await cmdAdd(arg);  break;
      case 'ls':   await cmdLs();      break;
      case 'open': await cmdOpen(arg); break;
      case 'help':
      case undefined: usage(); break;
      default: die('Unknown command: "' + cmd + '"\nRun "snip help" for usage.');
    }
  } catch (e) {
    die(e.message);
  }
})();
