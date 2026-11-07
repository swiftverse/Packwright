# License inventory

This list is informational. It is not a legal opinion, and it is not a promise that the project has zero legal risk.

## The app you open

`dist/packwright.html` is built from `src/`. Those files are original to this project.

- License: MIT
- Copyright: Amit Shrivastava, 2026
- Text: see [LICENSE](LICENSE)
- Runtime dependencies: none
- The HTML file does not load fonts, scripts, images, or analytics from a network

## Development only

These packages are installed to run browser tests. They are not written into `dist/packwright.html`.

| Package | Version used in the test run | License | Role |
| --- | --- | --- | --- |
| `@playwright/test` | 1.65.0 | Apache-2.0 | Test runner |
| `playwright` | pulled in by `@playwright/test` 1.65.0 | Apache-2.0 | Browser automation library |
| `playwright-core` | pulled in by Playwright 1.65.0 | Apache-2.0 | Browser driver used by Playwright |

Apache License 2.0 is the license text in `node_modules/playwright-core/LICENSE` after `npm install`. Node.js supplies the unit-test runner (`node --test`). Node is not bundled into the HTML file.

No other application dependency is declared.
