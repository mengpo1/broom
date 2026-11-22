// Shared helpers for browser automation (Playwright + Chromium with WebGPU).
// WebGPU canvas presentation needs a display: when none is available a virtual X server
// (Xvfb) is started. On a real desktop session the existing display is used.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire('/opt/node22/lib/node_modules/');
export const { chromium } = require('playwright');
let xvfb = null;
let displayNumber = 90 + Math.floor(Math.random() * 9);

async function ensureDisplay() {
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return;
  const display = `:${displayNumber++}`;          // a new number each time: the previous server may still be shutting down
  xvfb = spawn('Xvfb', [display, '-screen', '0', '2720x1620x24', '-nolisten', 'tcp'], { stdio: 'ignore' });
  process.env.DISPLAY = display;
  const lock = `/tmp/.X11-unix/X${display.slice(1)}`;
  for (let i = 0; i < 50 && !existsSync(lock); i++) await new Promise((r) => setTimeout(r, 100));
}

/** Stop the virtual X server started here, and forget its address so that the next game opened starts a new one. */
export function closeDisplay() { if (xvfb) { xvfb.kill(); xvfb = null; delete process.env.DISPLAY; } }

/** Open index.html from disk, wait until the game API is ready. Network requests are recorded. */
export async function openGame({ width = 1280, height = 720, hash = '', extraArgs = [] } = {}) {
  await ensureDisplay();
  const browser = await chromium.launch({
    headless: false, channel: 'chromium',
    // (no watchdog on the graphics process: with the software renderer, a script that queues many pictures in one go
    // keeps it busy for longer than the watchdog allows, and the browser then drops the graphics device)
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', `--window-size=${width + 16},${height + 120}`, ...extraArgs],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const logs = [], requests = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith('file://')) requests.push(r.url()); });
  // VIRAGE_HTML: another build of the game to open (a long recording made in several runs uses one frozen copy)
  const file = process.env.VIRAGE_HTML ? resolve(root, process.env.VIRAGE_HTML) : `${root}/index.html`;
  await page.goto(`file://${file}${hash ? '#' + hash : ''}`);
  await page.waitForFunction(() => window.virage || window.virageFailed, null, { timeout: 120000 });
  const ready = await page.evaluate(() => !!window.virage);
  const close = async () => { await browser.close(); closeDisplay(); };
  return { browser, page, logs, requests, ready, close };
}

/**
 * Bundle an ES module entry into a throw-away standalone page and open it (development harnesses:
 * art previews, audio checks...). The page gets a <canvas id="c">. Returns { page, logs, close }.
 */
export async function openStandalone({ entry, width = 1280, height = 720, body, outFile } = {}) {
  const { standalonePage } = await import('./build.mjs');
  const { writeFileSync, mkdirSync } = await import('node:fs');
  await ensureDisplay();
  const html = standalonePage(resolve(root, entry), body);
  const file = outFile || resolve(root, `work/logs/standalone-${process.pid}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  const browser = await chromium.launch({
    headless: false, channel: 'chromium',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--autoplay-policy=no-user-gesture-required', `--window-size=${width + 16},${height + 120}`],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`file://${file}`);
  const close = async () => { await browser.close(); closeDisplay(); };
  return { browser, page, logs, close, file };
}
