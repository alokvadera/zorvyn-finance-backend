const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { registerSchema, statusSchema } = require('../services/validation');

const router = express.Router();

router.post('/', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const { name, email, password, role } = registerSchema.parse(req.body);
    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, hash, role, 'active');

    const user = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

router.get('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

router.patch('/:id', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { name, email, role } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
      if (dup) return res.status(409).json({ error: 'Email already exists' });
      updates.push('email = ?');
      params.push(email);
    }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const db = getDb();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);

    const updated = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
