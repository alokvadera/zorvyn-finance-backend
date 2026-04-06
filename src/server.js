const { initDatabase } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 3000;

try {
  initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exit(1);
}
