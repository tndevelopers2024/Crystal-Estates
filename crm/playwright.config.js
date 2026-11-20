import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * End-to-end tests for CRM workflows.
 *
 * Every /api request is answered by in-test mocks (see tests/e2e/mockApi.js).
 * VITE_API_URL points at an unused port so nothing can ever reach the real
 * (live) MongoDB-backed server, even if a route is left unmocked.
 */
const PORT = Number(process.env.CRM_E2E_PORT || 5181)

// Use the browser Playwright expects; if that exact build is missing, fall back
// to any Chromium already installed locally instead of downloading one.
function localChromium() {
  if (process.env.PW_CHROMIUM_PATH) return process.env.PW_CHROMIUM_PATH
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
      : path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright'))
  try {
    const exe = process.platform === 'win32' ? 'chrome-win64/chrome.exe' : 'chrome-linux/chrome'
    const builds = fs
      .readdirSync(root)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    for (const b of builds) {
      const p = path.join(root, b, exe)
      if (fs.existsSync(p)) return p
    }
  } catch {
    /* no local browsers — Playwright will report what to install */
  }
  return undefined
}

let executablePath
try {
  const { chromium } = await import('@playwright/test')
  if (!fs.existsSync(chromium.executablePath())) executablePath = localChromium()
} catch {
  executablePath = localChromium()
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1366, height: 860 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_API_URL: 'http://127.0.0.1:59998' },
  },
})
