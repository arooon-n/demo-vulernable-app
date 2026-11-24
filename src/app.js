'use strict';
// Small HTTP service. Each route uses one of the pinned (vulnerable) dependencies,
// so a static import scan sees every one of them as reachable from production code.
const http = require('http');
const ejs = require('ejs');
const _ = require('lodash');
const fetch = require('node-fetch');
const shellQuote = require('shell-quote');

const DEFAULT_SETTINGS = {
  theme: 'light',
  language: 'en',
  notifications: { email: true, sms: false },
};

const HOME_TEMPLATE = `<!doctype html>
<html>
  <head><title>Demo Store</title></head>
  <body>
    <h1>Hello, <%= name %>!</h1>
    <p>Welcome to the demo store.</p>
  </body>
</html>`;

const MAX_BODY = 1024 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  // ejs: render the home page
  if (req.method === 'GET' && url.pathname === '/') {
    const html = ejs.render(HOME_TEMPLATE, { name: url.searchParams.get('name') || 'guest' });
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // lodash: merge user-supplied settings over the defaults
  if (req.method === 'POST' && url.pathname === '/settings') {
    const body = await readJson(req);
    const merged = _.defaultsDeep({}, body, DEFAULT_SETTINGS);
    return sendJson(res, 200, { settings: merged });
  }

  // shell-quote: build a shell command string (returned only, never executed)
  if (req.method === 'GET' && url.pathname === '/quote') {
    const text = url.searchParams.get('text') || '';
    return sendJson(res, 200, { command: shellQuote.quote(['echo', text]) });
  }

  // node-fetch: call our own health endpoint
  if (req.method === 'GET' && url.pathname === '/self-check') {
    const upstream = await fetch(`http://127.0.0.1:${req.socket.localPort}/health`);
    return sendJson(res, 200, { upstream: upstream.status, body: await upstream.json() });
  }

  return sendJson(res, 404, { error: 'not found' });
}

function createServer() {
  return http.createServer((req, res) => {
    handle(req, res).catch((err) => sendJson(res, 400, { error: String(err.message || err) }));
  });
}

module.exports = { createServer, DEFAULT_SETTINGS };
