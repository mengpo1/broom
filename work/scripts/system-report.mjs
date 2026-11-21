// Linux compatibility report: detects distribution, CPU, memory, GPU and drivers, display server,
// browser and WebGPU support, resolution and refresh rate. Read-only: nothing is changed on the
// system. Writes work/benchmarks/system-report.json and prints a summary.
// node work/scripts/system-report.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { openGame, root } from './lib-browser.mjs';

const sh = (cmd) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).toString().trim(); } catch { return ''; } };
const read = (file) => { try { return readFileSync(file, 'utf8'); } catch { return ''; } };
const field = (text, key) => { const m = text.match(new RegExp(`^${key}\\s*[:=]\\s*"?([^"\\n]*)"?`, 'm')); return m ? m[1].trim() : ''; };

const osRelease = read('/etc/os-release'), cpuinfo = read('/proc/cpuinfo'), meminfo = read('/proc/meminfo');
const hadDisplay = !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
const system = {
  distribution: field(osRelease, 'PRETTY_NAME') || 'unknown', kernel: sh('uname -r'), architecture: sh('uname -m'),
  cpu: { model: field(cpuinfo, 'model name') || sh('lscpu | grep "Model name" | cut -d: -f2').trim(), logicalCores: (cpuinfo.match(/^processor/gm) || []).length },
  memoryGB: +(parseInt(field(meminfo, 'MemTotal'), 10) / 1048576).toFixed(1),
  displayServer: process.env.WAYLAND_DISPLAY ? 'Wayland' : process.env.DISPLAY ? 'X11' : 'none (a virtual X server, Xvfb, is started for the tests)',
  sessionType: process.env.XDG_SESSION_TYPE || '',
  gpuDevices: sh('lspci 2>/dev/null | grep -Ei "vga|3d|display"') || 'no PCI display device reported',
  glRenderer: sh('glxinfo -B 2>/dev/null | grep -E "OpenGL renderer|OpenGL version"'),
  vulkan: sh('vulkaninfo --summary 2>/dev/null | grep -E "deviceName|driverName|driverInfo" | head -6'),
  kernelDrivers: sh('lsmod 2>/dev/null | grep -Ei "^(nvidia|amdgpu|i915|xe|nouveau|radeon) " | cut -d" " -f1').split('\n').filter(Boolean),
  xrandr: hadDisplay ? sh('xrandr --current 2>/dev/null | grep -E "\\*" | head -4') : '',
};

const { page, browser, close } = await openGame({ width: 1280, height: 720, hash: 'manual=1&quality=low' });
const web = await page.evaluate(async () => {
  const v = window.virage;
  const env = v.describeEnvironment(v.app);
  env.refreshRateHz = await v.measureRefreshRate();
  env.artTimings = v.app.art.timings;
  return env;
});
web.browserVersion = browser.version();
await close();

const report = { date: new Date().toISOString(), system, browser: web };
mkdirSync(`${root}/work/benchmarks`, { recursive: true });
writeFileSync(`${root}/work/benchmarks/system-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
void existsSync;
