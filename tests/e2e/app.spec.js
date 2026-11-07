'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const P = require('../../src/pack.js');

const goal = (page) => page.getByRole('textbox', { name: 'Project goal', exact: true });
const title = (page) => page.getByRole('textbox', { name: 'Pack title', exact: true });

test('blank pack shows essentials and no fictional project', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Packwright', exact: true })).toBeVisible();
  await expect(page.locator('#preview')).toContainText('Untitled context pack');
  await expect(page.locator('#preview')).toContainText('Do not invent content');
  await expect(page.locator('#preview')).not.toContainText('Hearth & Rye');
  await expect(page.locator('#checklist')).toContainText('Still needed');
  await expect(page.locator('#checklist')).toContainText('Add a project goal');
  await expect(page.locator('#notes-count')).toHaveText('0 words · 0 characters in your included notes');
  await expect(page.locator('#count-note')).toContainText('not token counts');
  await expect(page.locator('#sample-banner')).toBeHidden();
});

test('each sample loads, stays labeled, and does not ask before replacing another sample', async ({ page }) => {
  await page.goto('/');
  const tokens = [
    ['Small business', 'Hearth & Rye'],
    ['Writing and research', 'North Ward Notes'],
    ['Learning', 'Lantern Pantry'],
    ['Coding', 'Kitchen Card Box']
  ];
  for (const [name, token] of tokens) {
    await page.getByRole('button', { name: name, exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(title(page)).toHaveValue(/^Sample:/);
    await expect(page.locator('#badge-goal')).toBeVisible();
    await expect(page.locator('#sample-banner')).toContainText('fictional examples');
    await expect(page.locator('#preview')).toContainText(token);
    await expect(page.locator('#preview')).toContainText('fictional sample copy');
    await expect(page.locator('#checklist')).toContainText('Sample text is still included');
  }
});

test('editing a sample marks it as yours and blocks a destructive switch until you confirm', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Small business', exact: true }).click();
  await goal(page).fill('MY OWN GOAL');
  await expect(page.locator('#badge-goal')).toBeHidden();
  await expect(page.locator('#badge-audience')).toBeVisible();
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Replace your notes');
  await expect(page.locator('#confirm-cancel')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(goal(page)).toHaveValue('MY OWN GOAL');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(goal(page)).toHaveValue('MY OWN GOAL');
  await page.getByRole('button', { name: 'Coding', exact: true }).click();
  await page.getByRole('button', { name: 'Replace notes' }).click();
  await expect(goal(page)).toHaveValue(/personal recipe box/);
  await expect(page.locator('#preview')).toContainText('Kitchen Card Box');
  await expect(page.locator('#preview')).not.toContainText('MY OWN GOAL');
});

test('clear asks before removing notes and does nothing when the pack is empty', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Clear pack' }).click();
  await expect(page.locator('#status')).toContainText('already empty');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Learning', exact: true }).click();
  await page.getByRole('button', { name: 'Clear pack' }).click();
  await expect(page.getByRole('dialog')).toContainText('will be removed');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(goal(page)).toHaveValue(/Lantern Pantry|spreadsheet/);
  await page.getByRole('button', { name: 'Blank pack', exact: true }).click();
  await page.getByRole('button', { name: 'Clear notes' }).click();
  await expect(goal(page)).toHaveValue('');
  await expect(title(page)).toHaveValue('');
  await expect(page.locator('#preview')).toContainText('Untitled context pack');
  await expect(page.locator('#preview')).not.toContainText('Lantern Pantry');
});

test('turning a section off keeps the text and drops it from the preview and download', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Small business', exact: true }).click();
  const unique = 'Maximum 4 loaves per household.';
  await expect(page.locator('#preview')).toContainText(unique);
  await page.getByRole('checkbox', { name: 'Include Constraints in the pack' }).uncheck();
  await expect(page.getByRole('textbox', { name: 'Constraints', exact: true })).toHaveValue(new RegExp(unique.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('#preview')).not.toContainText(unique);
  await expect(page.locator('#preview')).toContainText('Left out on purpose');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Markdown' }).click()
  ]);
  const saved = path.join(os.tmpdir(), download.suggestedFilename());
  await download.saveAs(saved);
  const markdown = fs.readFileSync(saved, 'utf8');
  expect(markdown.includes(unique)).toBe(false);
  expect(markdown).toContain('Left out on purpose');
  expect(markdown).toContain('Hearth & Rye');
  expectDownloadName(download, 'Sample Weekend preorder page for Hearth & Rye.md');
});

test('counts follow the included notes and the exported file', async ({ page }) => {
  await page.goto('/');
  await goal(page).fill('one two three');
  await page.getByRole('textbox', { name: 'Audience', exact: true }).fill('😀 neighbors');
  const notes = 'one two three\n😀 neighbors';
  const noteChars = Array.from(notes).length;
  const noteWords = notes.trim().split(/\s+/).length;
  expect(noteWords).toBe(5);
  expect(noteChars).toBe(25);
  await expect(page.locator('#notes-count')).toHaveText(noteWords + ' words · ' + noteChars + ' characters in your included notes');
  const fileText = await page.locator('#preview-source').evaluate((element) => element.textContent);
  const chars = Array.from(fileText).length;
  const words = fileText.trim().split(/\s+/).length;
  await expect(page.locator('#file-count')).toContainText(words + ' words · ' + chars + ' characters');
  await expect(page.locator('#preview')).toContainText('😀 neighbors');
});

test('markdown source view shows the same file as the download', async ({ page }) => {
  await page.goto('/');
  await title(page).fill('Café plan 🍞');
  await goal(page).fill('Line one\nLine two');
  await page.getByRole('radio', { name: 'Markdown text' }).check();
  const source = await page.locator('#preview-source').evaluate((element) => element.textContent);
  expect(source).toContain('# Context pack: Café plan 🍞');
  expect(source).toContain('Line one\nLine two');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Markdown' }).click()
  ]);
  const saved = path.join(os.tmpdir(), 'cafe-plan.md');
  await download.saveAs(saved);
  expect(fs.readFileSync(saved, 'utf8')).toBe(source);
  expectDownloadName(download, P.safeFilename('Café plan 🍞', 'md'));
});

test('full flow: fill, preview, download, clear, import, same content', async ({ page }) => {
  await page.goto('/');
  const values = {
    title: 'Café tool library',
    goal: 'Write a Saturday borrow list.\nSecond line 🍞\n<script>window.__xss=1</script>',
    audience: 'Neighbors on the block.',
    background: 'The library is a folding table.',
    currentState: 'We already own a hammer.',
    preferences: 'Short headings. No slogans.',
    constraints: 'Do not invent prices or a room number.',
    unknowns: 'Whether the ladder is free.',
    references: 'Hammer. Ladder. Two sawhorses.',
    nextDeliverable: 'A one-page list I can print.'
  };
  await title(page).fill(values.title);
  for (const section of P.SECTIONS) {
    await page.getByRole('textbox', { name: section.heading, exact: true }).fill(values[section.id]);
  }
  await page.getByRole('checkbox', { name: 'Include Unknowns in the pack' }).uncheck();
  await expect(page.locator('#preview')).toContainText('Saturday borrow list');
  await expect(page.locator('#preview')).toContainText('Provided source notes');
  await expect(page.locator('#preview')).toContainText('Hammer. Ladder. Two sawhorses.');
  await expect(page.locator('#preview')).not.toContainText('Whether the ladder is free.');
  await expect(page.locator('#checklist')).toContainText('Ready');

  const [markdownDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Markdown' }).click()
  ]);
  const markdownPath = path.join(os.tmpdir(), 'full-flow.md');
  await markdownDownload.saveAs(markdownPath);
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  expect(markdown).toContain('Café tool library');
  expect(markdown).toContain('<script>window.__xss=1</script>');
  expect(markdown).not.toContain('Whether the ladder is free.');
  expect(markdown).toContain('not encrypted');
  expect(markdown.startsWith('<!DOCTYPE')).toBe(false);

  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save JSON' }).click()
  ]);
  const jsonPath = path.join(os.tmpdir(), 'full-flow.json');
  await jsonDownload.saveAs(jsonPath);
  expectDownloadName(jsonDownload, 'Café tool library.json');
  const savedPack = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  expect(savedPack.schemaVersion).toBe(1);
  expect(savedPack.sections.unknowns.included).toBe(false);
  expect(savedPack.sections.goal.text).toContain('🍞');

  await page.getByRole('button', { name: 'Clear pack' }).click();
  await page.getByRole('button', { name: 'Clear notes' }).click();
  await expect(goal(page)).toHaveValue('');

  await page.locator('#import-file').setInputFiles(jsonPath);
  await expect(goal(page)).toHaveValue(values.goal);
  await expect(title(page)).toHaveValue(values.title);
  for (const section of P.SECTIONS) {
    await expect(page.getByRole('textbox', { name: section.heading, exact: true })).toHaveValue(values[section.id]);
  }
  await expect(page.getByRole('checkbox', { name: 'Include Unknowns in the pack' })).not.toBeChecked();
  await expect(page.locator('#status')).toContainText('Imported the pack');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('import of a bad file leaves the current notes alone', async ({ page }) => {
  await page.goto('/');
  await goal(page).fill('Do not lose this goal.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packwright-'));
  const cases = [
    ['broken.json', '{', /not valid JSON/],
    ['version.json', versionFile(), /schema version 2/],
    ['unknown.json', unknownFile(), /does not accept/],
    ['section.json', unknownSectionFile(), /does not accept/],
    ['huge.json', 'x'.repeat(P.MAX_IMPORT_BYTES + 20), /too large/]
  ];
  for (const [name, contents, pattern] of cases) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, contents);
    await page.locator('#import-file').setInputFiles(file);
    await expect(page.locator('#import-alert')).toContainText(pattern);
    await expect(page.locator('#import-alert')).toContainText('Nothing was changed');
    await expect(goal(page)).toHaveValue('Do not lose this goal.');
  }
});

test('import asks before replacing notes and cancel keeps them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Small business', exact: true }).click();
  const file = path.join(os.tmpdir(), 'coding-pack.json');
  fs.writeFileSync(file, P.exportJson(P.presetPack('coding')));
  await page.locator('#import-file').setInputFiles(file);
  await expect(page.getByRole('dialog')).toContainText('imported pack');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(goal(page)).toHaveValue(/Hearth & Rye/);
  await expect(page.locator('#status')).toContainText('Import cancelled');
  await page.locator('#import-file').setInputFiles(file);
  await page.getByRole('button', { name: 'Replace notes' }).click();
  await expect(goal(page)).toHaveValue(/personal recipe box/);
});

test('reserved download names fall back to context-pack.md', async ({ page }) => {
  await page.goto('/');
  await title(page).fill('CON');
  await goal(page).fill('A real goal that is long enough.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Markdown' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('context-pack.md');
});

function expectDownloadName(download, expected) {
  const suggested = download.suggestedFilename();
  expect([expected, expected.replace(/ /g, '_')]).toContain(suggested);
}

function versionFile() {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.schemaVersion = 2;
  return JSON.stringify(data);
}

function unknownFile() {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.note = '<img src=x onerror="window.__xss=1">';
  return JSON.stringify(data);
}

function unknownSectionFile() {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.sections.goal.hint = 'nope';
  return JSON.stringify(data);
}
