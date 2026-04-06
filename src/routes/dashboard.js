const express = require('express');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, authorize('viewer', 'analyst', 'admin'), (req, res) => {
  const db = getDb();

  const totalIncome = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_records WHERE type = 'income'").get();
  const totalExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_records WHERE type = 'expense'").get();

  const categoryBreakdown = db.prepare(
    "SELECT category, type, SUM(amount) as total, COUNT(*) as count FROM financial_records GROUP BY category, type ORDER BY total DESC"
  ).all();

  const recentActivity = db.prepare(
    'SELECT fr.id, fr.amount, fr.type, fr.category, fr.record_date, u.name as created_by FROM financial_records fr JOIN users u ON fr.created_by = u.id ORDER BY fr.created_at DESC LIMIT 10'
  ).all();

  const monthlyTrend = db.prepare(
    `SELECT 
      strftime('%Y-%m', record_date) as month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
     FROM financial_records
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12`
  ).all();

  res.json({
    summary: {
      total_income: totalIncome.total,
      total_expenses: totalExpenses.total,
      net_balance: totalIncome.total - totalExpenses.total,
    },
    category_breakdown: categoryBreakdown,
    recent_activity: recentActivity,
    monthly_trend: monthlyTrend,
  });
});

module.exports = router;
