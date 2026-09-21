# Fix Avatar Upload - "new row violates row-level security policy"

Guida rapida per risolvere il problema di upload avatar.

## Problema

Quando provi a caricare un avatar, ricevi l'errore:
```
new row violates row-level security policy
```

## Causa

Il bucket storage `avatars` non è configurato correttamente su Supabase.

---

## ✅ SOLUZIONE RAPIDA (5 minuti)

### Passo 1: Vai su Supabase Storage

Apri: **https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/storage/buckets**

### Passo 2: Crea Bucket (se non esiste)

1. Clicca **"New bucket"**
2. Nome: `avatars`
3. **Public bucket**: ✅ **ATTIVA QUESTA OPZIONE**
4. File size limit: `2097152` (2MB)
5. Clicca **"Create bucket"**

### Passo 3: Configura Policy

Vai su: **https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/storage/policies**

Oppure clicca sul bucket `avatars` → tab **"Policies"**

### Passo 4: Aggiungi Policy tramite SQL

1. Vai su: **https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/sql/new**

2. Copia e incolla questo codice SQL:

```sql
-- Crea bucket se non esiste
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 2097152)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy 1: Tutti possono vedere gli avatar
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy 2: Utenti possono uploadare nella propria cartella
CREATE POLICY "User Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Utenti possono aggiornare solo il proprio avatar
CREATE POLICY "User Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Utenti possono eliminare solo il proprio avatar
CREATE POLICY "User Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

3. Clicca **"Run"** (o `Ctrl+Enter`)

4. Dovresti vedere: ✅ **"Success. No rows returned"**

### Passo 5: Testa

1. Vai su: **https://tuoprogetto.vercel.app/settings**
2. Clicca su **"Choose Image"**
3. Seleziona un'immagine
4. ✅ Dovrebbe caricarsi senza errori!

---

## 🔧 SOLUZIONE ALTERNATIVA: UI di Supabase

Se preferisci usare l'interfaccia visuale:

### 1. Vai su Storage Policies

https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/storage/policies

### 2. Clicca "New Policy" per il bucket `avatars`

### 3. Aggiungi 4 Policy:

#### Policy A: SELECT (Lettura Pubblica)
- **Policy name:** `Public Access`
- **Allowed operation:** `SELECT`
- **Policy definition:** `For all users`
- **USING expression:**
  ```sql
  bucket_id = 'avatars'
  ```

#### Policy B: INSERT (Upload)
- **Policy name:** `User Upload`
- **Allowed operation:** `INSERT`
- **Policy definition:** `Custom`
- **WITH CHECK expression:**
  ```sql
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
  ```

#### Policy C: UPDATE (Aggiornamento)
- **Policy name:** `User Update`
- **Allowed operation:** `UPDATE`
- **Policy definition:** `Custom`
- **USING expression:**
  ```sql
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
  ```

#### Policy D: DELETE (Eliminazione)
- **Policy name:** `User Delete`
- **Allowed operation:** `DELETE`
- **Policy definition:** `Custom`
- **USING expression:**
  ```sql
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
  ```

---

## 🎯 Verifica Configurazione

### Controlla che il bucket sia configurato correttamente:

1. Vai su: https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/storage/buckets
2. Clicca su `avatars`
3. Verifica:
   - ✅ **Public:** Yes
   - ✅ **File size limit:** 2 MB
   - ✅ **Allowed MIME types:** vuoto (accetta tutto)

### Controlla le Policy:

1. Vai su: https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/storage/policies
2. Dovresti vedere 4 policy per il bucket `avatars`:
   - ✅ Public Access (SELECT)
   - ✅ User Upload (INSERT)
   - ✅ User Update (UPDATE)
   - ✅ User Delete (DELETE)

---

## 📝 Aggiungi Colonna al Database

Se non hai ancora la colonna `avatar_url` nella tabella `profiles`:

```sql
-- Esegui questo nella SQL Editor
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
```

---

## ❓ Troubleshooting

### "Bucket already exists"
✅ OK! Vai direttamente al passo 3 (Policy)

### "Permission denied"
❌ Assicurati di essere loggato come Owner/Admin su Supabase

### "Policy already exists"
✅ OK! Le policy sono già configurate

### Upload funziona ma immagine non si vede
- Controlla che il bucket sia **Public** (non Private)
- Verifica l'URL dell'immagine nel database

### File troppo grande
- Limite: 2MB
- Comprimi l'immagine prima di caricarla

---

## 🎉 Risultato Finale

Dopo la configurazione, gli utenti potranno:
- ✅ Uploadare la propria foto profilo (max 2MB)
- ✅ Vedere la foto nella sidebar e header
- ✅ Rimuovere la foto profilo
- ✅ Foto visibile pubblicamente (URL diretto)

---

## 📞 Supporto

Se continui ad avere problemi:
1. Controlla i log nella console del browser (F12)
2. Controlla i log di Supabase: https://supabase.com/dashboard/project/wncowlnkfjvmdhvtfxhz/logs/edge-logs
3. Verifica che l'utente sia autenticato correttamente
