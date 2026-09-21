/**
 * Setup Storage Bucket and Policies for Avatars
 * 
 * IMPORTANTE: Questo script richiede la SERVICE_ROLE_KEY (non la ANON_KEY)
 * 
 * Per eseguire:
 * 1. Vai su Supabase Dashboard → Settings → API
 * 2. Copia la "service_role" key (secret)
 * 3. Esegui: SERVICE_ROLE_KEY=your-key node setup-storage.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL not found in .env');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SERVICE_ROLE_KEY not provided');
  console.log('\n📝 Come ottenere la SERVICE_ROLE_KEY:');
  console.log('1. Vai su: https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/settings/api');
  console.log('2. Copia la "service_role" key (NON la anon key)');
  console.log('3. Esegui: SERVICE_ROLE_KEY=tua-key node setup-storage.js\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupStorage() {
  console.log('🚀 Setting up Storage for Avatars...\n');

  try {
    // 1. Crea bucket
    console.log('📦 Creating avatars bucket...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    const bucketExists = buckets?.some(b => b.name === 'avatars');
    
    if (!bucketExists) {
      const { data, error } = await supabase.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 2097152 // 2MB
      });
      
      if (error) {
        console.error('❌ Error creating bucket:', error.message);
        throw error;
      }
      console.log('✅ Bucket "avatars" created successfully');
    } else {
      console.log('✅ Bucket "avatars" already exists');
    }

    // 2. Aggiungi colonna avatar_url a profiles se non esiste
    console.log('\n📝 Adding avatar_url column to profiles...');
    const { error: columnError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;'
    });
    
    if (columnError) {
      console.log('⚠️  Cannot add column via RPC (normal, skip)');
    } else {
      console.log('✅ Column avatar_url ready');
    }

    console.log('\n✅ Setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Vai su: https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/storage/policies');
    console.log('2. Assicurati che le policy siano attive per il bucket "avatars"');
    console.log('3. Se non ci sono policy, esegui il file fix-storage-policies.sql nella SQL Editor');
    console.log('\n✨ Ora puoi uploadare avatar dalla pagina Settings!');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupStorage();
