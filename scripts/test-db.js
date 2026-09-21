import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_L6kjf7KotVlT@ep-curly-fire-b4xkww93-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const client = await pool.connect();
    console.log('Connected to Neon PostgreSQL successfully!');
    const res = await client.query('SELECT NOW() as now, version() as version;');
    console.log('Server response:', res.rows[0]);

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Existing tables in public schema:', tablesRes.rows.map(r => r.table_name));

    client.release();
  } catch (err) {
    console.error('Error connecting to Neon:', err);
  } finally {
    await pool.end();
  }
}

main();
