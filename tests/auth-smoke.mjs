import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const port = 3137;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
  cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:59999', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'ui-smoke-only' },
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(`http://localhost:${port}`); if (response.ok) { ready = true; break; } } catch { /* Server is starting. */ }
    await delay(500);
  }
  assert.ok(ready, `Next.js did not start: ${serverLog.slice(-800)}`);
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`http://localhost:${port}`);
    assert.equal(await page.title(), 'NoteIelts · Sổ từ vựng của bạn');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `horizontal overflow at ${width}px`);
    await page.getByRole('button', { name: 'Đăng ký' }).click();
    assert.ok(await page.getByRole('button', { name: 'Tạo tài khoản' }).isVisible());
    await page.getByRole('button', { name: 'Quay lại đăng nhập' }).click();
    await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
    assert.ok(await page.getByRole('button', { name: 'Gửi email đặt lại' }).isVisible());
    await page.goto(`http://localhost:${port}/preview`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `dashboard overflow at ${width}px`);
    await page.getByRole('button', { name: /^Sổ từ/ }).click();
    assert.ok(await page.getByRole('heading', { name: 'Sổ từ của bạn' }).isVisible());
    await page.getByRole('button', { name: 'Ôn tập' }).click();
    assert.ok(await page.getByRole('heading', { name: 'Ôn tập flashcard' }).isVisible());
    await page.getByRole('button', { name: 'Bắt đầu học' }).click();
    assert.ok(await page.getByRole('button', { name: 'Đã nhớ' }).isDisabled());
    await page.getByRole('button', { name: 'Lật thẻ để xem nghĩa' }).click();
    assert.ok(await page.getByText('The occurrence of pleasant discoveries by chance.').isVisible());
    assert.ok(await page.getByRole('button', { name: 'Đã nhớ' }).isEnabled());
    await page.getByRole('button', { name: 'Cài đặt' }).click();
    assert.ok(await page.getByRole('heading', { name: 'Cài đặt & sao lưu' }).isVisible());
    await page.getByRole('button', { name: 'Thêm từ' }).click();
    assert.ok(await page.getByRole('heading', { name: 'Một từ mới hôm nay' }).isVisible());
    await page.getByRole('button', { name: 'Đóng' }).click();
    await page.close();
  }
  console.log('Auth and notebook layout/interactions: 375px, 768px, 1440px passed');
} finally {
  await browser?.close();
  if (server.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* Process already exited. */ } }
}
