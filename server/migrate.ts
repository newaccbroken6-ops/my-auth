import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Starting Neon PostgreSQL migration...');
    
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // Ensure profiles table has default uuid, columns and constraints
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL DEFAULT '',
        username TEXT,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_banned BOOLEAN NOT NULL DEFAULT false,
        ban_reason TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // Drop any old Supabase auth.users foreign key on profiles(id) if present
    await client.query(`
      DO $$
      DECLARE
        fk_record RECORD;
      BEGIN
        FOR fk_record IN (
          SELECT tc.constraint_name 
          FROM information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = 'profiles' 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'id'
        ) LOOP
          EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(fk_record.constraint_name);
        END LOOP;
      END $$;
    `);

    // Add default gen_random_uuid() to profiles.id if not present
    await client.query(`
      ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
    `);

    // Add missing columns if profiles was created previously without them
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='password_hash') THEN
          ALTER TABLE profiles ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
          ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='updated_at') THEN
          ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_unique'
        ) THEN
          BEGIN
            ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
          EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END $$;
    `);

    // Read and execute schema.sql
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('Tables and indexes created successfully!');

    // Create default administrator if none exists
    const adminRes = await client.query(`SELECT id, email FROM profiles WHERE role = 'admin' LIMIT 1;`);
    if (adminRes.rows.length === 0) {
      const defaultEmail = 'admin@supernova.com';
      const defaultPassword = 'admin';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      const existingUser = await client.query(`SELECT id FROM profiles WHERE email = $1;`, [defaultEmail]);
      if (existingUser.rows.length > 0) {
        await client.query(`
          UPDATE profiles 
          SET role = 'admin', password_hash = $1, username = 'Admin' 
          WHERE email = $2;
        `, [hashedPassword, defaultEmail]);
      } else {
        await client.query(`
          INSERT INTO profiles (email, password_hash, username, role)
          VALUES ($1, $2, 'Admin', 'admin');
        `, [defaultEmail, hashedPassword]);
      }
      console.log(`Default admin created: ${defaultEmail} / ${defaultPassword}`);
    } else {
      console.log(`Admin user already exists (${adminRes.rows[0].email}).`);
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
