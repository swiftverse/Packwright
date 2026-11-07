# Packwright test report

Date of this run: 2026-11-07

Environment:

- Linux
- Node.js v22.23.4
- `@playwright/test` 1.65.0
- Chromium: Chrome for Testing 158.0.8127.18 (Playwright chromium build 1254)
- Firefox: 159.0 (Playwright firefox build 1572)
- WebKit: 27.2 (Playwright webkit build 2388)

The HTML file under test was `dist/packwright.html`, rebuilt from `src/` before these commands. No test required a network service, an API key, or an account.

## Commands and results

Unit tests, from `/workspace`:

```bash
node --test tests/unit/*.test.js
```

Result: **30 passed, 0 failed** (about 65 ms). Exit code 0.

Browser tests, one engine at a time:

```bash
npx playwright test --project=chromium
```

Result: **25 passed, 0 failed** (10.5 s). Exit code 0.

```bash
PW_FIREFOX=1 npx playwright test --project=firefox
```

Result: **25 passed, 0 failed** (12.5 s). Exit code 0.

```bash
PW_WEBKIT=1 npx playwright test --project=webkit
```

Result: **25 passed, 0 failed** (12.5 s). Exit code 0.

Total: **30 unit tests + 25 browser tests × 3 engines = 105 passing tests.** The 25 browser tests are the same cases, not 75 different scenarios.

`npm test` runs the build, the unit tests, and the Chromium project only. Firefox and WebKit are opt-in so a machine without those browsers can still run the default check.

## What the unit tests cover

- Empty pack shape, and presets that do not share state
- All four fictional samples: Small business, Writing and research, Learning, Coding
- Markdown for a blank pack, a partial pack, a full pack, and a pack that still contains sample text
- Task, constraints, unknowns, and provided source notes stay in that order
- Excluded section text is absent from the Markdown, including when the text contains a script string
- Word counts and character counts, including an emoji that is one code point and two UTF-16 units
- Newline normalization
- Filenames: empty, Windows reserved names, slashes, quotes, leading dots, bidi overrides, accented characters, emoji, and a 60-character cap
- JSON round trip with Unicode, newlines, sample flags, and HTML text
- Rejection, without applying a partial pack, of: malformed JSON, the wrong schema, version 2, a string version, unknown fields, an unknown section, a control character, an overlong field, an oversized file, and a `__proto__` payload
- Checklist wording for missing essentials, a short goal, and leftover sample text
- The built HTML file contains no remote URL, no `innerHTML`, no `fetch`, no `eval`, and no embedded credential

## What the browser tests cover

- Blank screen: missing-essentials checklist, zero note counts, no fictional bakery or pantry names
- Each sample loads, shows a Sample label, and does not ask before replacing another untouched sample
- Editing a sample clears that box’s Sample label and blocks the next sample or a clear until you confirm; Cancel and Escape keep the text
- Turning Constraints off keeps the textarea and removes its sentence from the preview and the downloaded Markdown
- Counts on screen match the included notes and the preview source
- Downloaded Markdown bytes match the preview source; suggested names keep Unicode
- Full path: fill every box, including a newline, an emoji, and a `<script>` string; uncheck Unknowns; download Markdown and JSON; clear; import the JSON; the same text and the unchecked box come back; the script does not run
- Bad imports (broken JSON, schema version 2, an unknown field, an unknown section field, a file over 750,000 bytes) show an error and leave the goal text in place
- Import over a filled sample asks first; Cancel keeps the sample
- A title of `CON` downloads as `context-pack.md`
- A pasted `<script>` and `<img onerror>` stay as text in the preview; no extra script element is created and no dialog opens
- Chromium clipboard: `navigator.clipboard.readText()` returned the pack, including the goal sentence and the “not encrypted” line
- Forced clipboard failure on all three engines: the manual copy box is shown, focused, and contains the pack; the form text remains
- A missing clipboard API with a working `document.execCommand('copy')` reports success
- HTTP page: no request to a host other than `127.0.0.1`; paths only `/`, `/packwright.html`, or a browser `/favicon.ico`
- `file://` open of `dist/packwright.html`: the sample renders, a script payload does not run, and every request was `file:`, `data:`, or `blob:`
- Draft off by default: text typed and reloaded is gone, and `packwright.v1.draft` is empty
- Draft on: refresh restores the text and the checkbox; Cancel on “stop saving” keeps it; confirming the delete leaves the tab text, and the next reload is blank
- `localStorage` throwing `SecurityError`: the page says storage is blocked, the checkbox is disabled, and typed text remains
- `QuotaExceededError` on the first save: the checkbox stays off, consent is not stored, and the sentence remains
- `QuotaExceededError` on a later edit: the newer sentence remains and the checkbox stays on
- Desktop 1280×800: skip link focus ring, a label and include checkbox for every section, Enter in the goal inserts a newline, no horizontal overflow with a long unbroken string
- 390×700 and 320×700: no horizontal overflow
- Light and dark theme changes do not erase the goal
- About text includes the non-affiliation sentence and the “does not encrypt” sentence

## Noted engine differences

- WebKit’s suggested download filename replaced spaces with underscores (`Café_tool_library.json`). Chromium and Firefox kept the spaces (`Café tool library.json`). The tests accept either spelling. The saved file contents were still compared to the preview.
- Firefox rejected Playwright’s `clipboard-read` permission name, and WebKit rejected `clipboard-write`. The Chromium test is the one that reads the clipboard back. Firefox and WebKit still had to complete a copy attempt and the forced manual-fallback path.

## README edit on 2026-11-07, later the same day

The download steps now point at `dist/packwright.html` in the repository, and the develop section no longer links to a localhost address. This turn ran:

```bash
node scripts/build.js && node --test tests/unit/*.test.js
```

Result: **30 passed, 0 failed** (198 ms). Exit code 0. The built HTML stayed 82,268 bytes. The Chromium, Firefox, and WebKit suites were not run again after this wording change.

## Repository upload check on 2026-11-07

The download section of the README names branch `cursor/upload-packwright-app-82c1` and the raw URL for `dist/packwright.html`. Screenshot paths stay relative (`assets/`). `.gitignore` also ignores zip archives and video recordings. The built file matched the copy shipped in the source archive: 82,268 bytes.

From `/workspace`, after that README edit and before this section was added:

```bash
node scripts/build.js && node --test tests/unit/*.test.js
```

Result: **30 passed, 0 failed** (88 ms). Exit code 0. The build wrote `dist/packwright.html` at 82,268 bytes, byte-for-byte the same as the archive copy.

```bash
npx playwright test --project=chromium
```

Result: **25 passed, 0 failed** (11.7 s). Exit code 0.

```bash
PW_FIREFOX=1 npx playwright test --project=firefox
```

Result: **25 passed, 0 failed** (14.0 s). Exit code 0.

```bash
PW_WEBKIT=1 npx playwright test --project=webkit
```

Result: **25 passed, 0 failed** (17.1 s). Exit code 0.

Total for this check: **30 unit tests + 25 browser tests × 3 engines = 105 passing executions.** These are the same cases as the earlier run, not new scenarios. Playwright printed a `NO_COLOR` / `FORCE_COLOR` warning on each browser command. The tests still passed.

Environment for this check: Linux, Node.js v22.23.4, `@playwright/test` 1.65.0, Chrome for Testing 158.0.8127.18 (Playwright chromium build 1254), Firefox 159.0 (Playwright firefox build 1572), WebKit 27.2 (Playwright webkit build 2388). Windows, macOS Safari, and physical phones were not part of this run.

The browser suites do not read this report. This section was written after those commands finished.

The unit command was run again after the README upload sentence and the browser results above were saved, and before this paragraph was added:

```bash
node scripts/build.js && node --test tests/unit/*.test.js
```

Result: **30 passed, 0 failed** (91 ms). Exit code 0. The built HTML stayed 82,268 bytes. The browser suites were not repeated after that documentation sentence.

## What was not tested

- Windows or macOS builds of Chrome, Firefox, or Safari, beyond Playwright’s Linux browser builds
- A physical phone. The 390 and 320 pixel checks resized the desktop browser
- Browsers old enough to lack `<dialog>`, blob downloads, or `localStorage`
- Token counts, encryption, or any assistant’s behavior after you paste the file
- Grapheme-cluster character counts. The counter uses Unicode code points
