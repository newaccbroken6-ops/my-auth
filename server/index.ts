import app from './app.js';
import { runMigrations } from './migrate.js';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`🚀 SUPER NOVA API Server running on http://localhost:${PORT}`);
      console.log(`📦 Database: Neon PostgreSQL`);
      console.log(`🔑 Auth & Client APIs ready at /api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

export default app;
