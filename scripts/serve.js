#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 47321);
const host = process.env.HOST || '127.0.0.1';
const file = path.join(__dirname, '..', 'dist', 'packwright.html');

if (!fs.existsSync(file)) {
  console.error('Missing dist/packwright.html. Run: node scripts/build.js');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && (url === '/' || url === '/packwright.html')) {
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end('Not found');
});

server.listen(port, host, () => {
  console.log('Packwright preview at http://' + (host === '0.0.0.0' ? '127.0.0.1' : host) + ':' + port + '/');
});
