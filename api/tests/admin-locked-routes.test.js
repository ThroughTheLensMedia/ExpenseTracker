'use strict';

/**
 * Verifies previously-unguarded admin routes now require an admin role.
 * Uses a lightweight Express harness with stubbed auth + supabase.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const ADMIN_ID = '49e7efcb-6434-4f0c-9563-3151a6d50df9';
const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function stubDb(roleByUser) {
  const dbPath = require.resolve('../db');
  const fakeSb = {
    from(table) {
      if (table === 'user_roles') {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  single() {
                    const role = roleByUser[val];
                    if (!role) return Promise.resolve({ data: null, error: { message: 'not found' } });
                    return Promise.resolve({ data: { role }, error: null });
                  },
                };
              },
            };
          },
        };
      }
      // Generic no-op for other tables hit by handlers after auth
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        gte() { return chain; },
        update() { return chain; },
        insert() { return chain; },
        delete() { return chain; },
        order() { return chain; },
        single() { return Promise.resolve({ data: { expires_at: null }, error: null }); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        then(resolve) { resolve({ data: [], error: null }); },
      };
      return chain;
    },
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: fakeSb },
  };
  return () => { delete require.cache[dbPath]; };
}

function loadAdminRouter() {
  // Clear cached modules that capture db at require time
  delete require.cache[require.resolve('../middleware/auth')];
  delete require.cache[require.resolve('../routes/admin')];
  delete require.cache[require.resolve('../utils/userDirectory')];
  return require('../routes/admin');
}

function withServer(role, path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const restore = stubDb({
      [ADMIN_ID]: 'admin',
      [USER_ID]: 'user',
    });
    try {
      const router = loadAdminRouter();
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.user = {
          id: role === 'admin' ? ADMIN_ID : USER_ID,
          email: role === 'admin' ? 'joshua.deuermeyer@gmail.com' : 'user@example.com',
        };
        req.sb = require('../db').supabase;
        next();
      });
      app.use('/admin', router);

      const server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        const opts = {
          hostname: '127.0.0.1',
          port,
          path: '/admin' + path,
          method,
          headers: { 'Content-Type': 'application/json' },
        };
        const req = http.request(opts, (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => {
            server.close();
            restore();
            delete require.cache[require.resolve('../routes/admin')];
            delete require.cache[require.resolve('../middleware/auth')];
            resolve({ status: res.statusCode, body });
          });
        });
        req.on('error', (err) => {
          server.close();
          restore();
          reject(err);
        });
        if (method === 'POST' || method === 'PATCH') {
          req.write('{}');
        }
        req.end();
      });
    } catch (err) {
      restore();
      reject(err);
    }
  });
}

const LOCKED = [
  { method: 'GET', path: '/daily-report' },
  { method: 'POST', path: '/purge-cloudflare' },
  { method: 'GET', path: '/export-all' },
  { method: 'POST', path: '/import-all' },
  { method: 'POST', path: '/subscriptions/' + USER_ID + '/extend' },
  { method: 'POST', path: '/subscriptions/' + USER_ID + '/suspend' },
];

for (const route of LOCKED) {
  test(`non-admin gets 403 on ${route.method} ${route.path}`, async () => {
    const res = await withServer('user', route.path, route.method);
    assert.equal(res.status, 403, `expected 403, got ${res.status}: ${res.body}`);
  });

  test(`admin is not 403 on ${route.method} ${route.path}`, async () => {
    const res = await withServer('admin', route.path, route.method);
    assert.notEqual(res.status, 403, `admin should not be 403, got ${res.status}: ${res.body}`);
    // May be 200/400/500 depending on missing CF creds etc. — just not Access Denied
    assert.ok(res.status !== 401);
  });
}
