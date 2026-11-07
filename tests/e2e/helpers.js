'use strict';

const { expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page) {
  const wider = await page.evaluate(() => {
    const view = window.innerWidth;
    const doc = document.documentElement.scrollWidth;
    return doc - view;
  });
  expect(wider).toBeLessThanOrEqual(1);
}

function trackRequests(page) {
  const urls = [];
  page.on('request', (request) => urls.push(request.url()));
  page.on('websocket', (socket) => urls.push('ws:' + socket.url()));
  return urls;
}

function externalRequests(urls) {
  return urls.filter((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return false;
    if (url.startsWith('file:')) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost';
    } catch (error) {
      return true;
    }
  });
}

module.exports = {
  expectNoHorizontalOverflow,
  trackRequests,
  externalRequests
};
