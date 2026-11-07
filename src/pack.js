/*
 * Packwright
 * Copyright (c) 2026 Amit Shrivastava
 * Released under the MIT License.
 *
 * Pure pack logic: presets, Markdown export, counts, filenames, and JSON schema.
 * No network, no storage, no DOM. Imported text is data, never evaluated.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.Packwright = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_ID = 'packwright.context-pack';
  var SCHEMA_VERSION = 1;
  var MAX_IMPORT_BYTES = 750000;
  var MAX_FIELD_CHARS = 100000;
  var MAX_TITLE_CHARS = 200;
  var MAX_FILENAME_CHARS = 60;

  var DISALLOWED_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
  var BIDI_CONTROLS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
  var FILENAME_FORBIDDEN = /[\\/:*?"<>|]/g;
  var RESERVED_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  var SECTIONS = [
    {
      id: 'goal',
      heading: 'Project goal',
      hint: 'What are you trying to accomplish? A sentence or two is enough.',
      group: 'task'
    },
    {
      id: 'audience',
      heading: 'Audience',
      hint: 'Who will read or use the result, and what do they already know?',
      group: 'audience'
    },
    {
      id: 'background',
      heading: 'Background',
      hint: 'History a newcomer would need. Stick to what you actually know.',
      group: 'sources'
    },
    {
      id: 'currentState',
      heading: 'Current state and decisions',
      hint: 'What is already decided, done, or underway?',
      group: 'sources'
    },
    {
      id: 'preferences',
      heading: 'Writing preferences',
      hint: 'Tone, length, format, and words you want used or avoided.',
      group: 'preferences'
    },
    {
      id: 'constraints',
      heading: 'Constraints',
      hint: 'Limits that must be respected: time, money, tools, rules, or scope.',
      group: 'constraints'
    },
    {
      id: 'unknowns',
      heading: 'Unknowns',
      hint: 'Open questions. A careful assistant should ask rather than invent answers.',
      group: 'unknowns'
    },
    {
      id: 'references',
      heading: 'Reference notes',
      hint: 'Paste only source notes, quotes, or figures you want included.',
      group: 'sources'
    },
    {
      id: 'nextDeliverable',
      heading: 'Desired next deliverable',
      hint: 'The specific thing you want next: a draft, a list, a plan, or a reply.',
      group: 'task'
    }
  ];

  var GROUPS = [
    {
      id: 'task',
      heading: 'Task',
      intro: 'Do this work. If something else in the pack conflicts with it, ask before guessing.'
    },
    {
      id: 'audience',
      heading: 'Audience',
      intro: 'Write for the people described here.'
    },
    {
      id: 'preferences',
      heading: 'Writing preferences',
      intro: 'Follow these style choices when you write.'
    },
    {
      id: 'constraints',
      heading: 'Constraints',
      intro: 'Respect these limits. Do not work around them quietly.'
    },
    {
      id: 'unknowns',
      heading: 'Unknowns',
      intro: 'These questions are unresolved. Do not fill them in with invented facts. Ask, or leave them open.'
    },
    {
      id: 'sources',
      heading: 'Provided source notes',
      intro: 'The following text was provided by the person who made this pack. Use it as source material. Packwright has not checked it.'
    }
  ];

  var KNOWN_TOP = ['schema', 'schemaVersion', 'title', 'titleSample', 'sections'];
  var KNOWN_SECTION = ['included', 'text', 'sample'];

  var PRESETS = [
    {
      id: 'small-business',
      label: 'Small business',
      blurb: 'A weekend preorder page for a fictional bakery.',
      title: 'Sample: Weekend preorder page for Hearth & Rye',
      sections: {
        goal: 'Write a simple weekend bread preorder page for Hearth & Rye, a neighborhood bakery. The page should say what is available this month, how to order, when to pick up, and what the bakery will not do.',
        audience: 'Neighbors who already stop by the bakery. They read on their phones while walking or waiting in line. They are not bakers. Do not assume they know the owner, and skip milling jargon.',
        background: 'Sample only: Hearth & Rye is fictional, and so is everyone named here. This example shows what a finished pack can look like. It is a one-counter shop. Mara Ellison bakes on Thursday and Saturday. There is no website yet. Orders today are written on a paper pad by the register.',
        currentState: 'Mara has decided the November menu stays fixed. She has decided the page will not take payment. She has decided pickup is Saturday only. She has not chosen a logo. The page can be plain text she pastes into a website tool she already has.',
        preferences: 'Warm, brief, and plain. Short headings. Sentences you can read in one breath. No puns. Do not use the words artisan, curated, elevate, or nestled. Aim for 250 to 400 words.',
        constraints: 'No online payment. Pickup only, Saturday 9:00 to 11:00 in the morning. Maximum 4 loaves per household. Do not invent prices, ingredients, or awards. Use only the menu and rules in the reference notes. Do not promise same-day orders or delivery. Do not give medical or allergy advice.',
        unknowns: 'Whether Mara wants a line at the top saying the seeded rye contains sesame. Ask before adding any allergen wording.',
        references: 'Fictional sample menu and rules for November:\n- Country loaf — 9 dollars — Saturday only\n- Seeded rye — 10 dollars — contains sesame seeds\n- Honey oat — 8 dollars\n- Orders close Thursday at 6:00 in the evening\n- Pickup address in this sample: 18 Lantern Street\n- Orders are not held past 11:00',
        nextDeliverable: 'A single page I can paste into a website tool: a heading, a short intro, the menu, the order rules, and a pickup note. After the page, list any place you left a blank because the answer was unknown.'
      }
    },
    {
      id: 'writing-research',
      label: 'Writing and research',
      blurb: 'A short newsletter explainer from fictional source notes.',
      title: 'Sample: Explainer for North Ward Notes',
      sections: {
        goal: 'Draft a short explainer about neighborhood book boxes: what they are, how people use them, and why a town might write a few simple rules for them.',
        audience: 'Readers of North Ward Notes, a fictional community newsletter. Adults with no library training. They care about their block. They do not want a national policy essay.',
        background: 'Sample only: North Ward Notes, the editor, and the town are fictional. This example shows a research-style pack. Editor June Pell asked for an explainer, not an opinion column and not a profile of one neighbor. The piece will sit on the second page of the December issue.',
        currentState: 'June has decided the length and a neutral tone. She has decided not to name real neighbors. No interviews have been done. No photograph has been chosen. The writer has not visited a book box for this sample assignment.',
        preferences: 'Clear and concrete. 650 to 750 words. One idea per paragraph. Define a term the first time you use it. No sarcasm. Do not invent citations to look official. If you are not sure, say so in a short note under the draft.',
        constraints: 'Do not invent statistics, dates, laws, or quotations. Do not name real people, real towns, or real organizations. Do not give legal advice. Do not tell readers to alter city property. Use only the source notes below. Mark anything beyond them as unknown.',
        unknowns: 'Whether the newsletter wants a sidebar on how to build a box. Ask before adding construction steps. Paint and lumber details are not in the source notes.',
        references: 'Fictional source notes supplied by the editor:\n- A neighborhood book box is a small weatherproof cupboard on a private lawn or beside a shop, where people leave books and take books.\n- No one checks out a book and no one is fined.\n- June wants the article to assume three rules: the box sits on private property, it does not block the sidewalk, and it is not used for sales.\n- She has seen boxes last longer when a neighbor throws away soaked books.\n- She does not have figures for how many boxes exist.',
        nextDeliverable: 'A 650 to 750 word draft with a title and three or four subheadings, plus a short list of claims you refused to make because the source notes did not support them.'
      }
    },
    {
      id: 'learning',
      label: 'Learning',
      blurb: 'A first spreadsheet lesson for a fictional pantry schedule.',
      title: 'Sample: Learn a volunteer shift grid',
      sections: {
        goal: 'Teach me enough spreadsheet skills to build a one-month volunteer shift grid for a Saturday food pantry. Stay with the smallest set of skills that gets the grid working.',
        audience: 'A volunteer who can type and use email, and who has opened a spreadsheet a few times. They do not know formulas yet. They get nervous around menus. Write as if you are sitting beside them.',
        background: 'Sample only: Lantern Pantry and the people named here are fictional. This example shows a learning pack. The pantry is open Saturdays from 9:00 to 12:00. Three jobs need a person each Saturday: door, packing table, and deliveries. Eight volunteers rotate. The schedule lives in one sheet that the coordinator, Sam Ortiz, prints on Friday.',
        currentState: 'Sam already has a paper grid for this month, and it has gaps. He has decided the sheet should show one row per volunteer and one column per Saturday. He has decided not to use a separate scheduling website. He has not started the file.',
        preferences: 'Patient, numbered steps. Name the menu or the keystroke each time. After each step, say what I should see. Plain words. No jokes about being bad at math. Keep the lesson short enough to finish in one sitting.',
        constraints: 'Teach only what this grid needs: typing labels, a simple formula to count filled shifts, and a way to see empty cells. Do not require an account, a paid add-on, or a macro. Do not collect phone numbers in the examples. Use the fictional first names from the reference notes and nothing else. If a step differs between common spreadsheet apps, say so instead of guessing one path.',
        unknowns: 'Which spreadsheet app Sam has. Ask at the start, and give the path for the app he names. If he does not know, show a version that uses only typed formulas.',
        references: 'Fictional roster for the lesson examples:\n- Volunteers: Sam, Priya, Owen, Lila, Chris, Nora, Ben, Amina\n- Saturdays this month: the 7th, 14th, 21st, and 28th\n- Each Saturday needs 1 person at the door, 2 at packing, and 1 on deliveries\n- In this sample, a person should not be given two jobs on the same Saturday',
        nextDeliverable: 'A lesson I can follow from a blank sheet to a finished grid, then a three-question practice check. End with what I should save, and what this lesson did not teach.'
      }
    },
    {
      id: 'coding',
      label: 'Coding',
      blurb: 'A small recipe box that stays on this computer, described in plain language.',
      title: 'Sample: Kitchen Card Box on this computer',
      sections: {
        goal: 'Help me make a personal recipe box I can open on my own computer. I want to add a recipe, read it later, and remove it. I do not want an account.',
        audience: 'Me. I can follow careful steps, and I can edit a text file if you say exactly where. I do not want a lecture on programming history. Explain any term you cannot avoid in the same sentence.',
        background: 'Sample only: Kitchen Card Box is a fictional project in this example. It shows a coding pack written in plain language. The recipes belong to one household. The file should still open with the internet off. There is no existing code. The first recipes I care about are weekday soups and a weekend pancake card.',
        currentState: 'I have decided it is one file I can double-click. I have decided recipes stay on this computer. I have decided the first version has a name, a short list of ingredients, and the steps. I have not decided on pictures. I do not have a logo.',
        preferences: 'Short steps, in order. Say what to save and what name to give the file. Before any large change, restate what you are about to do in one sentence. Prefer the simplest approach that meets the constraints. Comments in plain language.',
        constraints: 'No account, no paid service, and no remote database. Do not send recipes anywhere. Do not add analytics, ads, or fonts and scripts loaded from the internet. Do not invent extra features such as sharing, logins, or meal planning. If you are unsure how I want something to behave, ask. Keep the first version to adding a recipe, listing recipes, opening one, and deleting one.',
        unknowns: 'Whether I want the recipes to remain after I close the file. Ask before you choose a way to store them. Do not claim the storage is encrypted.',
        references: 'Fictional sample recipe to use in examples only:\n- Name: Tuesday lentil soup\n- Ingredients: red lentils, onion, carrot, vegetable broth, salt\n- Steps: rinse the lentils, soften the onion and carrot, simmer until the lentils are tender, salt at the end\nDo not add nutrition claims. This recipe is sample data, not a real household record.',
        nextDeliverable: 'A plan of the first version in plain language, then the single file, then a short checklist I can use to test add, open, and delete with the internet off.'
      }
    }
  ];

  for (var p = 0; p < PRESETS.length; p += 1) {
    var preset = PRESETS[p];
    if (!preset.sections.background || preset.sections.background.indexOf('fictional') === -1) {
      throw new Error('Preset ' + preset.id + ' must say it is fictional');
    }
    for (var s = 0; s < SECTIONS.length; s += 1) {
      var sectionId = SECTIONS[s].id;
      if (typeof preset.sections[sectionId] !== 'string' || !preset.sections[sectionId].trim()) {
        throw new Error('Preset ' + preset.id + ' is missing ' + sectionId);
      }
    }
  }

  function normalizeNewlines(text) {
    return String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function countChars(text) {
    return Array.from(String(text == null ? '' : text)).length;
  }

  function countWords(text) {
    var trimmed = String(text == null ? '' : text).trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function emptyPack() {
    var sections = {};
    for (var i = 0; i < SECTIONS.length; i += 1) {
      sections[SECTIONS[i].id] = { included: true, text: '', sample: false };
    }
    return { title: '', titleSample: false, sections: sections };
  }

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return null;
  }

  function presetPack(id) {
    var preset = presetById(id);
    if (!preset) {
      throw new Error('Unknown preset');
    }
    var pack = emptyPack();
    pack.title = preset.title;
    pack.titleSample = true;
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var sectionId = SECTIONS[i].id;
      pack.sections[sectionId] = {
        included: true,
        text: preset.sections[sectionId],
        sample: true
      };
    }
    return pack;
  }

  function hasPopulatedUserEntries(pack) {
    if (pack.title && pack.title.trim() && !pack.titleSample) return true;
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var section = pack.sections[SECTIONS[i].id];
      if (section && section.text && section.text.trim() && !section.sample) return true;
    }
    return false;
  }

  function hasAnyText(pack) {
    if (pack.title && pack.title.trim()) return true;
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var section = pack.sections[SECTIONS[i].id];
      if (section && section.text && section.text.trim()) return true;
    }
    return false;
  }

  function includedNotes(pack) {
    var parts = [];
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var section = pack.sections[SECTIONS[i].id];
      if (section && section.included && section.text && section.text.trim()) {
        parts.push(normalizeNewlines(section.text).trim());
      }
    }
    return parts.join('\n');
  }

  function sectionById(id) {
    for (var i = 0; i < SECTIONS.length; i += 1) {
      if (SECTIONS[i].id === id) return SECTIONS[i];
    }
    return null;
  }

  function buildMarkdown(pack) {
    var lines = [];
    var title = pack.title && pack.title.trim() ? pack.title.trim() : 'Untitled context pack';
    lines.push('# Context pack: ' + title);
    lines.push('');
    lines.push('This pack was assembled locally by a person using Packwright. It contains only the text they chose to include. Packwright did not verify facts and did not add project information that is not written below.');
    lines.push('');
    lines.push('How to use it: paste this file into an assistant, or attach it, at the start of a conversation.');
    lines.push('');
    lines.push('Assistant instructions:');
    lines.push('- Follow the task.');
    lines.push('- Treat constraints as limits. Do not work around them quietly.');
    lines.push('- Do not invent answers for unknowns. Ask, or leave them open.');
    lines.push('- Treat provided source notes as supplied material, not as facts you have checked.');
    lines.push('');

    var anySample = false;
    if (pack.titleSample && pack.title && pack.title.trim()) anySample = true;
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var probe = pack.sections[SECTIONS[i].id];
      if (probe && probe.sample && probe.included && probe.text && probe.text.trim()) anySample = true;
    }
    if (anySample) {
      lines.push('> Some included text is still fictional sample copy from a Packwright example. Replace it before you rely on this pack.');
      lines.push('');
    }

    for (var g = 0; g < GROUPS.length; g += 1) {
      var group = GROUPS[g];
      var present = [];
      for (var n = 0; n < SECTIONS.length; n += 1) {
        if (SECTIONS[n].group !== group.id) continue;
        var sec = pack.sections[SECTIONS[n].id];
        if (sec && sec.included && sec.text && sec.text.trim()) present.push(SECTIONS[n]);
      }
      if (!present.length) continue;
      lines.push('## ' + group.heading);
      lines.push('');
      lines.push(group.intro);
      lines.push('');
      for (var m = 0; m < present.length; m += 1) {
        lines.push('### ' + present[m].heading);
        lines.push('');
        lines.push(normalizeNewlines(pack.sections[present[m].id].text).trim());
        lines.push('');
      }
    }

    var notProvided = [];
    var leftOut = [];
    for (var k = 0; k < SECTIONS.length; k += 1) {
      var item = pack.sections[SECTIONS[k].id];
      if (!item || item.included === false) {
        leftOut.push(SECTIONS[k]);
      } else if (!item.text || !item.text.trim()) {
        notProvided.push(SECTIONS[k]);
      }
    }

    if (notProvided.length) {
      lines.push('## Not provided');
      lines.push('');
      lines.push('The person included these sections but left them empty. Do not invent content for them:');
      lines.push('');
      for (var a = 0; a < notProvided.length; a += 1) {
        lines.push('- ' + notProvided[a].heading);
      }
      lines.push('');
    }

    if (leftOut.length) {
      lines.push('## Left out on purpose');
      lines.push('');
      lines.push('The person turned these sections off. Their text is not in this file:');
      lines.push('');
      for (var b = 0; b < leftOut.length; b += 1) {
        lines.push('- ' + leftOut[b].heading);
      }
      lines.push('');
    }

    var notes = includedNotes(pack);
    lines.push('---');
    lines.push('');
    lines.push('Pack built locally with Packwright.');
    lines.push('Schema: packwright.context-pack version 1.');
    lines.push('Included notes: ' + countChars(notes) + ' characters, ' + countWords(notes) + ' words.');
    lines.push('Counts are Unicode code points and whitespace-separated words. They are not token counts.');
    lines.push('This file is not encrypted. It contains whatever the person chose to include.');
    lines.push('Packwright is an independent tool and is not affiliated with any assistant product.');
    lines.push('');
    return lines.join('\n');
  }

  function checklist(pack) {
    var items = [];

    function textOf(id) {
      var section = pack.sections[id];
      return section && section.text ? section.text.trim() : '';
    }

    function included(id) {
      return !!(pack.sections[id] && pack.sections[id].included);
    }

    var essentials = [
      ['goal', 'Project goal', 'Add a project goal so the assistant knows what you want.'],
      ['audience', 'Audience', 'Add an audience so the writing has someone to speak to.'],
      ['nextDeliverable', 'Desired next deliverable', 'Add the next deliverable so the assistant knows what to produce.']
    ];

    for (var i = 0; i < essentials.length; i += 1) {
      var id = essentials[i][0];
      var label = essentials[i][1];
      var message = essentials[i][2];
      if (!included(id)) {
        items.push({ id: id, tone: 'missing', message: label + ' is turned off, so it will not appear in the pack.' });
      } else if (!textOf(id)) {
        items.push({ id: id, tone: 'missing', message: message });
      } else if (id === 'goal' && countChars(textOf(id)) < 20) {
        items.push({ id: 'goal-short', tone: 'note', message: 'The project goal is very short. A sentence or two usually helps.' });
      }
    }

    if (included('constraints') && !textOf('constraints')) {
      items.push({ id: 'constraints', tone: 'optional', message: 'No constraints listed. Add limits if you have them, or leave this blank if you have none.' });
    }
    if (included('unknowns') && !textOf('unknowns')) {
      items.push({ id: 'unknowns', tone: 'optional', message: 'No unknowns listed. Leave this blank if you have no open questions.' });
    }
    if (included('references') && !textOf('references')) {
      items.push({ id: 'references', tone: 'optional', message: 'No reference notes. Paste source material only if you want it included.' });
    }
    if (included('background') && included('currentState') && !textOf('background') && !textOf('currentState')) {
      items.push({ id: 'history', tone: 'optional', message: 'Background and current state are empty. Add them if the assistant needs history.' });
    }

    var sampleNames = [];
    if (pack.titleSample && pack.title && pack.title.trim()) sampleNames.push('Pack title');
    for (var n = 0; n < SECTIONS.length; n += 1) {
      var sec = pack.sections[SECTIONS[n].id];
      if (sec && sec.sample && sec.included && sec.text && sec.text.trim()) {
        sampleNames.push(SECTIONS[n].heading);
      }
    }
    if (sampleNames.length) {
      items.push({
        id: 'samples',
        tone: 'note',
        message: 'Sample text is still included in: ' + sampleNames.join(', ') + '. Edit those boxes before you treat the pack as yours.'
      });
    }

    var missing = false;
    for (var t = 0; t < items.length; t += 1) {
      if (items[t].tone === 'missing') missing = true;
    }
    if (!missing) {
      items.unshift({
        id: 'essentials-ok',
        tone: 'ready',
        message: 'Goal, audience, and next deliverable are filled in and included.'
      });
    }
    return items;
  }

  function safeFilename(title, extension) {
    var ext = extension === 'json' ? '.json' : '.md';
    var name = normalizeNewlines(title || '');
    if (typeof name.normalize === 'function') name = name.normalize('NFC');
    name = name.replace(DISALLOWED_CONTROLS, ' ');
    name = name.replace(FILENAME_FORBIDDEN, ' ');
    name = name.replace(BIDI_CONTROLS, '');
    name = name.replace(/\s+/g, ' ').trim();
    name = name.replace(/^[. ]+/, '').replace(/[. ]+$/g, '');
    if (RESERVED_WINDOWS.test(name)) name = '';
    var chars = Array.from(name);
    if (chars.length > MAX_FILENAME_CHARS) {
      name = chars.slice(0, MAX_FILENAME_CHARS).join('').replace(/[. ]+$/g, '').trim();
    }
    if (!name) name = 'context-pack';
    return name + ext;
  }

  function serializePack(pack) {
    var sections = {};
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var id = SECTIONS[i].id;
      var section = pack.sections[id] || { included: true, text: '', sample: false };
      sections[id] = {
        included: !!section.included,
        text: normalizeNewlines(section.text || ''),
        sample: !!section.sample
      };
    }
    var title = normalizeNewlines(pack.title || '').replace(/\s+/g, ' ').trim();
    return {
      schema: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      title: title,
      titleSample: !!pack.titleSample,
      sections: sections
    };
  }

  function exportJson(pack) {
    return JSON.stringify(serializePack(pack), null, 2) + '\n';
  }

  function clonePack(pack) {
    var imported = importJson(exportJson(pack));
    if (!imported.ok) {
      throw new Error('Could not clone pack');
    }
    return imported.pack;
  }

  function byteLength(text) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function fail(error) {
    return { ok: false, error: error };
  }

  function formatNames(names) {
    var shown = [];
    var limit = Math.min(names.length, 8);
    for (var i = 0; i < limit; i += 1) {
      var chars = Array.from(String(names[i]));
      shown.push(chars.length > 40 ? chars.slice(0, 40).join('') + '…' : chars.join(''));
    }
    if (names.length > 8) shown.push('and ' + (names.length - 8) + ' more');
    return shown.join(', ');
  }

  function describeSchema(value) {
    if (typeof value === 'string') {
      var chars = Array.from(value);
      var short = chars.slice(0, 60).join('');
      return chars.length > 60 ? short + '…' : short;
    }
    if (value === undefined) return 'missing';
    return typeof value;
  }

  function unknownKeys(object, allowed) {
    var keys = Object.keys(object);
    var extra = [];
    for (var i = 0; i < keys.length; i += 1) {
      var known = false;
      for (var j = 0; j < allowed.length; j += 1) {
        if (keys[i] === allowed[j]) known = true;
      }
      if (!known) extra.push(keys[i]);
    }
    return extra;
  }

  function importJson(text) {
    if (typeof text !== 'string') {
      return fail('That file could not be read as text. Nothing was changed.');
    }
    var source = text;
    if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
    var bytes = byteLength(source);
    if (bytes > MAX_IMPORT_BYTES) {
      return fail('That file is too large (' + bytes + ' bytes). The limit is ' + MAX_IMPORT_BYTES + ' bytes. Nothing was changed.');
    }
    var data;
    try {
      data = JSON.parse(source);
    } catch (error) {
      return fail('That file is not valid JSON. Nothing was changed.');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return fail('That file is not a Packwright pack. Nothing was changed.');
    }
    var extraTop = unknownKeys(data, KNOWN_TOP);
    if (extraTop.length) {
      return fail('That file has fields this version does not accept: ' + formatNames(extraTop) + '. Nothing was changed.');
    }
    if (data.schema !== SCHEMA_ID) {
      return fail('That file uses a schema Packwright does not read (' + describeSchema(data.schema) + '). Nothing was changed.');
    }
    if (data.schemaVersion !== SCHEMA_VERSION) {
      var shownVersion = data.schemaVersion === undefined ? 'missing' : String(data.schemaVersion);
      return fail('That file is schema version ' + shownVersion + '. This app reads version ' + SCHEMA_VERSION + ' only. Nothing was changed.');
    }
    if (typeof data.title !== 'string') {
      return fail('The pack title must be text. Nothing was changed.');
    }
    if (DISALLOWED_CONTROLS.test(data.title)) {
      return fail('The pack title contains hidden control characters. Remove them and try again. Nothing was changed.');
    }
    var title = normalizeNewlines(data.title).replace(/\s+/g, ' ').trim();
    if (countChars(title) > MAX_TITLE_CHARS) {
      return fail('The pack title is too long. The limit is ' + MAX_TITLE_CHARS + ' characters. Nothing was changed.');
    }
    if (data.titleSample !== undefined && typeof data.titleSample !== 'boolean') {
      return fail('The title sample flag must be true or false. Nothing was changed.');
    }
    if (!data.sections || typeof data.sections !== 'object' || Array.isArray(data.sections)) {
      return fail('The pack is missing its sections. Nothing was changed.');
    }
    var sectionIds = [];
    for (var i = 0; i < SECTIONS.length; i += 1) sectionIds.push(SECTIONS[i].id);
    var extraSections = unknownKeys(data.sections, sectionIds);
    if (extraSections.length) {
      return fail('That file has sections this version does not accept: ' + formatNames(extraSections) + '. Nothing was changed.');
    }

    var pack = emptyPack();
    pack.title = title;
    pack.titleSample = data.titleSample === true;

    for (var n = 0; n < SECTIONS.length; n += 1) {
      var meta = SECTIONS[n];
      if (!Object.prototype.hasOwnProperty.call(data.sections, meta.id)) {
        return fail('The “' + meta.heading + '” section is missing. Nothing was changed.');
      }
      var incoming = data.sections[meta.id];
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return fail('The “' + meta.heading + '” section is not valid. Nothing was changed.');
      }
      var extraFields = unknownKeys(incoming, KNOWN_SECTION);
      if (extraFields.length) {
        return fail('The “' + meta.heading + '” section has fields this version does not accept: ' + formatNames(extraFields) + '. Nothing was changed.');
      }
      if (typeof incoming.included !== 'boolean') {
        return fail('Include for ' + meta.heading + ' must be true or false. Nothing was changed.');
      }
      if (typeof incoming.text !== 'string') {
        return fail('The text for ' + meta.heading + ' must be text. Nothing was changed.');
      }
      if (incoming.sample !== undefined && typeof incoming.sample !== 'boolean') {
        return fail('The sample flag for ' + meta.heading + ' must be true or false. Nothing was changed.');
      }
      if (DISALLOWED_CONTROLS.test(incoming.text)) {
        return fail('The text for ' + meta.heading + ' contains hidden control characters. Remove them and try again. Nothing was changed.');
      }
      var cleaned = normalizeNewlines(incoming.text);
      if (countChars(cleaned) > MAX_FIELD_CHARS) {
        return fail('The text for ' + meta.heading + ' is too long. The limit is ' + MAX_FIELD_CHARS + ' characters. Nothing was changed.');
      }
      pack.sections[meta.id] = {
        included: incoming.included,
        text: cleaned,
        sample: incoming.sample === true
      };
    }

    return { ok: true, pack: pack };
  }

  function jsonTooLarge(pack) {
    var issues = [];
    if (countChars(normalizeNewlines(pack.title || '').replace(/\s+/g, ' ').trim()) > MAX_TITLE_CHARS) {
      issues.push('Pack title');
    }
    for (var i = 0; i < SECTIONS.length; i += 1) {
      var text = normalizeNewlines((pack.sections[SECTIONS[i].id] || {}).text || '');
      if (countChars(text) > MAX_FIELD_CHARS) issues.push(SECTIONS[i].heading);
    }
    var serialized = exportJson(pack);
    var tooBigFile = byteLength(serialized) > MAX_IMPORT_BYTES;
    return { issues: issues, tooBigFile: tooBigFile, bytes: byteLength(serialized) };
  }

  return {
    SCHEMA_ID: SCHEMA_ID,
    SCHEMA_VERSION: SCHEMA_VERSION,
    MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
    MAX_FIELD_CHARS: MAX_FIELD_CHARS,
    MAX_TITLE_CHARS: MAX_TITLE_CHARS,
    SECTIONS: SECTIONS,
    GROUPS: GROUPS,
    PRESETS: PRESETS,
    emptyPack: emptyPack,
    presetPack: presetPack,
    presetById: presetById,
    hasPopulatedUserEntries: hasPopulatedUserEntries,
    hasAnyText: hasAnyText,
    normalizeNewlines: normalizeNewlines,
    countWords: countWords,
    countChars: countChars,
    includedNotes: includedNotes,
    buildMarkdown: buildMarkdown,
    checklist: checklist,
    safeFilename: safeFilename,
    serializePack: serializePack,
    exportJson: exportJson,
    importJson: importJson,
    clonePack: clonePack,
    jsonTooLarge: jsonTooLarge,
    sectionById: sectionById
  };
});
