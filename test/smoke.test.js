'use strict';
// Behaviour tests that must pass both before and after the dependency upgrades.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const shellQuote = require('shell-quote');
const { createServer } = require('../src/app');

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server.closeAllConnections) server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test('GET /health', async () => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(await r.json(), { status: 'ok' });
});

test('GET / renders and escapes the name (ejs)', async () => {
  const r = await fetch(`${base}/?name=${encodeURIComponent('<b>Ada</b>')}`);
  const html = await r.text();
  assert.strictEqual(r.status, 200);
  assert.match(html, /Hello, &lt;b&gt;Ada&lt;\/b&gt;!/);
});

test('POST /settings merges over defaults (lodash)', async () => {
  const r = await fetch(`${base}/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ theme: 'dark', notifications: { sms: true } }),
  });
  const { settings } = await r.json();
  assert.deepStrictEqual(settings, {
    theme: 'dark',
    language: 'en',
    notifications: { email: true, sms: true },
  });
});

test('GET /quote keeps the input as one shell argument (shell-quote)', async () => {
  const text = 'hello world; ls';
  const r = await fetch(`${base}/quote?text=${encodeURIComponent(text)}`);
  const { command } = await r.json();
  assert.deepStrictEqual(shellQuote.parse(command), ['echo', text]);
});

test('GET /self-check calls the health endpoint (node-fetch)', async () => {
  const r = await fetch(`${base}/self-check`);
  assert.deepStrictEqual(await r.json(), { upstream: 200, body: { status: 'ok' } });
});

test('unknown route returns 404', async () => {
  const r = await fetch(`${base}/nope`);
  assert.strictEqual(r.status, 404);
});
