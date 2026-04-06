const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { loginSchema, registerSchema } = require('../services/validation');

const router = express.Router();

router.post('/login', (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

module.exports = router;
