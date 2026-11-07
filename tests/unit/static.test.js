'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', '..', 'dist', 'packwright.html');

test('built file exists and is a single self-contained document', () => {
  assert.ok(fs.existsSync(htmlPath), 'Run node scripts/build.js before the static checks');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /^<!DOCTYPE html>/);
  assert.equal((html.match(/<script/gi) || []).length, 2);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(html, /___PACKWRIGHT_/);
  assert.match(html, /packwright\.context-pack/);
  assert.match(html, /Amit Shrivastava/);
  assert.match(html, /MIT License/);
  assert.match(html, /not affiliated with Anthropic, Claude/);
  assert.match(html, /does not encrypt/i);
  assert.match(html, /not token counts/);
  assert.match(html, /Hearth & Rye/);
  assert.match(html, /North Ward Notes/);
  assert.match(html, /Lantern Pantry/);
  assert.match(html, /Kitchen Card Box/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /Content-Security-Policy/);
});

test('built file has no remote hosts, executable sinks, or hidden credentials', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const banned = [
    [/https?:\/\//i, 'remote URL'],
    [/innerHTML/i, 'innerHTML'],
    [/outerHTML/i, 'outerHTML'],
    [/insertAdjacentHTML/i, 'insertAdjacentHTML'],
    [/document\.write/i, 'document.write'],
    [/\beval\s*\(/i, 'eval'],
    [/new\s+Function\s*\(/i, 'new Function'],
    [/\bfetch\s*\(/i, 'fetch'],
    [/XMLHttpRequest/i, 'XMLHttpRequest'],
    [/sendBeacon/i, 'sendBeacon'],
    [/WebSocket/i, 'WebSocket'],
    [/googleapis|google-analytics|googletagmanager|jsdelivr|unpkg|cdn\./i, 'third-party host'],
    [/api[_-]?key|secret[_-]?key|BEGIN (RSA |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}/i, 'credential'],
    [/quality score:\s*\d+/i, 'numeric quality score']
  ];
  for (const [pattern, label] of banned) {
    assert.equal(pattern.test(html), false, 'found ' + label);
  }
});
