'use strict';

// Receipt upload file-type validation (file-type >= 21.3.1, GHSA-5v7r-6r5c-r473).
// Exercises POST /receipts/:table/:id end to end with stubbed storage + DB.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeFakeSb() {
  const uploads = [];
  return {
    uploads,
    storage: {
      from() {
        return {
          upload(path, buf, opts) {
            uploads.push({ path, size: buf.length, contentType: opts && opts.contentType });
            return Promise.resolve({ data: { path }, error: null });
          },
          remove() { return Promise.resolve({ data: null, error: null }); },
        };
      },
    },
    from(table) {
      const chain = {
        update(row) { chain._row = row; return chain; },
        select() { return chain; },
        eq() { return chain; },
        single() {
          return Promise.resolve({ data: { id: 'exp-1', table, amount_cents: 0, ...chain._row }, error: null });
        },
      };
      return chain;
    },
  };
}

function loadRouter(fakeSb) {
  const dbPath = require.resolve('../db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { supabase: fakeSb } };
  delete require.cache[require.resolve('../routes/receipts')];
  return require('../routes/receipts');
}

function upload({ buffer, filename, contentType, path = '/receipts/expenses/exp-1' }) {
  return new Promise((resolve, reject) => {
    const fakeSb = makeFakeSb();
    const router = loadRouter(fakeSb);
    const app = express();
    app.use((req, _res, next) => { req.user = { id: USER_ID }; req.sb = fakeSb; next(); });
    app.use('/receipts', router);
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const boundary = '----ledgerTestBoundary' + Date.now();
      const head = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
      );
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([head, buffer, tail]);
      const req = http.request({
        hostname: '127.0.0.1', port, path, method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
      }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          server.close();
          let json = null;
          try { json = JSON.parse(raw); } catch { /* ignore */ }
          resolve({ status: res.statusCode, json, uploads: fakeSb.uploads });
        });
      });
      req.on('error', (err) => { server.close(); reject(err); });
      req.end(body);
    });
  });
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]), // IHDR length + type
  Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00]),
  Buffer.from([0x90, 0x77, 0x53, 0xde]),
  Buffer.alloc(64),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
  Buffer.alloc(64),
  Buffer.from([0xff, 0xd9]),
]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]), Buffer.alloc(32)]);

// Malformed ASF: valid ASF header GUID, then a sub-object whose declared size is 0.
// file-type < 21.3.1 loops forever on this input (GHSA-5v7r-6r5c-r473).
const ASF_HEADER_GUID = Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11, 0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c]);
function malformedAsf() {
  const headerSize = Buffer.alloc(8); headerSize.writeBigUInt64LE(0xffffffffn);
  const reserved = Buffer.from([0x02, 0x00, 0x00, 0x00, 0x01, 0x02]);
  const subGuid = Buffer.from([0xb5, 0x03, 0xbf, 0x5f, 0x2e, 0xa9, 0xcf, 0x11, 0x8e, 0xe3, 0x00, 0xc0, 0x0c, 0x20, 0x53, 0x65]);
  const zeroSize = Buffer.alloc(8); // sub-header size 0
  const garbage = Buffer.alloc(256, 0x41);
  return Buffer.concat([ASF_HEADER_GUID, headerSize, reserved, subGuid, zeroSize, garbage]);
}

// ── Tests ───────────────────────────────────────────────────────────────────
test('receipt upload: valid PNG is detected and accepted', async () => {
  const res = await upload({ buffer: PNG, filename: 'r.png', contentType: 'image/png' });
  assert.equal(res.status, 200);
  assert.equal(res.uploads.length, 1);
  assert.match(res.json.receipt_link, /r\.png$/);
});

test('receipt upload: valid JPEG is detected and accepted', async () => {
  const res = await upload({ buffer: JPEG, filename: 'r.jpg', contentType: 'image/jpeg' });
  assert.equal(res.status, 200);
  assert.equal(res.uploads.length, 1);
});

test('receipt upload: valid PDF is detected and accepted', async () => {
  const res = await upload({ buffer: PDF, filename: 'r.pdf', contentType: 'application/pdf' });
  assert.equal(res.status, 200);
  assert.equal(res.uploads.length, 1);
});

test('receipt upload: disallowed type (GIF) rejected with same 400 message', async () => {
  const res = await upload({ buffer: GIF, filename: 'r.png', contentType: 'image/png' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'File type image/gif not allowed. Supported: JPEG, PNG, PDF');
  assert.equal(res.uploads.length, 0);
});

test('receipt upload: unrecognized bytes rejected', async () => {
  const res = await upload({ buffer: Buffer.from('hello, not a receipt'), filename: 'r.pdf', contentType: 'application/pdf' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'File type unrecognized');
});

test('receipt upload: extension mismatch still rejected', async () => {
  const res = await upload({ buffer: PNG, filename: 'r.txt', contentType: 'image/png' });
  assert.equal(res.status, 400);
  assert.equal(res.json.error, 'File extension mismatch');
});

test('receipt upload: malformed ASF completes within 2s and is rejected (no hang)', { timeout: 5000 }, async () => {
  const start = Date.now();
  const res = await upload({ buffer: malformedAsf(), filename: 'r.jpg', contentType: 'image/jpeg' });
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 2000, `took ${elapsed}ms`);
  assert.equal(res.status, 400);
  assert.equal(res.uploads.length, 0);
});

test('receipt upload: malformed ASF on /snap also completes and is rejected', { timeout: 5000 }, async () => {
  const start = Date.now();
  const res = await upload({ buffer: malformedAsf(), filename: 'r.png', contentType: 'image/png', path: '/receipts/snap' });
  assert.ok(Date.now() - start < 2000);
  assert.equal(res.status, 400);
  assert.equal(res.uploads.length, 0);
});

test('receipt upload: file over 4MB still returns 413', async () => {
  const big = Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024 + 1)]);
  const res = await upload({ buffer: big, filename: 'big.png', contentType: 'image/png' });
  assert.equal(res.status, 413);
  assert.match(res.json.error, /Max 4MB/);
  assert.equal(res.uploads.length, 0);
});
