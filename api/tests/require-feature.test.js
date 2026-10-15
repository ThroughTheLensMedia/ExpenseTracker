'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const ADMIN_ID = '49e7efcb-6434-4f0c-9563-3151a6d50df9';
const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function install({ roleIsAdmin, flagEnabled }) {
  const dbPath = require.resolve('../db');
  const fakeSb = {
    from(table) {
      if (table === 'user_roles') {
        return {
          select() {
            return {
              eq(_c, val) {
                return {
                  single() {
                    if (val === ADMIN_ID && roleIsAdmin) {
                      return Promise.resolve({ data: { role: 'admin' }, error: null });
                    }
                    return Promise.resolve({ data: { role: 'user' }, error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'app_flags') {
        return {
          select() {
            return Promise.resolve({
              data: [{ key: 'mileage', enabled: !!flagEnabled }],
              error: null,
            });
          },
        };
      }
      return { select() { return { eq() { return { single() { return Promise.resolve({ data: null, error: null }); } }; } }; } };
    },
  };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { supabase: fakeSb } };
  delete require.cache[require.resolve('../utils/flags')];
  delete require.cache[require.resolve('../middleware/requireFeature')];
  const flags = require('../utils/flags');
  flags.bustFlagCache();
  const { requireFeature } = require('../middleware/requireFeature');
  return { requireFeature, restore: () => {
    delete require.cache[dbPath];
    delete require.cache[require.resolve('../utils/flags')];
    delete require.cache[require.resolve('../middleware/requireFeature')];
  }};
}

function hit({ userId, roleIsAdmin, flagEnabled }) {
  return new Promise((resolve, reject) => {
    const { requireFeature, restore } = install({ roleIsAdmin, flagEnabled });
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: userId, email: 't@example.com' };
      next();
    });
    app.get('/t', requireFeature('mileage'), (_req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      http.get({ hostname: '127.0.0.1', port, path: '/t' }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          server.close();
          restore();
          let json = null;
          try { json = JSON.parse(body); } catch { /* */ }
          resolve({ status: res.statusCode, json });
        });
      }).on('error', (e) => { server.close(); restore(); reject(e); });
    });
  });
}

test('requireFeature: non-admin blocked when flag off', async () => {
  const res = await hit({ userId: USER_ID, roleIsAdmin: false, flagEnabled: false });
  assert.equal(res.status, 403);
  assert.equal(res.json.error, 'feature_disabled');
});

test('requireFeature: non-admin allowed when flag on', async () => {
  const res = await hit({ userId: USER_ID, roleIsAdmin: false, flagEnabled: true });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
});

test('requireFeature: admin bypasses when flag off', async () => {
  const res = await hit({ userId: ADMIN_ID, roleIsAdmin: true, flagEnabled: false });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
});
