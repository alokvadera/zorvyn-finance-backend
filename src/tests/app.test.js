const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'zorvyn-test.db');
const PROD_DB_PATH = path.join(__dirname, '..', '..', 'data', 'zorvyn.db');

let server;
let adminToken;
let analystToken;
let viewerToken;

function getDb(dbPath) {
  return new DatabaseSync(dbPath, { create: true });
}

function initTestDatabase(dbPath) {
  const db = getDb(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('viewer', 'analyst', 'admin')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL CHECK(amount > 0),
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      record_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

function seedTestDatabase(db) {
  const bcrypt = require('bcryptjs');
  const adminHash = bcrypt.hashSync('admin123', 10);
  const analystHash = bcrypt.hashSync('analyst123', 10);
  const viewerHash = bcrypt.hashSync('viewer123', 10);

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)'
  );
  insertUser.run('Alice Admin', 'admin@zorvyn.com', adminHash, 'admin', 'active');
  insertUser.run('Bob Analyst', 'analyst@zorvyn.com', analystHash, 'analyst', 'active');
  insertUser.run('Charlie Viewer', 'viewer@zorvyn.com', viewerHash, 'viewer', 'active');
  insertUser.run('Diana Inactive', 'inactive@zorvyn.com', viewerHash, 'viewer', 'inactive');

  const adminId = db.prepare("SELECT id FROM users WHERE email = 'admin@zorvyn.com'").get().id;
  const analystId = db.prepare("SELECT id FROM users WHERE email = 'analyst@zorvyn.com'").get().id;

  const insertRecord = db.prepare(
    'INSERT INTO financial_records (amount, type, category, record_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const records = [
    [50000, 'income', 'sales', '2025-01-05', 'Q1 product sales', adminId],
    [12000, 'expense', 'salary', '2025-01-10', 'January payroll', adminId],
    [8000, 'expense', 'marketing', '2025-01-15', 'Ad campaign', adminId],
    [35000, 'income', 'consulting', '2025-01-20', 'Client project', adminId],
    [3000, 'expense', 'software', '2025-01-22', 'SaaS subscriptions', adminId],
    [60000, 'income', 'sales', '2025-02-03', 'Q1 continued sales', analystId],
    [15000, 'expense', 'salary', '2025-02-10', 'February payroll', analystId],
    [5000, 'expense', 'infrastructure', '2025-02-14', 'Cloud hosting', analystId],
    [42000, 'income', 'consulting', '2025-02-18', 'Advisory retainer', analystId],
    [7000, 'expense', 'marketing', '2025-02-22', 'Social media ads', analystId],
    [55000, 'income', 'sales', '2025-03-01', 'Q2 launch sales', adminId],
    [12000, 'expense', 'salary', '2025-03-10', 'March payroll', adminId],
    [9500, 'expense', 'infrastructure', '2025-03-12', 'Server upgrade', adminId],
    [28000, 'income', 'consulting', '2025-03-20', 'Integration project', adminId],
    [4000, 'expense', 'software', '2025-03-25', 'Tool licenses', adminId],
  ];

  for (const r of records) {
    insertRecord.run(...r);
  }
}

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Zorvyn Finance Backend', () => {
  let base;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

    const db = initTestDatabase(TEST_DB_PATH);
    seedTestDatabase(db);
    db.close();

    process.env.DB_PATH = TEST_DB_PATH;

    const app = require('../app');
    server = app.listen(0);
    const port = server.address().port;
    base = `http://localhost:${port}`;

    const loginRes = await request('POST', `${base}/api/auth/login`, {
      email: 'admin@zorvyn.com',
      password: 'admin123',
    });
    adminToken = loginRes.body.token;

    const analystRes = await request('POST', `${base}/api/auth/login`, {
      email: 'analyst@zorvyn.com',
      password: 'analyst123',
    });
    analystToken = analystRes.body.token;

    const viewerRes = await request('POST', `${base}/api/auth/login`, {
      email: 'viewer@zorvyn.com',
      password: 'viewer123',
    });
    viewerToken = viewerRes.body.token;
  });

  after(() => {
    if (server) server.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  describe('Auth', () => {
    it('should login as admin successfully', async () => {
      const res = await request('POST', `${base}/api/auth/login`, {
        email: 'admin@zorvyn.com',
        password: 'admin123',
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.role, 'admin');
    });

    it('should reject invalid credentials', async () => {
      const res = await request('POST', `${base}/api/auth/login`, {
        email: 'admin@zorvyn.com',
        password: 'wrong',
      });
      assert.strictEqual(res.status, 401);
    });

    it('should reject inactive users', async () => {
      const res = await request('POST', `${base}/api/auth/login`, {
        email: 'inactive@zorvyn.com',
        password: 'viewer123',
      });
      assert.strictEqual(res.status, 403);
    });

    it('should return current user via /me', async () => {
      const res = await request('GET', `${base}/api/auth/me`, null, adminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.email, 'admin@zorvyn.com');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request('GET', `${base}/api/auth/me`);
      assert.strictEqual(res.status, 401);
    });
  });

  describe('User Management (Admin only)', () => {
    it('should create a new user', async () => {
      const res = await request('POST', `${base}/api/users`, {
        name: 'Test User',
        email: 'test@zorvyn.com',
        password: 'test1234',
        role: 'viewer',
      }, adminToken);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.user.email, 'test@zorvyn.com');
    });

    it('should reject duplicate email', async () => {
      const res = await request('POST', `${base}/api/users`, {
        name: 'Dup User',
        email: 'admin@zorvyn.com',
        password: 'dup1234',
        role: 'viewer',
      }, adminToken);
      assert.strictEqual(res.status, 409);
    });

    it('should list all users', async () => {
      const res = await request('GET', `${base}/api/users`, null, adminToken);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.users));
      assert.ok(res.body.users.length >= 4);
    });

    it('should reject non-admin from creating users', async () => {
      const res = await request('POST', `${base}/api/users`, {
        name: 'Hacker',
        email: 'hacker@zorvyn.com',
        password: 'hack1234',
        role: 'admin',
      }, viewerToken);
      assert.strictEqual(res.status, 403);
    });

    it('should update user status', async () => {
      const users = await request('GET', `${base}/api/users`, null, adminToken);
      const testUser = users.body.users.find(u => u.email === 'test@zorvyn.com');
      const res = await request('PATCH', `${base}/api/users/${testUser.id}/status`, {
        status: 'inactive',
      }, adminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.status, 'inactive');
    });
  });

  describe('Financial Records', () => {
    it('should allow admin to create records', async () => {
      const res = await request('POST', `${base}/api/records`, {
        amount: 1000,
        type: 'income',
        category: 'test',
        record_date: '2025-04-01',
        notes: 'Test record',
      }, adminToken);
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.record.amount, 1000);
    });

    it('should reject analyst from creating records', async () => {
      const res = await request('POST', `${base}/api/records`, {
        amount: 500,
        type: 'expense',
        category: 'test',
        record_date: '2025-04-01',
      }, analystToken);
      assert.strictEqual(res.status, 403);
    });

    it('should list records with pagination', async () => {
      const res = await request('GET', `${base}/api/records?limit=5&offset=0`, null, analystToken);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.records));
      assert.ok(res.body.records.length <= 5);
      assert.ok(res.body.pagination.total >= 15);
    });

    it('should filter records by type', async () => {
      const res = await request('GET', `${base}/api/records?type=income`, null, analystToken);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.records.every(r => r.type === 'income'));
    });

    it('should filter records by category', async () => {
      const res = await request('GET', `${base}/api/records?category=salary`, null, analystToken);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.records.every(r => r.category === 'salary'));
    });

    it('should get a single record', async () => {
      const all = await request('GET', `${base}/api/records?limit=1`, null, analystToken);
      const id = all.body.records[0].id;
      const res = await request('GET', `${base}/api/records/${id}`, null, analystToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.record.id, id);
    });

    it('should update a record', async () => {
      const all = await request('GET', `${base}/api/records?limit=1`, null, adminToken);
      const id = all.body.records[0].id;
      const res = await request('PATCH', `${base}/api/records/${id}`, {
        notes: 'Updated note',
      }, adminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.record.notes, 'Updated note');
    });

    it('should delete a record', async () => {
      const all = await request('GET', `${base}/api/records?limit=1`, null, adminToken);
      const id = all.body.records[0].id;
      const res = await request('DELETE', `${base}/api/records/${id}`, null, adminToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.message, 'Record deleted successfully');
    });

    it('should reject viewer from reading records', async () => {
      const res = await request('GET', `${base}/api/records`, null, viewerToken);
      assert.strictEqual(res.status, 403);
    });
  });

  describe('Dashboard Summary', () => {
    it('should return summary for all authenticated roles', async () => {
      for (const token of [viewerToken, analystToken, adminToken]) {
        const res = await request('GET', `${base}/api/dashboard/summary`, null, token);
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.summary);
        assert.ok(typeof res.body.summary.total_income === 'number');
        assert.ok(typeof res.body.summary.total_expenses === 'number');
        assert.ok(typeof res.body.summary.net_balance === 'number');
        assert.ok(Array.isArray(res.body.category_breakdown));
        assert.ok(Array.isArray(res.body.recent_activity));
        assert.ok(Array.isArray(res.body.monthly_trend));
      }
    });

    it('should calculate net balance correctly', async () => {
      const res = await request('GET', `${base}/api/dashboard/summary`, null, adminToken);
      const { total_income, total_expenses, net_balance } = res.body.summary;
      assert.strictEqual(net_balance, total_income - total_expenses);
    });
  });

  describe('Validation', () => {
    it('should reject login with invalid email', async () => {
      const res = await request('POST', `${base}/api/auth/login`, {
        email: 'not-an-email',
        password: 'test',
      });
      assert.strictEqual(res.status, 400);
      assert.ok(res.body.details);
    });

    it('should reject record with invalid type', async () => {
      const res = await request('POST', `${base}/api/records`, {
        amount: 100,
        type: 'refund',
        category: 'test',
        record_date: '2025-01-01',
      }, adminToken);
      assert.strictEqual(res.status, 400);
    });
  });
});
