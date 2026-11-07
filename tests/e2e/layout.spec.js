'use strict';

const { test, expect } = require('@playwright/test');
const P = require('../../src/pack.js');
const { expectNoHorizontalOverflow } = require('./helpers');

async function fillLongToken(page) {
  await page.getByRole('textbox', { name: 'Pack title', exact: true }).fill('Supercalifragilisticexpialidocious-tool-library-name');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('B'.repeat(180));
  await page.getByRole('textbox', { name: 'Reference notes', exact: true }).fill('https-is-not-here ' + 'word '.repeat(40) + 'Z'.repeat(120));
}

test('desktop layout has labels, keyboard focus, and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip').first()).toBeFocused();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe('none');
  for (const section of P.SECTIONS) {
    await expect(page.getByRole('textbox', { name: section.heading, exact: true })).toHaveCount(1);
    await expect(page.getByRole('checkbox', { name: 'Include ' + section.heading + ' in the pack' })).toHaveCount(1);
  }
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).focus();
  await page.keyboard.type('Line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Two');
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('Line\nTwo');
  await page.getByRole('button', { name: 'Small business', exact: true }).click();
  await fillLongToken(page);
  await expectNoHorizontalOverflow(page);
});

test('390px and 320px widths do not overflow', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width: width, height: 700 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Coding', exact: true }).click();
    await fillLongToken(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: 'Copy pack' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toBeVisible();
  }
});

test('theme changes do not discard notes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Project goal', exact: true }).fill('still here after theme');
  await page.getByLabel('Theme').selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('still here after theme');
  await page.getByLabel('Theme').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('textbox', { name: 'Project goal', exact: true })).toHaveValue('still here after theme');
  await expectNoHorizontalOverflow(page);
});

test('about text states the independent-tool limit', async ({ page }) => {
  await page.goto('/');
  await page.locator('summary').click();
  await expect(page.locator('.about')).toContainText('not affiliated with Anthropic, Claude');
  await expect(page.locator('.about')).toContainText('does not encrypt');
  await expect(page.locator('#draft-disclosure')).toContainText('off by default');
  await expect(page.locator('#draft-disclosure')).toContainText('does not send it anywhere');
});
