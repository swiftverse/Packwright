'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../../src/pack.js');

function packWith(map) {
  const pack = P.emptyPack();
  for (const [id, value] of Object.entries(map)) {
    if (id === 'title') {
      pack.title = value;
      continue;
    }
    pack.sections[id].text = value;
    pack.sections[id].sample = false;
  }
  return pack;
}

test('empty pack has every section included and blank', () => {
  const pack = P.emptyPack();
  assert.equal(pack.title, '');
  assert.equal(pack.titleSample, false);
  assert.deepEqual(Object.keys(pack.sections), P.SECTIONS.map((section) => section.id));
  for (const section of P.SECTIONS) {
    assert.deepEqual(pack.sections[section.id], { included: true, text: '', sample: false });
  }
});

test('empty packs do not share section objects', () => {
  const first = P.emptyPack();
  first.sections.goal.text = 'changed';
  const second = P.emptyPack();
  assert.equal(second.sections.goal.text, '');
});

test('each preset is fictional, complete, and isolated', () => {
  const tokens = {
    'small-business': 'Hearth & Rye',
    'writing-research': 'North Ward Notes',
    learning: 'Lantern Pantry',
    coding: 'Kitchen Card Box'
  };
  assert.equal(P.PRESETS.length, 4);
  for (const preset of P.PRESETS) {
    const pack = P.presetPack(preset.id);
    assert.equal(pack.titleSample, true);
    assert.match(pack.title, /^Sample:/);
    assert.match(pack.sections.background.text, /fictional/);
    assert.match(pack.sections.background.text, new RegExp(tokens[preset.id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    for (const section of P.SECTIONS) {
      assert.equal(typeof pack.sections[section.id].text, 'string');
      assert.ok(pack.sections[section.id].text.trim());
      assert.equal(pack.sections[section.id].sample, true);
      assert.equal(pack.sections[section.id].included, true);
    }
    pack.sections.goal.text = 'edited by a test';
    pack.sections.goal.sample = false;
    const fresh = P.presetPack(preset.id);
    assert.notEqual(fresh.sections.goal.text, 'edited by a test');
    assert.equal(P.hasPopulatedUserEntries(pack), true);
    assert.equal(P.hasPopulatedUserEntries(fresh), false);
  }
});

test('unknown preset id throws and does not invent a pack', () => {
  assert.throws(() => P.presetPack('not-a-preset'), /Unknown preset/);
});

test('blank markdown states the gap and invents no project facts', () => {
  const markdown = P.buildMarkdown(P.emptyPack());
  assert.match(markdown, /^# Context pack: Untitled context pack\n/);
  assert.match(markdown, /## Not provided/);
  assert.match(markdown, /Do not invent content for them/);
  assert.match(markdown, /Included notes: 0 characters, 0 words\./);
  assert.match(markdown, /not token counts/);
  assert.match(markdown, /not encrypted/);
  assert.match(markdown, /not affiliated/);
  assert.doesNotMatch(markdown, /Hearth & Rye|North Ward Notes|Lantern Pantry|Kitchen Card Box|18 Lantern Street/);
  assert.doesNotMatch(markdown, /<!DOCTYPE|<html|token count:\s*\d+|quality score/i);
});

test('partial pack keeps task, source notes, constraints, and unknowns apart', () => {
  const pack = packWith({
    title: 'Saturday borrow list',
    goal: 'Write the Saturday borrow list.',
    references: 'Only these tools: hammer, ladder.',
    constraints: 'Do not invent a room number ZX-4491.',
    unknowns: 'Whether the ladder is already promised.'
  });
  pack.sections.audience.included = false;
  const markdown = P.buildMarkdown(pack);
  const taskAt = markdown.indexOf('## Task');
  const constraintsAt = markdown.indexOf('## Constraints');
  const unknownsAt = markdown.indexOf('## Unknowns');
  const sourcesAt = markdown.indexOf('## Provided source notes');
  assert.ok(taskAt >= 0 && taskAt < constraintsAt && constraintsAt < unknownsAt && unknownsAt < sourcesAt);
  assert.match(markdown, /### Project goal\n\nWrite the Saturday borrow list\./);
  assert.match(markdown, /Use it as source material/);
  assert.match(markdown, /Do not fill them in with invented facts/);
  assert.match(markdown, /Respect these limits/);
  assert.match(markdown, /ZX-4491/);
  assert.match(markdown, /## Left out on purpose/);
  assert.match(markdown, /- Audience/);
  assert.doesNotMatch(markdown, /### Audience/);
  assert.match(markdown, /## Not provided/);
  assert.match(markdown, /- Background/);
});

test('excluded section text is omitted even when it looks like markup', () => {
  const pack = packWith({
    goal: 'Keep the secret sentence out of the file.',
    constraints: 'UNIQUE-CONSTRAINT-SENTENCE <script>nope</script>'
  });
  pack.sections.constraints.included = false;
  const markdown = P.buildMarkdown(pack);
  assert.equal(markdown.includes('UNIQUE-CONSTRAINT-SENTENCE'), false);
  assert.equal(markdown.includes('<script>nope</script>'), false);
  assert.match(markdown, /- Constraints/);
  const notes = P.includedNotes(pack);
  assert.equal(notes.includes('UNIQUE-CONSTRAINT-SENTENCE'), false);
  assert.equal(P.countWords(notes), P.countWords('Keep the secret sentence out of the file.'));
});

test('fully populated pack includes every section and no empty-section list', () => {
  const pack = P.presetPack('small-business');
  for (const section of P.SECTIONS) {
    pack.sections[section.id].sample = false;
  }
  pack.titleSample = false;
  const markdown = P.buildMarkdown(pack);
  for (const section of P.SECTIONS) {
    assert.ok(markdown.includes('### ' + section.heading), section.heading);
    assert.ok(markdown.includes(pack.sections[section.id].text.split('\n')[0]));
  }
  assert.doesNotMatch(markdown, /## Not provided/);
  assert.doesNotMatch(markdown, /## Left out on purpose/);
  assert.doesNotMatch(markdown, /fictional sample copy/);
});

test('sample packs are labeled as sample in the export', () => {
  const markdown = P.buildMarkdown(P.presetPack('writing-research'));
  assert.match(markdown, /fictional sample copy from a Packwright example/);
  assert.match(markdown, /North Ward Notes/);
  assert.doesNotMatch(markdown, /Hearth & Rye/);
});

test('html and script text stays inert text in the markdown file', () => {
  const payload = '<script>window.__xss=1</script>\n<img src=x onerror="alert(1)">';
  const pack = packWith({ goal: payload, title: 'Notes' });
  const markdown = P.buildMarkdown(pack);
  assert.ok(markdown.includes(payload));
  assert.ok(markdown.startsWith('# Context pack: Notes'));
  assert.doesNotMatch(markdown, /<!DOCTYPE|<html|<\/body>/i);
});

test('counts are code points and whitespace words, not utf-16 units or tokens', () => {
  assert.equal(P.countChars('😀'), 1);
  assert.equal('😀'.length, 2);
  assert.equal(P.countChars('é'), 1);
  assert.equal(P.countWords('😀 bread\n\nloaf'), 3);
  assert.equal(P.countWords('   '), 0);
  assert.equal(P.countWords(''), 0);
  const pack = packWith({ goal: '😀 bread', audience: 'one   two' });
  assert.equal(P.countWords(P.includedNotes(pack)), 4);
  assert.equal(P.countChars(P.includedNotes(pack)), P.countChars('😀 bread\none   two'));
  const markdown = P.buildMarkdown(pack);
  assert.match(markdown, /They are not token counts\./);
  assert.doesNotMatch(markdown, /\d+\s+tokens/);
});

test('newlines are normalized and internal line breaks survive', () => {
  assert.equal(P.normalizeNewlines('a\r\nb\rc'), 'a\nb\nc');
  const pack = P.emptyPack();
  pack.sections.references.text = 'line one\r\n\r\nline two';
  const markdown = P.buildMarkdown(pack);
  assert.match(markdown, /line one\n\nline two/);
  assert.equal(markdown.includes('\r'), false);
});

test('safe filenames keep unicode and drop path and control characters', () => {
  assert.equal(P.safeFilename(''), 'context-pack.md');
  assert.equal(P.safeFilename('   '), 'context-pack.md');
  assert.equal(P.safeFilename('...'), 'context-pack.md');
  assert.equal(P.safeFilename('CON'), 'context-pack.md');
  assert.equal(P.safeFilename('con'), 'context-pack.md');
  assert.equal(P.safeFilename('COM1'), 'context-pack.md');
  assert.equal(P.safeFilename('Café plan 🍞'), 'Café plan 🍞.md');
  assert.equal(P.safeFilename('plan\nsecret'), 'plan secret.md');
  assert.equal(P.safeFilename('a/b\\c:d*e?f"g<h>i|j'), 'a b c d e f g h i j.md');
  assert.equal(P.safeFilename('../secret'), 'secret.md');
  assert.equal(P.safeFilename('notes/../secret'), 'notes .. secret.md');
  assert.equal(P.safeFilename('\u202ehidden'), 'hidden.md');
  assert.equal(P.safeFilename('Sample: Weekend preorder page for Hearth & Rye'), 'Sample Weekend preorder page for Hearth & Rye.md');
  assert.equal(P.safeFilename('Café plan 🍞', 'json'), 'Café plan 🍞.json');
  const long = 'あ'.repeat(80);
  const stem = P.safeFilename(long).replace(/\.md$/, '');
  assert.equal(Array.from(stem).length, 60);
  const composed = P.safeFilename('cafe\u0301');
  assert.equal(composed, 'café.md');
});

test('json export and import round trip unicode, newlines, flags, and html', () => {
  const pack = P.presetPack('coding');
  pack.title = 'Café plan';
  pack.titleSample = false;
  pack.sections.goal.text = 'Café 🍞\nline two <script>alert(1)</script>';
  pack.sections.goal.sample = false;
  pack.sections.constraints.included = false;
  const raw = P.exportJson(pack);
  assert.ok(raw.endsWith('\n'));
  assert.equal(raw.includes('\r'), false);
  const result = P.importJson(raw);
  assert.equal(result.ok, true);
  assert.equal(result.pack.title, 'Café plan');
  assert.equal(result.pack.titleSample, false);
  assert.equal(result.pack.sections.goal.text, 'Café 🍞\nline two <script>alert(1)</script>');
  assert.equal(result.pack.sections.goal.sample, false);
  assert.equal(result.pack.sections.constraints.included, false);
  assert.equal(result.pack.sections.references.sample, true);
  assert.deepEqual(P.serializePack(result.pack), P.serializePack(pack));
  const again = P.importJson(P.exportJson(result.pack));
  assert.deepEqual(P.serializePack(again.pack), P.serializePack(result.pack));
});

test('json keeps a stable schema shape', () => {
  const raw = P.exportJson(P.emptyPack());
  const parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed), ['schema', 'schemaVersion', 'title', 'titleSample', 'sections']);
  assert.equal(parsed.schema, 'packwright.context-pack');
  assert.equal(parsed.schemaVersion, 1);
  assert.deepEqual(Object.keys(parsed.sections), P.SECTIONS.map((section) => section.id));
  for (const section of P.SECTIONS) {
    assert.deepEqual(Object.keys(parsed.sections[section.id]), ['included', 'text', 'sample']);
  }
});

test('import accepts a byte order mark and omitted sample flags', () => {
  const data = JSON.parse(P.exportJson(P.presetPack('learning')));
  delete data.titleSample;
  for (const id of Object.keys(data.sections)) delete data.sections[id].sample;
  const result = P.importJson('\uFEFF' + JSON.stringify(data));
  assert.equal(result.ok, true);
  assert.equal(result.pack.titleSample, false);
  assert.equal(result.pack.sections.goal.sample, false);
  assert.match(result.pack.sections.background.text, /Lantern Pantry/);
});

test('import converts CRLF inside section text to LF', () => {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.sections.goal.text = 'a\r\nb';
  const result = P.importJson(JSON.stringify(data));
  assert.equal(result.ok, true);
  assert.equal(result.pack.sections.goal.text, 'a\nb');
});

test('import rejects malformed json without throwing', () => {
  for (const bad of ['{', '', 'null', '[]', '"hi"', '42']) {
    const result = P.importJson(bad);
    assert.equal(result.ok, false, bad);
    assert.match(result.error, /Nothing was changed/);
  }
  assert.match(P.importJson('{').error, /not valid JSON/);
  assert.match(P.importJson('null').error, /not a Packwright pack/);
});

test('import rejects the wrong schema and other versions', () => {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.schema = 'other.schema';
  assert.match(P.importJson(JSON.stringify(data)).error, /does not read \(other\.schema\)/);
  data.schema = P.SCHEMA_ID;
  data.schemaVersion = 2;
  assert.match(P.importJson(JSON.stringify(data)).error, /schema version 2/);
  data.schemaVersion = '1';
  assert.match(P.importJson(JSON.stringify(data)).error, /schema version 1/);
  delete data.schemaVersion;
  assert.match(P.importJson(JSON.stringify(data)).error, /schema version missing/);
});

test('import rejects unknown fields and does not apply a partial pack', () => {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.note = 'extra';
  let result = P.importJson(JSON.stringify(data));
  assert.equal(result.ok, false);
  assert.match(result.error, /does not accept: note/);
  delete data.note;
  data.sections.secret = { included: true, text: 'hidden', sample: false };
  result = P.importJson(JSON.stringify(data));
  assert.match(result.error, /sections this version does not accept: secret/);
  delete data.sections.secret;
  data.sections.goal.hint = 'nope';
  result = P.importJson(JSON.stringify(data));
  assert.match(result.error, /Project goal/);
  assert.match(result.error, /hint/);
  assert.match(result.error, /Nothing was changed/);
});

test('import rejects prototype payload and does not pollute objects', () => {
  const raw = P.exportJson(P.emptyPack()).trim().replace('{', '{"__proto__":{"polluted":true},');
  const result = P.importJson(raw);
  assert.equal(result.ok, false);
  assert.equal(Object.prototype.polluted, undefined);
  assert.match(result.error, /Nothing was changed/);
});

test('import rejects incompatible types, control characters, and overlong fields', () => {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  data.sections.goal.included = 'true';
  assert.match(P.importJson(JSON.stringify(data)).error, /true or false/);
  data.sections.goal.included = true;
  data.sections.goal.text = 'ok\u0000hidden';
  assert.match(P.importJson(JSON.stringify(data)).error, /control characters/);
  data.sections.goal.text = 'a'.repeat(P.MAX_FIELD_CHARS + 1);
  assert.match(P.importJson(JSON.stringify(data)).error, /too long/);
  data.sections.goal.text = '';
  data.title = 't'.repeat(P.MAX_TITLE_CHARS + 1);
  assert.match(P.importJson(JSON.stringify(data)).error, /title is too long/);
  data.title = 12;
  assert.match(P.importJson(JSON.stringify(data)).error, /title must be text/);
});

test('import rejects oversized files before treating them as json', () => {
  const huge = '{' + 'x'.repeat(P.MAX_IMPORT_BYTES);
  const result = P.importJson(huge);
  assert.equal(result.ok, false);
  assert.match(result.error, /too large/);
  assert.match(result.error, /Nothing was changed/);
  assert.doesNotMatch(result.error, /not valid JSON/);
});

test('a missing section is rejected by name', () => {
  const data = JSON.parse(P.exportJson(P.emptyPack()));
  delete data.sections.audience;
  const result = P.importJson(JSON.stringify(data));
  assert.match(result.error, /Audience/);
  assert.match(result.error, /missing/);
});

test('user writing is protected and untouched samples are not', () => {
  assert.equal(P.hasPopulatedUserEntries(P.emptyPack()), false);
  assert.equal(P.hasAnyText(P.emptyPack()), false);
  const sample = P.presetPack('learning');
  assert.equal(P.hasPopulatedUserEntries(sample), false);
  assert.equal(P.hasAnyText(sample), true);
  sample.sections.unknowns.text = '   ';
  sample.sections.unknowns.sample = false;
  assert.equal(P.hasPopulatedUserEntries(sample), false);
  sample.sections.goal.text = 'My real goal';
  sample.sections.goal.sample = false;
  assert.equal(P.hasPopulatedUserEntries(sample), true);
  const titled = P.emptyPack();
  titled.title = ' Mine ';
  titled.titleSample = false;
  assert.equal(P.hasPopulatedUserEntries(titled), true);
  titled.titleSample = true;
  assert.equal(P.hasPopulatedUserEntries(titled), false);
});

test('checklist names missing essentials and does not score quality', () => {
  const blank = P.checklist(P.emptyPack());
  assert.ok(blank.some((item) => item.id === 'goal' && item.tone === 'missing'));
  assert.ok(blank.some((item) => item.id === 'audience' && item.tone === 'missing'));
  assert.ok(blank.some((item) => item.id === 'nextDeliverable' && item.tone === 'missing'));
  assert.ok(blank.some((item) => item.tone === 'optional'));
  assert.ok(!blank.some((item) => item.tone === 'ready'));
  assert.ok(!blank.some((item) => /score|guarantee|token/i.test(item.message)));

  const pack = packWith({
    goal: '12345678901234567890',
    audience: 'Neighbors',
    nextDeliverable: 'A one-page draft'
  });
  const ready = P.checklist(pack);
  assert.ok(ready.some((item) => item.id === 'essentials-ok' && item.tone === 'ready'));
  assert.ok(!ready.some((item) => item.id === 'goal-short'));
  pack.sections.goal.text = '1234567890123456789';
  assert.ok(P.checklist(pack).some((item) => item.id === 'goal-short'));

  pack.sections.goal.included = false;
  const off = P.checklist(pack);
  assert.ok(off.some((item) => /Project goal is turned off/.test(item.message)));
  assert.ok(!off.some((item) => item.id === 'essentials-ok'));
});

test('checklist points at sample text that is still included', () => {
  const items = P.checklist(P.presetPack('coding'));
  const sample = items.find((item) => item.id === 'samples');
  assert.ok(sample);
  assert.match(sample.message, /Sample text is still included/);
  assert.match(sample.message, /Project goal/);
  const pack = P.presetPack('coding');
  pack.sections.references.included = false;
  const hidden = P.checklist(pack).find((item) => item.id === 'samples');
  assert.doesNotMatch(hidden.message, /Reference notes/);
});

test('json size check reports overlong sections and giant files', () => {
  const pack = P.emptyPack();
  assert.deepEqual(P.jsonTooLarge(pack).issues, []);
  assert.equal(P.jsonTooLarge(pack).tooBigFile, false);
  pack.sections.background.text = 'b'.repeat(P.MAX_FIELD_CHARS + 1);
  assert.ok(P.jsonTooLarge(pack).issues.includes('Background'));
});
