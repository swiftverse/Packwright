'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const fileUrl = pathToFileURL(path.join(root, 'dist', 'packwright.html')).href;
const out = path.join(root, 'assets');

async function fill(page, name, value) {
  await page.getByRole('textbox', { name: name, exact: true }).fill(value);
}

async function shot(page, name) {
  const file = path.join(out, name);
  await page.screenshot({ path: file });
  console.log(file);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    deviceScaleFactor: 1
  });
  await page.goto(fileUrl);
  await page.getByLabel('Theme').selectOption('light');
  await page.getByRole('button', { name: 'Small business', exact: true }).click();
  await page.waitForTimeout(150);
  await shot(page, 'desktop-hero.png');

  await page.getByLabel('Theme').selectOption('dark');
  await page.waitForTimeout(100);
  await shot(page, 'desktop-dark.png');
  await page.getByLabel('Theme').selectOption('light');

  await page.getByRole('button', { name: 'Blank pack', exact: true }).click();
  await page.getByRole('button', { name: 'Clear notes' }).click();
  await fill(page, 'Pack title', 'Saturday borrow list');
  await fill(page, 'Project goal', 'Write a one-page borrow list for a Saturday tool library. Neighbors should see what they can borrow, how to reserve it, and when to bring it back.');
  await fill(page, 'Audience', 'Neighbors on our block. They will read this on a phone while standing at the folding table. They are not tool experts.');
  await fill(page, 'Background', 'We set up a folding table on the first Saturday morning of each month. People lend a tool they can spare and take home something they need for a small repair. There is no website and no membership fee.');
  await fill(page, 'Current state and decisions', 'We already own a hammer, a ladder, and two sawhorses. The list will be a printed page, not an app. We will not take payment.');
  await fill(page, 'Writing preferences', 'Short headings. Plain sentences. No slogans. About one phone screen.');
  await fill(page, 'Constraints', 'Do not invent prices, addresses, or a room number. Do not promise delivery. Do not add tools that are not in the reference notes.');
  await fill(page, 'Unknowns', 'Whether the ladder is already promised to a neighbor this month. Ask before writing that it is available.');
  await fill(page, 'Reference notes', 'Hammer. Ladder. Two sawhorses. Pickup is at the folding table from 9:00 to 11:00. Bring borrowed tools back the next Saturday.');
  await fill(page, 'Desired next deliverable', 'A one-page list I can print, plus one sentence to say if someone asks for a tool that is not on the list.');
  await page.locator('#field-goal').scrollIntoViewIfNeeded();
  await shot(page, 'desktop-notes.png');
  await page.locator('#preview').screenshot({ path: path.join(out, 'desktop-preview.png') });
  console.log(path.join(out, 'desktop-preview.png'));

  await page.getByRole('radio', { name: 'Markdown text' }).check();
  const markdown = await page.locator('#preview-source').evaluate((element) => element.textContent);
  fs.writeFileSync(path.join(out, 'example-saturday-borrow.md'), markdown);
  await shot(page, 'desktop-export.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('radio', { name: 'Formatted' }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'mobile-390.png');
  await page.locator('#preview').scrollIntoViewIfNeeded();
  await shot(page, 'mobile-preview.png');

  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'mobile-320.png');

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
