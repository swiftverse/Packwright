'use strict';

const path = require('path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { trackRequests, externalRequests } = require('./helpers');

const fileUrl = pathToFileURL(path.join(__dirname, '..', '..', 'dist', 'packwright.html')).href;
const payload = '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">';

test('script and image payloads stay text in the preview', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    dialog.dismiss();
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill(payload);
  await expect(page.locator('#preview')).toContainText('<script>window.__xss=1</script>');
  await expect(page.locator('#preview')).toContainText('<img src=x');
  const html = await page.locator('#preview').evaluate((element) => element.innerHTML);
  expect(html.toLowerCase()).not.toContain('<script');
  expect(html.toLowerCase()).not.toContain('<img');
  expect(await page.locator('#preview img, #preview script').count()).toBe(0);
  expect(await page.locator('script').count()).toBe(2);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(dialogs).toEqual([]);
});

test('clipboard success and blocked-copy fallback both leave the notes in place', async ({ page, context }, testInfo) => {
  if (testInfo.project.name === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('Clipboard goal text');
  await page.getByRole('button', { name: 'Copy pack' }).click();
  if (testInfo.project.name === 'chromium') {
    await expect(page.locator('#status')).toContainText('Copied the pack');
    await expect(page.locator('#copy-fallback')).toBeHidden();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('Clipboard goal text');
    expect(copied).toContain('not encrypted');
  } else {
    const status = await page.locator('#status').innerText();
    if (status.includes('Copied the pack')) {
      await expect(page.locator('#copy-fallback')).toBeHidden();
    } else {
      await expect(page.locator('#copy-fallback-text')).toHaveValue(/Clipboard goal text/);
    }
  }

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) }
    });
    document.execCommand = () => false;
  });
  await page.getByRole('button', { name: 'Copy pack' }).click();
  await expect(page.locator('#status')).toContainText('Copy is blocked');
  await expect(page.locator('#copy-fallback')).toBeVisible();
  await expect(page.locator('#copy-fallback-text')).toHaveValue(/Clipboard goal text/);
  await expect(page.locator('#copy-fallback-text')).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('Clipboard goal text');
});

test('manual copy fallback can succeed when the clipboard API is missing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    document.execCommand = (command) => command === 'copy';
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('Fallback path');
  await page.getByRole('button', { name: 'Copy pack' }).click();
  await expect(page.locator('#status')).toContainText('Copied the pack');
  await expect(page.locator('#copy-fallback')).toBeHidden();
});

test('the served page does not request other origins', async ({ page }) => {
  const urls = trackRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Small business', exact: true }).click();
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('Local only');
  await page.locator('summary').click();
  await page.getByLabel('Theme').selectOption('dark');
  expect(externalRequests(urls)).toEqual([]);
  const paths = urls.map((url) => new URL(url).pathname);
  for (const pathname of paths) {
    expect(['/', '/packwright.html', '/favicon.ico']).toContain(pathname);
  }
});

test('file:// opens offline and makes no network request', async ({ page }) => {
  const urls = trackRequests(page);
  await page.goto(fileUrl);
  await expect(page.getByRole('heading', { name: 'Packwright', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Writing and research', exact: true }).click();
  await expect(page.locator('#preview')).toContainText('North Ward Notes');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill(payload);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  const networked = urls.filter((url) => /^https?:/i.test(url) || url.startsWith('ws:'));
  expect(networked).toEqual([]);
  expect(urls.every((url) => url.startsWith('file:') || url.startsWith('data:') || url.startsWith('blob:'))).toBe(true);
});
