'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const ADMIN_ID = '49e7efcb-6434-4f0c-9563-3151a6d50df9';
const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeFakeSb(opts = {}) {
  const migrationMissing = !!opts.migrationMissing;
  const rpcError = opts.rpcError || null;
  const rpcResult = opts.rpcResult || { key: 'bank_sync', enabled: false, updated_at: new Date().toISOString(), updated_by: ADMIN_ID };
  const auditRows = opts.auditRows || [];

  return {
    from(table) {
      if (table === 'user_roles') {
        return {
          select() {
            return {
              eq(_c, val) {
                return {
                  single() {
                    if (val === ADMIN_ID) return Promise.resolve({ data: { role: 'admin' }, error: null });
                    if (val === USER_ID) return Promise.resolve({ data: { role: 'user' }, error: null });
                    return Promise.resolve({ data: null, error: { message: 'not found' } });
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
            if (migrationMissing) {
              return Promise.resolve({ data: null, error: { code: '42P01', message: 'relation "app_flags" does not exist' } });
            }
            return Promise.resolve({
              data: [
                { key: 'bank_sync', enabled: true },
                { key: 'invoicing', enabled: true },
                { key: 'ai_assistant', enabled: true },
                { key: 'bot_require_human_confirm', enabled: false },
              ],
              error: null,
            });
          },
        };
      }
      if (table === 'app_flag_audit') {
        const chain = {
          select() { return chain; },
          order() { return chain; },
          limit() {
            if (migrationMissing) {
              return Promise.resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
            }
            return Promise.resolve({ data: auditRows, error: null });
          },
        };
        return chain;
      }
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        order() { return chain; },
        limit() { return Promise.resolve({ data: [], error: null }); },
        single() { return Promise.resolve({ data: null, error: null }); },
        then(resolve) { resolve({ data: [], error: null }); },
      };
      return chain;
    },
    rpc(name, args) {
      if (name !== 'set_app_flag') return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
      if (migrationMissing) {
        return Promise.resolve({ data: null, error: { code: '42883', message: 'function set_app_flag does not exist' } });
      }
      if (rpcError) return Promise.resolve({ data: null, error: rpcError });
      if (!args.p_reason || !String(args.p_reason).trim()) {
        return Promise.resolve({ data: null, error: { message: 'reason is required' } });
      }
      return Promise.resolve({ data: { ...rpcResult, key: args.p_key, enabled: args.p_enabled }, error: null });
    },
  };
}

function installDb(fakeSb) {
  const dbPath = require.resolve('../db');
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { supabase: fakeSb },
  };
  // Reset flags module cache so it picks up stubbed db
  const flagsPath = require.resolve('../utils/flags');
  delete require.cache[flagsPath];
  const flags = require('../utils/flags');
  flags.bustFlagCache();
  return () => {
    delete require.cache[dbPath];
    delete require.cache[flagsPath];
  };
}

function loadAdminRouter() {
  delete require.cache[require.resolve('../middleware/auth')];
  delete require.cache[require.resolve('../routes/admin')];
  return require('../routes/admin');
}

function request({ role, method, path, body, fakeSb }) {
  return new Promise((resolve, reject) => {
    const restore = installDb(fakeSb || makeFakeSb());
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
        const payload = body ? JSON.stringify(body) : null;
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/admin' + path,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          },
        }, (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => {
            server.close();
            restore();
            delete require.cache[require.resolve('../routes/admin')];
            delete require.cache[require.resolve('../middleware/auth')];
            let json = null;
            try { json = JSON.parse(raw); } catch { /* ignore */ }
            resolve({ status: res.statusCode, body: raw, json });
          });
        });
        req.on('error', (err) => { server.close(); restore(); reject(err); });
        if (payload) req.write(payload);
        req.end();
      });
    } catch (err) {
      restore();
      reject(err);
    }
  });
}

test('GET /admin/flags: non-admin 403', async () => {
  const res = await request({ role: 'user', method: 'GET', path: '/flags' });
  assert.equal(res.status, 403);
});

test('GET /admin/flags: admin returns flag list', async () => {
  const res = await request({ role: 'admin', method: 'GET', path: '/flags' });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.json.flags));
  assert.ok(res.json.flags.some(f => f.key === 'bank_sync'));
  assert.equal(res.json.migration_pending, false);
});

test('GET /admin/flags: migration missing returns defaults + marker', async () => {
  const res = await request({
    role: 'admin',
    method: 'GET',
    path: '/flags',
    fakeSb: makeFakeSb({ migrationMissing: true }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.migration_pending, true);
  const bank = res.json.flags.find(f => f.key === 'bank_sync');
  assert.equal(bank.enabled, true);
});

test('PATCH /admin/flags/:key rejects empty reason', async () => {
  const res = await request({
    role: 'admin',
    method: 'PATCH',
    path: '/flags/bank_sync',
    body: { enabled: false, reason: '   ' },
  });
  assert.equal(res.status, 400);
});

test('PATCH /admin/flags/:key rejects non-boolean enabled', async () => {
  const res = await request({
    role: 'admin',
    method: 'PATCH',
    path: '/flags/bank_sync',
    body: { enabled: 'no', reason: 'testing' },
  });
  assert.equal(res.status, 400);
});

test('PATCH /admin/flags/:key succeeds for admin with reason', async () => {
  const res = await request({
    role: 'admin',
    method: 'PATCH',
    path: '/flags/bank_sync',
    body: { enabled: false, reason: 'maintenance window' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.flag.enabled, false);
});

test('PATCH /admin/flags/:key returns 503 when migration pending', async () => {
  const res = await request({
    role: 'admin',
    method: 'PATCH',
    path: '/flags/bank_sync',
    body: { enabled: false, reason: 'try anyway' },
    fakeSb: makeFakeSb({ migrationMissing: true }),
  });
  assert.equal(res.status, 503);
  assert.equal(res.json.error, 'migration_pending');
});

test('PATCH /admin/flags/:key non-admin 403', async () => {
  const res = await request({
    role: 'user',
    method: 'PATCH',
    path: '/flags/bank_sync',
    body: { enabled: false, reason: 'nope' },
  });
  assert.equal(res.status, 403);
});

test('GET /admin/flags/audit admin ok', async () => {
  const res = await request({
    role: 'admin',
    method: 'GET',
    path: '/flags/audit',
    fakeSb: makeFakeSb({
      auditRows: [{
        id: '1', key: 'bank_sync', old_value: true, new_value: false,
        reason: 'test', changed_by: ADMIN_ID, changed_at: new Date().toISOString(),
      }],
    }),
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.entries.length, 1);
});
