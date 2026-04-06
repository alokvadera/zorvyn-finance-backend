const { initDatabase } = require('./index');
const bcrypt = require('bcryptjs');

const ADMIN_PASSWORD = 'admin123';
const ANALYST_PASSWORD = 'analyst123';
const VIEWER_PASSWORD = 'viewer123';

function seedDatabase() {
  const db = initDatabase();

  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const analystHash = bcrypt.hashSync(ANALYST_PASSWORD, 10);
  const viewerHash = bcrypt.hashSync(VIEWER_PASSWORD, 10);

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

  console.log('Database seeded successfully.');
  console.log('Demo users:');
  console.log('  admin@zorvyn.com   / admin123   (admin)');
  console.log('  analyst@zorvyn.com / analyst123  (analyst)');
  console.log('  viewer@zorvyn.com  / viewer123   (viewer)');
  console.log('  inactive@zorvyn.com/ viewer123   (inactive viewer)');
}

seedDatabase();
