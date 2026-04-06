const express = require('express');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { recordSchema, querySchema } = require('../services/validation');

const router = express.Router();

router.post('/', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const data = recordSchema.parse(req.body);
    const db = getDb();

    const result = db.prepare(
      'INSERT INTO financial_records (amount, type, category, record_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(data.amount, data.type, data.category, data.record_date, data.notes || '', req.user.id);

    const record = db.prepare('SELECT * FROM financial_records WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ record });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, authorize('analyst', 'admin'), (req, res, next) => {
  try {
    const filters = querySchema.parse(req.query);
    const db = getDb();

    let sql = 'SELECT fr.*, u.name as created_by_name FROM financial_records fr JOIN users u ON fr.created_by = u.id WHERE 1=1';
    const params = [];

    if (filters.type) {
      sql += ' AND fr.type = ?';
      params.push(filters.type);
    }
    if (filters.category) {
      sql += ' AND fr.category = ?';
      params.push(filters.category);
    }
    if (filters.start_date) {
      sql += ' AND fr.record_date >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND fr.record_date <= ?';
      params.push(filters.end_date);
    }

    const countSql = sql.replace('SELECT fr.*, u.name as created_by_name', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countSql).get(...params);

    sql += ' ORDER BY fr.record_date DESC LIMIT ? OFFSET ?';
    params.push(filters.limit, filters.offset);

    const records = db.prepare(sql).all(...params);
    res.json({ records, pagination: { total, limit: filters.limit, offset: filters.offset } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, authorize('analyst', 'admin'), (req, res) => {
  const db = getDb();
  const record = db.prepare('SELECT fr.*, u.name as created_by_name FROM financial_records fr JOIN users u ON fr.created_by = u.id WHERE fr.id = ?').get(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.json({ record });
});

router.patch('/:id', authenticate, authorize('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM financial_records WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const { amount, type, category, record_date, notes } = req.body;
    const updates = [];
    const params = [];

    if (amount !== undefined) { updates.push('amount = ?'); params.push(amount); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (record_date !== undefined) { updates.push('record_date = ?'); params.push(record_date); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);

    db.prepare(`UPDATE financial_records SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const record = db.prepare('SELECT fr.*, u.name as created_by_name FROM financial_records fr JOIN users u ON fr.created_by = u.id WHERE fr.id = ?').get(req.params.id);
    res.json({ record });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM financial_records WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Record not found' });
  }

  db.prepare('DELETE FROM financial_records WHERE id = ?').run(req.params.id);
  res.json({ message: 'Record deleted successfully' });
});

module.exports = router;
