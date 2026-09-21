# 🚀 Deploy SUPER NOVA AUTH su Vercel

## Prerequisiti
- Account Vercel (gratuito): https://vercel.com
- Account GitHub (per connettere il repository)
- Progetto Supabase configurato

## 📋 Passi per il Deploy

### 1. Crea un Repository su GitHub
1. Vai su https://github.com/new
2. Crea un nuovo repository (pubblico o privato)
3. NON inizializzare con README (lo hai già)

### 2. Collega il Repository Locale a GitHub
```bash
git remote add origin https://github.com/TUO-USERNAME/TUO-REPO.git
git branch -M main
git push -u origin main
```

### 3. Deploy su Vercel

#### Opzione A: Via Web (Consigliato)
1. Vai su https://vercel.com
2. Clicca "Add New Project"
3. Importa il tuo repository GitHub
4. Vercel rileverà automaticamente Vite
5. **IMPORTANTE**: Aggiungi le variabili d'ambiente:
   - `VITE_SUPABASE_URL` = il tuo URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = la tua chiave pubblica Supabase
6. Clicca "Deploy"

#### Opzione B: Via CLI
```bash
# Installa Vercel CLI
npm install -g vercel

# Login a Vercel
vercel login

# Deploy
vercel

# Aggiungi le variabili d'ambiente
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Deploy in produzione
vercel --prod
```

## 🔧 Configurazione Supabase

### Deploy delle Funzioni Serverless
Le funzioni in `supabase/functions/` devono essere deployate su Supabase:

```bash
# Installa Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al progetto
supabase link --project-ref TUO-PROJECT-ID

# Deploy tutte le funzioni
supabase functions deploy admin-licenses
supabase functions deploy validate-license
supabase functions deploy reset-hwid
supabase functions deploy latest-version
```

### Applica le Migrazioni Database
```bash
# Applica le migrazioni
supabase db push
```

## ⚙️ Variabili d'Ambiente Necessarie

### Su Vercel:
- `VITE_SUPABASE_URL` - URL del progetto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chiave anonima/pubblica di Supabase

### Su Supabase (per le funzioni):
- Già configurate automaticamente da Supabase
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

## 🎯 Dopo il Deploy

1. Verifica che l'app si apra correttamente
2. Prova il login/registrazione
3. Testa la creazione di una licenza con nome custom
4. Controlla che il formato sia: `SUPER-NOVA-{CUSTOM-NAME}`

## 🔒 Sicurezza

- Il file `.env` NON viene caricato su Git (è in `.gitignore`)
- Le variabili d'ambiente sono configurate separatamente su Vercel
- Le chiavi segrete sono protette

## 📝 Note

- Il deploy su Vercel è gratuito per progetti personali
- Gli aggiornamenti sono automatici: ogni push su `main` triggera un nuovo deploy
- Vercel genera automaticamente preview per ogni branch/PR

## 🆘 Troubleshooting

### Build fallisce
- Verifica che `node_modules` non sia nel repository
- Controlla che tutte le dipendenze siano in `package.json`

### App mostra schermata bianca
- Verifica che le variabili d'ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` siano configurate su Vercel
- Controlla la console del browser per errori

### Funzioni Supabase non funzionano
- Verifica di aver fatto il deploy delle funzioni con `supabase functions deploy`
- Controlla i log su Supabase Dashboard
