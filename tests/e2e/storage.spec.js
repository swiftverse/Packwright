'use strict';

const { test, expect } = require('@playwright/test');

test('a saved draft restores after refresh and delete removes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('restore-me-please 🦊');
  await page.getByLabel('Keep a draft in this browser').check();
  await expect(page.locator('#draft-message')).toContainText('not encrypted');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('restore-me-please 🦊');
  await expect(page.getByLabel('Keep a draft in this browser')).toBeChecked();
  await expect(page.locator('#status')).toContainText('Restored the draft');

  await page.getByLabel('Keep a draft in this browser').uncheck();
  await expect(page.getByRole('dialog')).toContainText('deletes the copy');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Keep a draft in this browser')).toBeChecked();

  await page.getByLabel('Keep a draft in this browser').uncheck();
  await page.getByRole('button', { name: 'Delete saved draft' }).click();
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('restore-me-please 🦊');
  await expect(page.locator('#draft-message')).toContainText('deleted from this browser');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('');
  await expect(page.getByLabel('Keep a draft in this browser')).not.toBeChecked();
});

test('draft saving stays off until the person turns it on', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('not stored yet');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('');
  const stored = await page.evaluate(() => window.localStorage.getItem('packwright.v1.draft'));
  expect(stored).toBeNull();
});

test('blocked storage is reported and the notes stay in the tab', async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: deny
    });
  });
  await page.goto('/');
  await expect(page.locator('#draft-message')).toContainText('blocked local storage');
  await expect(page.getByLabel('Keep a draft in this browser')).toBeDisabled();
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('still in the tab');
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('still in the tab');
  await expect(page.locator('#preview')).toContainText('still in the tab');
});

test('a full storage quota does not wipe the tab or pretend the draft was saved', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key) === 'packwright.v1.draft') {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('keep this sentence please');
  await page.getByLabel('Keep a draft in this browser').click();
  await expect(page.locator('#draft-message')).toContainText('storage is full');
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('keep this sentence please');
  await expect(page.getByLabel('Keep a draft in this browser')).not.toBeChecked();
  const consent = await page.evaluate(() => window.localStorage.getItem('packwright.v1.consent'));
  expect(consent).toBeNull();
});

test('a later quota failure keeps the newer notes in the tab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('first draft');
  await page.getByLabel('Keep a draft in this browser').check();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).indexOf('draft') !== -1) {
        throw new DOMException('quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('newer notes stay');
  await expect(page.locator('#draft-message')).toContainText('storage is full');
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('newer notes stay');
  await expect(page.getByLabel('Keep a draft in this browser')).toBeChecked();
});
