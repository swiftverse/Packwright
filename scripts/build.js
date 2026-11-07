#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'src', 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const pack = fs.readFileSync(path.join(root, 'src', 'pack.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src', 'ui.js'), 'utf8');

function shieldScript(source) {
  return source.replace(/<\/script/gi, '<\\/script');
}

let html = template;
html = html.replace('___PACKWRIGHT_CSS___', () => css);
html = html.replace('___PACKWRIGHT_PACK___', () => shieldScript(pack));
html = html.replace('___PACKWRIGHT_UI___', () => shieldScript(ui));

if (html.includes('___PACKWRIGHT_')) {
  console.error('Build left a placeholder in the HTML file.');
  process.exit(1);
}

const banned = [
  [/https?:\/\//i, 'a remote URL'],
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
  [/<script[^>]+src=/i, 'an external script'],
  [/<link[^>]+stylesheet/i, 'an external stylesheet'],
  [/googleapis|google-analytics|googletagmanager|cdn\.|jsdelivr|unpkg|fonts\.g/i, 'a third-party host']
];

for (const [pattern, label] of banned) {
  if (pattern.test(html)) {
    console.error('Built file contains ' + label + ', which this app does not ship.');
    process.exit(1);
  }
}

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'packwright.html');
fs.writeFileSync(outFile, html);
console.log('Wrote ' + outFile + ' (' + Buffer.byteLength(html) + ' bytes)');
