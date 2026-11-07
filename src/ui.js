/*
 * Packwright
 * Copyright (c) 2026 Amit Shrivastava
 * Released under the MIT License.
 *
 * Browser UI. Renders user text with text nodes only. Does not store a draft
 * unless the person turns that on, and does not contact a network.
 */
(function () {
  'use strict';

  var P = globalThis.Packwright;
  var CONSENT_KEY = 'packwright.v1.consent';
  var DRAFT_KEY = 'packwright.v1.draft';
  var PROBE_KEY = 'packwright.v1.probe';

  var ui = {
    pack: P.emptyPack(),
    presetId: null,
    storage: 'ready',
    consent: false,
    busy: false
  };

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function isBlockStart(line) {
    if (!line) return false;
    if (line.indexOf('```') === 0) return true;
    if (/^\s*---\s*$/.test(line)) return true;
    if (/^#{1,3} /.test(line)) return true;
    if (line.indexOf('> ') === 0) return true;
    if (/^[-*] /.test(line)) return true;
    if (/^\d+\. /.test(line)) return true;
    return false;
  }

  function appendInline(parent, text) {
    var i = 0;
    while (i < text.length) {
      if (text.charAt(i) === '`') {
        var closeTick = text.indexOf('`', i + 1);
        if (closeTick > i + 1) {
          var code = document.createElement('code');
          code.textContent = text.slice(i + 1, closeTick);
          parent.appendChild(code);
          i = closeTick + 1;
          continue;
        }
      } else if (text.slice(i, i + 2) === '**') {
        var endBold = text.indexOf('**', i + 2);
        if (endBold > i + 2) {
          var strong = document.createElement('strong');
          strong.textContent = text.slice(i + 2, endBold);
          parent.appendChild(strong);
          i = endBold + 2;
          continue;
        }
      } else if (text.charAt(i) === '*') {
        var endEm = text.indexOf('*', i + 1);
        if (endEm > i + 1 && text.slice(endEm, endEm + 2) !== '**') {
          var em = document.createElement('em');
          em.textContent = text.slice(i + 1, endEm);
          parent.appendChild(em);
          i = endEm + 1;
          continue;
        }
      } else {
        var next = text.length;
        var tick = text.indexOf('`', i);
        var star = text.indexOf('*', i);
        if (tick >= 0 && tick < next) next = tick;
        if (star >= 0 && star < next) next = star;
        parent.appendChild(document.createTextNode(text.slice(i, next)));
        i = next;
        continue;
      }
      parent.appendChild(document.createTextNode(text.charAt(i)));
      i += 1;
    }
  }

  function renderMarkdown(container, markdown) {
    clearNode(container);
    var lines = String(markdown || '').split('\n');
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (line.indexOf('```') === 0) {
        var codeLines = [];
        i += 1;
        while (i < lines.length && lines[i].indexOf('```') !== 0) {
          codeLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        var pre = document.createElement('pre');
        var code = document.createElement('code');
        code.textContent = codeLines.join('\n');
        pre.appendChild(code);
        container.appendChild(pre);
        continue;
      }
      if (/^\s*---\s*$/.test(line)) {
        container.appendChild(document.createElement('hr'));
        i += 1;
        continue;
      }
      var heading = /^(#{1,3}) (.*)$/.exec(line);
      if (heading) {
        var h = document.createElement('h' + String(heading[1].length));
        appendInline(h, heading[2]);
        container.appendChild(h);
        i += 1;
        continue;
      }
      if (line.indexOf('> ') === 0) {
        var quote = [];
        while (i < lines.length && lines[i].indexOf('> ') === 0) {
          quote.push(lines[i].slice(2));
          i += 1;
        }
        var blockquote = document.createElement('blockquote');
        var quoteP = document.createElement('p');
        appendInline(quoteP, quote.join('\n'));
        blockquote.appendChild(quoteP);
        container.appendChild(blockquote);
        continue;
      }
      if (/^[-*] /.test(line)) {
        var ul = document.createElement('ul');
        while (i < lines.length && /^[-*] /.test(lines[i])) {
          var li = document.createElement('li');
          appendInline(li, lines[i].slice(2));
          ul.appendChild(li);
          i += 1;
        }
        container.appendChild(ul);
        continue;
      }
      if (/^\d+\. /.test(line)) {
        var ol = document.createElement('ol');
        while (i < lines.length && /^\d+\. /.test(lines[i])) {
          var item = document.createElement('li');
          appendInline(item, lines[i].replace(/^\d+\. /, ''));
          ol.appendChild(item);
          i += 1;
        }
        container.appendChild(ol);
        continue;
      }
      if (!line.trim()) {
        i += 1;
        continue;
      }
      var para = [line];
      i += 1;
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
        para.push(lines[i]);
        i += 1;
      }
      var p = document.createElement('p');
      appendInline(p, para.join('\n'));
      container.appendChild(p);
    }
  }

  function setStatus(message) {
    document.getElementById('status').textContent = message || '';
  }

  function showAlert(message) {
    var alert = document.getElementById('import-alert');
    alert.textContent = message || '';
    if (message) {
      alert.tabIndex = -1;
      alert.focus();
    }
  }

  function clearAlert() {
    document.getElementById('import-alert').textContent = '';
  }

  function setDraftMessage(message, problem) {
    var el = document.getElementById('draft-message');
    el.textContent = message || '';
    el.classList.toggle('problem', !!problem);
  }

  function storageErrorMessage(result) {
    if (result && result.quota) {
      return 'Could not update the draft stored in this browser because storage is full. Your notes are still in this tab. Download a copy so you do not lose them.';
    }
    return 'Could not update the draft because this browser refused storage. Your notes are still in this tab. Download a copy so you do not lose them.';
  }

  function probeStorage() {
    try {
      window.localStorage.setItem(PROBE_KEY, '1');
      window.localStorage.removeItem(PROBE_KEY);
      return 'ready';
    } catch (error) {
      return 'blocked';
    }
  }

  function persistDraft() {
    if (!ui.consent || ui.storage !== 'ready') return { ok: true, skipped: true };
    try {
      window.localStorage.setItem(DRAFT_KEY, P.exportJson(ui.pack));
      return { ok: true };
    } catch (error) {
      var quota = !!(error && (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014));
      return { ok: false, quota: quota };
    }
  }

  function draftClause() {
    if (!ui.consent) return '';
    return ' The draft stored in this browser will be updated to match.';
  }

  function askConfirm(title, body, okLabel) {
    return new Promise(function (resolve) {
      var dialog = document.getElementById('confirm-dialog');
      var ok = document.getElementById('confirm-ok');
      var cancel = document.getElementById('confirm-cancel');
      if (!dialog || typeof dialog.showModal !== 'function') {
        resolve(window.confirm(title + '\n\n' + body));
        return;
      }
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-body').textContent = body;
      ok.textContent = okLabel;
      var previous = document.activeElement;
      var settled = false;
      function finish(result) {
        if (settled) return;
        settled = true;
        dialog.removeEventListener('close', onClose);
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        if (dialog.open) dialog.close();
        resolve(result);
        if (previous && typeof previous.focus === 'function') previous.focus();
      }
      function onOk() { finish(true); }
      function onCancel() { finish(false); }
      function onClose() { finish(false); }
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      dialog.addEventListener('close', onClose);
      dialog.showModal();
      cancel.focus();
    });
  }

  function syncDerived() {
    var markdown = P.buildMarkdown(ui.pack);
    var notes = P.includedNotes(ui.pack);
    document.getElementById('notes-count').textContent =
      P.countWords(notes) + ' words · ' + P.countChars(notes) + ' characters in your included notes';
    document.getElementById('file-count').textContent =
      P.countWords(markdown) + ' words · ' + P.countChars(markdown) + ' characters in the exported file';
    document.getElementById('preview-source').textContent = markdown;
    renderMarkdown(document.getElementById('preview'), markdown);

    var titleSample = !!(ui.pack.titleSample && ui.pack.title && ui.pack.title.trim());
    document.getElementById('badge-title').hidden = !titleSample;

    var anySample = titleSample;
    var sections = P.SECTIONS;
    for (var i = 0; i < sections.length; i += 1) {
      var id = sections[i].id;
      var section = ui.pack.sections[id];
      var field = document.querySelector('.field[data-section="' + id + '"]');
      if (field) field.setAttribute('data-included', section.included ? 'true' : 'false');
      var showSample = !!(section.sample && section.text && section.text.trim() && section.included);
      document.getElementById('badge-' + id).hidden = !showSample;
      if (showSample) anySample = true;
    }

    var banner = document.getElementById('sample-banner');
    if (anySample) {
      banner.hidden = false;
      banner.textContent = 'Boxes marked Sample are fictional examples, not your notes. Edit a box to make it yours. If you copy or download before that, the file will include the sample and will say so.';
    } else {
      banner.hidden = true;
      banner.textContent = '';
    }

    var userWriting = P.hasPopulatedUserEntries(ui.pack);
    var presets = P.PRESETS;
    for (var p = 0; p < presets.length; p += 1) {
      var pressed = ui.presetId === presets[p].id && !userWriting;
      document.getElementById('preset-' + presets[p].id).setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
    document.getElementById('preset-blank').setAttribute('aria-pressed', P.hasAnyText(ui.pack) ? 'false' : 'true');

    var items = P.checklist(ui.pack);
    var list = document.getElementById('checklist');
    clearNode(list);
    var labels = { missing: 'Still needed', optional: 'Optional', note: 'Note', ready: 'Ready' };
    for (var c = 0; c < items.length; c += 1) {
      var li = document.createElement('li');
      li.className = 'check check-' + items[c].tone;
      var tag = document.createElement('span');
      tag.className = 'check-tag';
      tag.textContent = labels[items[c].tone] || 'Note';
      var msg = document.createElement('span');
      msg.textContent = items[c].message;
      li.appendChild(tag);
      li.appendChild(msg);
      list.appendChild(li);
    }
  }

  function applyForm() {
    document.getElementById('pack-title').value = ui.pack.title || '';
    var sections = P.SECTIONS;
    for (var i = 0; i < sections.length; i += 1) {
      var id = sections[i].id;
      document.getElementById('field-' + id).value = ui.pack.sections[id].text;
      document.getElementById('include-' + id).checked = !!ui.pack.sections[id].included;
    }
    syncDerived();
  }

  function duplicatePack(pack) {
    var next = P.emptyPack();
    next.title = pack.title || '';
    next.titleSample = !!pack.titleSample;
    var sections = P.SECTIONS;
    for (var i = 0; i < sections.length; i += 1) {
      var id = sections[i].id;
      var section = pack.sections[id];
      next.sections[id] = {
        included: !!(section && section.included),
        text: section && section.text ? section.text : '',
        sample: !!(section && section.sample)
      };
    }
    return next;
  }

  function commit(nextPack, nextPresetId) {
    var previousPack = duplicatePack(ui.pack);
    var previousPreset = ui.presetId;
    ui.pack = nextPack;
    ui.presetId = nextPresetId;
    if (ui.consent && ui.storage === 'ready') {
      var saved = persistDraft();
      if (!saved.ok) {
        ui.pack = previousPack;
        ui.presetId = previousPreset;
        applyForm();
        setDraftMessage(storageErrorMessage(saved), true);
        setStatus('The pack was left as it was because the saved draft could not be updated.');
        return false;
      }
    }
    applyForm();
    return true;
  }

  function rememberTyping() {
    syncDerived();
    var status = document.getElementById('status');
    if (status && status.textContent.indexOf('Could not') === -1 && status.textContent.indexOf('left as it was') === -1) {
      status.textContent = '';
    }
    if (!ui.consent) return;
    var saved = persistDraft();
    if (!saved.ok) setDraftMessage(storageErrorMessage(saved), true);
    else if (document.getElementById('draft-message').classList.contains('problem')) {
      setDraftMessage('Draft saving is on again. The copy in this browser matches this tab.', false);
    }
  }

  function onTitleInput() {
    var title = document.getElementById('pack-title');
    ui.pack.title = P.normalizeNewlines(title.value).replace(/\n/g, ' ');
    ui.pack.titleSample = false;
    rememberTyping();
  }

  function onTextInput(event) {
    var id = event.target.id.replace(/^field-/, '');
    if (!ui.pack.sections[id]) return;
    ui.pack.sections[id].text = P.normalizeNewlines(event.target.value);
    ui.pack.sections[id].sample = false;
    rememberTyping();
  }

  function onIncludeChange(event) {
    var id = event.target.id.replace(/^include-/, '');
    if (!ui.pack.sections[id]) return;
    ui.pack.sections[id].included = !!event.target.checked;
    rememberTyping();
  }

  async function onPreset(id) {
    if (ui.busy) return;
    var next = id ? P.presetPack(id) : P.emptyPack();
    var label = 'Blank pack';
    if (id) {
      var preset = P.presetById(id);
      label = preset ? preset.label : 'sample';
    }
    if (id && ui.presetId === id && !P.hasPopulatedUserEntries(ui.pack)) {
      setStatus(label + ' is already showing.');
      return;
    }
    if (!id && !P.hasAnyText(ui.pack)) {
      setStatus('The pack is already empty.');
      return;
    }
    var needsConfirm = id ? P.hasPopulatedUserEntries(ui.pack) : P.hasAnyText(ui.pack);
    if (needsConfirm) {
      ui.busy = true;
      var ok = await askConfirm(
        id ? 'Replace these notes?' : 'Clear this pack?',
        id
          ? 'Replace your notes with the ' + label + ' sample? Your writing in this tab will be replaced.' + draftClause()
          : 'The notes in this tab will be removed.' + draftClause() + ' Files you already downloaded are not affected.',
        id ? 'Replace notes' : 'Clear notes'
      );
      ui.busy = false;
      if (!ok) {
        setStatus(id ? 'Kept your notes. The sample was not loaded.' : 'Kept your notes. Nothing was cleared.');
        return;
      }
    }
    if (!commit(next, id || null)) return;
    clearAlert();
    if (id) {
      setStatus('Loaded the ' + label + ' sample. Boxes marked Sample are examples, not your notes.');
    } else {
      setStatus('Cleared the pack. Download a file first next time if you want a copy.');
    }
  }

  function enableConsent() {
    var box = document.getElementById('draft-consent');
    if (ui.storage !== 'ready') {
      box.checked = false;
      ui.consent = false;
      setDraftMessage('This browser blocked local storage. Packwright will not save a draft. Use Copy or Download before you close the tab. Your notes stay in this tab until then.', true);
      return;
    }
    ui.consent = true;
    var saved = persistDraft();
    if (!saved.ok) {
      ui.consent = false;
      box.checked = false;
      setDraftMessage(storageErrorMessage(saved), true);
      return;
    }
    try {
      window.localStorage.setItem(CONSENT_KEY, 'yes');
    } catch (error) {
      ui.consent = false;
      box.checked = false;
      try { window.localStorage.removeItem(DRAFT_KEY); } catch (ignore) { /* still blocked */ }
      var quota = error && (error.name === 'QuotaExceededError' || error.code === 22);
      setDraftMessage(storageErrorMessage({ quota: !!quota }), true);
      return;
    }
    setDraftMessage('A draft of this pack will stay in this browser until you turn saving off. It is not encrypted.', false);
  }

  async function disableConsent() {
    var box = document.getElementById('draft-consent');
    if (ui.consent) {
      ui.busy = true;
      var ok = await askConfirm(
        'Stop saving a draft?',
        'This deletes the copy stored in this browser. The notes in this tab stay until you reload or close it. Downloaded files are not deleted.',
        'Delete saved draft'
      );
      ui.busy = false;
      if (!ok) {
        box.checked = true;
        setStatus('Kept the saved draft.');
        return;
      }
    }
    try {
      window.localStorage.removeItem(DRAFT_KEY);
      window.localStorage.removeItem(CONSENT_KEY);
    } catch (error) {
      box.checked = true;
      ui.consent = true;
      setDraftMessage('The saved draft could not be deleted because this browser refused storage. Your notes are still in this tab.', true);
      return;
    }
    ui.consent = false;
    box.checked = false;
    setDraftMessage('The saved draft was deleted from this browser. Nothing was sent anywhere.', false);
    setStatus('Draft saving is off. The notes in this tab are still here.');
  }

  function loadDraft() {
    var box = document.getElementById('draft-consent');
    ui.storage = probeStorage();
    if (ui.storage === 'blocked') {
      box.checked = false;
      box.disabled = true;
      ui.consent = false;
      setDraftMessage('This browser blocked local storage. Packwright will not save a draft. Use Copy or Download before you close the tab. Your notes stay in this tab until then.', true);
      return;
    }
    var consentValue = null;
    try {
      consentValue = window.localStorage.getItem(CONSENT_KEY);
    } catch (error) {
      ui.storage = 'blocked';
      box.checked = false;
      box.disabled = true;
      ui.consent = false;
      setDraftMessage('This browser blocked local storage. Packwright will not save a draft. Use Copy or Download before you close the tab. Your notes stay in this tab until then.', true);
      return;
    }
    if (consentValue !== 'yes') {
      ui.consent = false;
      box.checked = false;
      return;
    }
    ui.consent = true;
    box.checked = true;
    var raw = null;
    try {
      raw = window.localStorage.getItem(DRAFT_KEY);
    } catch (error) {
      ui.storage = 'blocked';
      ui.consent = false;
      box.checked = false;
      box.disabled = true;
      setDraftMessage('This browser blocked local storage. Packwright will not save a draft. The form was left as it was.', true);
      return;
    }
    if (!raw) {
      setDraftMessage('Draft saving is on. Edits in this tab will be kept in this browser.', false);
      return;
    }
    var result = P.importJson(raw);
    if (!result.ok) {
      setDraftMessage('A saved draft was found but could not be read. It was not applied. You can turn saving off to delete the stored copy. ' + result.error, true);
      return;
    }
    ui.pack = result.pack;
    ui.presetId = null;
    applyForm();
    setStatus('Restored the draft saved in this browser.');
    setDraftMessage('Draft saving is on. This copy is stored in this browser only and is not encrypted.', false);
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.width = '1px';
    area.style.height = '1px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    try { area.setSelectionRange(0, area.value.length); } catch (error) { /* selection may be unsupported */ }
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }
    area.remove();
    return !!ok;
  }

  function hideFallback() {
    var wrap = document.getElementById('copy-fallback');
    wrap.hidden = true;
    document.getElementById('copy-fallback-text').value = '';
  }

  function showFallback(text) {
    var wrap = document.getElementById('copy-fallback');
    document.getElementById('copy-fallback-help').textContent =
      'Automatic copy did not work. The pack is selected below. Press Ctrl+C, or Command+C on a Mac, to copy it.';
    var box = document.getElementById('copy-fallback-text');
    box.value = text;
    wrap.hidden = false;
    box.focus();
    box.select();
    try { box.setSelectionRange(0, box.value.length); } catch (error) { /* still visible */ }
  }

  async function copyPack() {
    var text = P.buildMarkdown(ui.pack);
    var copied = false;
    if (navigator.clipboard && window.isSecureContext && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (error) {
        copied = false;
      }
    }
    if (!copied) copied = fallbackCopy(text);
    if (copied) {
      hideFallback();
      setStatus('Copied the pack. Paste it into your assistant. It was not uploaded.');
      return;
    }
    showFallback(text);
    setStatus('Copy is blocked in this window. The pack is selected in the box below. Press Ctrl+C, or Command+C on a Mac.');
  }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2500);
  }

  function downloadMarkdown() {
    var filename = P.safeFilename(ui.pack.title, 'md');
    downloadFile(filename, P.buildMarkdown(ui.pack), 'text/markdown;charset=utf-8');
    setStatus('Downloaded ' + filename + '. It stays on this device unless you move the file.');
  }

  function downloadJson() {
    var size = P.jsonTooLarge(ui.pack);
    if (size.issues.length || size.tooBigFile) {
      var reason = size.issues.length
        ? 'Shorten these before saving JSON: ' + size.issues.join(', ') + '.'
        : 'The JSON file would be ' + size.bytes + ' bytes, over the ' + P.MAX_IMPORT_BYTES + ' byte limit this app can open again.';
      showAlert(reason + ' Nothing was saved. You can still download Markdown.');
      return;
    }
    var filename = P.safeFilename(ui.pack.title, 'json');
    downloadFile(filename, P.exportJson(ui.pack), 'application/json;charset=utf-8');
    clearAlert();
    setStatus('Saved ' + filename + '. It is an editable copy of this pack, not an encrypted file.');
  }

  async function onImportFile(file) {
    if (!file) return;
    if (file.size > P.MAX_IMPORT_BYTES) {
      showAlert('That file is too large (' + file.size + ' bytes). The limit is ' + P.MAX_IMPORT_BYTES + ' bytes. Nothing was changed.');
      return;
    }
    var text;
    try {
      text = await file.text();
    } catch (error) {
      showAlert('That file could not be read. Nothing was changed.');
      return;
    }
    var result = P.importJson(text);
    if (!result.ok) {
      showAlert(result.error);
      return;
    }
    if (P.hasAnyText(ui.pack)) {
      if (ui.busy) return;
      ui.busy = true;
      var ok = await askConfirm(
        'Replace these notes?',
        'The imported pack will replace what is in this tab.' + draftClause(),
        'Replace notes'
      );
      ui.busy = false;
      if (!ok) {
        setStatus('Import cancelled. Your notes were left as they were.');
        return;
      }
    }
    if (!commit(result.pack, null)) return;
    clearAlert();
    setStatus('Imported the pack. Check the preview, then copy or download when you are ready.');
  }

  function addPresetButton(host, id, label, blurb) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.id = id ? 'preset-' + id : 'preset-blank';
    button.setAttribute('aria-pressed', id ? 'false' : 'true');
    var labelEl = document.createElement('span');
    labelEl.className = 'preset-label';
    labelEl.id = button.id + '-label';
    labelEl.textContent = label;
    var blurbEl = document.createElement('span');
    blurbEl.className = 'preset-blurb';
    blurbEl.id = button.id + '-blurb';
    blurbEl.textContent = blurb;
    button.setAttribute('aria-labelledby', labelEl.id);
    button.setAttribute('aria-describedby', blurbEl.id);
    button.appendChild(labelEl);
    button.appendChild(blurbEl);
    button.addEventListener('click', function () { onPreset(id); });
    host.appendChild(button);
  }

  function buildPresets() {
    var host = document.getElementById('presets');
    addPresetButton(host, null, 'Blank pack', 'Empty boxes. Nothing is filled in for you.');
    var presets = P.PRESETS;
    for (var i = 0; i < presets.length; i += 1) {
      addPresetButton(host, presets[i].id, presets[i].label, presets[i].blurb);
    }
  }

  function buildFields() {
    var host = document.getElementById('fields');
    var sections = P.SECTIONS;
    for (var i = 0; i < sections.length; i += 1) {
      var meta = sections[i];
      var wrap = document.createElement('div');
      wrap.className = 'field';
      wrap.dataset.section = meta.id;

      var top = document.createElement('div');
      top.className = 'field-top';
      var step = document.createElement('span');
      step.className = 'step';
      step.textContent = String(i + 1);
      var heading = document.createElement('h3');
      var label = document.createElement('label');
      label.htmlFor = 'field-' + meta.id;
      label.textContent = meta.heading;
      heading.appendChild(label);
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.id = 'badge-' + meta.id;
      badge.textContent = 'Sample';
      badge.hidden = true;
      top.appendChild(step);
      top.appendChild(heading);
      top.appendChild(badge);

      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.id = 'hint-' + meta.id;
      hint.textContent = meta.hint;

      var includeWrap = document.createElement('div');
      includeWrap.className = 'include';
      var include = document.createElement('input');
      include.type = 'checkbox';
      include.id = 'include-' + meta.id;
      include.checked = true;
      var includeLabel = document.createElement('label');
      includeLabel.htmlFor = include.id;
      includeLabel.textContent = 'Include ' + meta.heading + ' in the pack';
      includeWrap.appendChild(include);
      includeWrap.appendChild(includeLabel);

      var area = document.createElement('textarea');
      area.id = 'field-' + meta.id;
      area.rows = 5;
      area.spellcheck = true;
      area.setAttribute('autocomplete', 'off');
      area.setAttribute('aria-describedby', hint.id);

      wrap.appendChild(top);
      wrap.appendChild(hint);
      wrap.appendChild(includeWrap);
      wrap.appendChild(area);
      host.appendChild(wrap);
      area.addEventListener('input', onTextInput);
      include.addEventListener('change', onIncludeChange);
    }
  }

  function bindStatic() {
    document.getElementById('pack-form').addEventListener('submit', function (event) {
      event.preventDefault();
    });
    document.getElementById('pack-title').addEventListener('input', onTitleInput);
    document.getElementById('copy-pack').addEventListener('click', function () { copyPack(); });
    document.getElementById('download-markdown').addEventListener('click', downloadMarkdown);
    document.getElementById('download-json').addEventListener('click', downloadJson);
    document.getElementById('clear-pack').addEventListener('click', function () { onPreset(null); });
    document.getElementById('import-json').addEventListener('click', function () {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', function (event) {
      var file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (file) onImportFile(file);
    });
    document.getElementById('draft-consent').addEventListener('change', function () {
      if (document.getElementById('draft-consent').checked) enableConsent();
      else disableConsent();
    });
    document.getElementById('theme').addEventListener('change', function (event) {
      var value = event.target.value;
      if (value === 'light' || value === 'dark') document.documentElement.dataset.theme = value;
      else delete document.documentElement.dataset.theme;
    });
    var modes = document.querySelectorAll('input[name="preview-mode"]');
    for (var i = 0; i < modes.length; i += 1) {
      modes[i].addEventListener('change', function (event) {
        var source = event.target.value === 'source';
        document.getElementById('preview').hidden = source;
        document.getElementById('preview-source').hidden = !source;
      });
    }
  }

  buildPresets();
  buildFields();
  bindStatic();
  applyForm();
  loadDraft();
})();
