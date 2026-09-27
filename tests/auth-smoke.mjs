import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

let port = 3137;
let server;
let serverLog = '';
try {
  const response = await fetch('http://localhost:3000/preview', { signal: AbortSignal.timeout(2000) });
  if (response.ok && (await response.text()).includes('Chào bạn')) port = 3000;
} catch { /* No reusable development server. */ }
if (port === 3137) {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(port)], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:59999', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'ui-smoke-only' },
  });
  server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
  server.stderr.on('data', (chunk) => { serverLog += String(chunk); });
}
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
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
    assert.equal(await page.title(), 'NoteIelts · Sổ từ vựng của bạn');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `horizontal overflow at ${width}px`);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.split(',')[0].replaceAll('"', '')), 'Plus Jakarta Sans Variable');
    await page.getByRole('button', { name: 'Đăng ký' }).click();
    assert.ok(await page.getByRole('button', { name: 'Tạo tài khoản' }).isVisible());
    assert.equal(await page.getByRole('button', { name: 'Tạo tài khoản' }).getAttribute('type'), 'submit');
    if (width === 375) {
      let signupRequests = 0;
      await page.route('**/auth/v1/signup**', async (route) => {
        signupRequests++;
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'email_address_invalid', msg: 'Invalid email' }) });
      });
      await page.locator('#auth-email').fill('test@example.org');
      await page.locator('#auth-password').fill('N0teIelts!Test2026');
      await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
      await page.getByRole('alert').getByText(/Địa chỉ email không hợp lệ/).waitFor();
      assert.equal(signupRequests, 1, 'sign-up button should submit exactly once');
      await page.unroute('**/auth/v1/signup**');
      await page.route('**/auth/v1/signup**', async (route) => {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'unexpected_failure', message: 'Error sending confirmation email' }) });
      });
      await page.route('**/auth/v1/resend**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
      await page.locator('.form-error').getByText(/không gửi được email xác nhận/).waitFor();
      await page.getByRole('button', { name: 'Gửi lại email xác nhận' }).click();
      await page.locator('.success-message').getByText(/Đã gửi lại email xác nhận/).waitFor();
      await page.unroute('**/auth/v1/signup**');
      await page.unroute('**/auth/v1/resend**');
    }
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
    if (width === 375) {
      await page.route('**/api/dictionary?word=graps', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ definitions: [{
          part_of_speech: 'verb', definition: 'To grip; to take hold, particularly with the hand.',
          usage_note: '(chiefly African-American Vernacular and UK, dialectal) Alternative form of grasp.', example: '',
        }], source_name: 'Datamuse' }) });
      });
      await page.locator('#word-input').fill('graps');
      await page.getByRole('button', { name: 'Tra từ' }).click();
      await page.waitForFunction(() => document.querySelector('#definition')?.value === 'To grip; to take hold, particularly with the hand.');
      assert.equal(await page.locator('#definition').inputValue(), 'To grip; to take hold, particularly with the hand.');
      assert.equal(await page.locator('.meaning-option small').innerText(), '(chiefly African-American Vernacular and UK, dialectal) Alternative form of grasp.');
      await page.unroute('**/api/dictionary?word=graps');
    }
    await page.getByRole('button', { name: 'Đóng' }).click();
    await page.close();
  }
  console.log('Auth and notebook layout/interactions: 375px, 768px, 1440px passed');
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch { /* Process already exited. */ } }
}
