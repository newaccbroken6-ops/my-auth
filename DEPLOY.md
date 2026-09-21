# 🚀 Deploy SUPER NOVA KEYS su Vercel (con Neon PostgreSQL)

## Prerequisiti
- Account Vercel: https://vercel.com
- Account GitHub: https://github.com
- Database Neon PostgreSQL (già configurato)

---

## 📋 Passi per il Deploy su GitHub e Vercel

### 1. Crea un nuovo repository su GitHub
1. Vai su https://github.com/new
2. Inserisci il nome del repository (es. `supernova-auth`)
3. Scegli se renderlo Pubblico o Privato
4. **NON** spuntare "Add README", "Add .gitignore" o licenze (il progetto è già pronto)
5. Clicca su **Create repository**

---

### 2. Collega il repository locale e fai il Push

Apri il terminale nella cartella del progetto ed esegui:

```bash
git remote add origin https://github.com/TUO_USERNAME/NOME_REPO.git
git branch -M main
git push -u origin main
```

*(Se hai un token di accesso personale o utilizzi SSH, usa l'URL corrispondente).*

---

### 3. Deploy del Progetto su Vercel

1. Vai su [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Clicca su **Add New...** -> **Project**
3. Seleziona e importa il repository GitHub appena creato
4. Vercel rileverà automaticamente il framework Vite e le API serverless in `api/index.ts`
5. Nella sezione **Environment Variables**, inserisci le seguenti variabili:

| Nome Variabile | Valore |
|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_L6kjf7KotVlT@ep-curly-fire-b4xkww93-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `JWT_SECRET` | `supernova_auth_jwt_secret_key_2026_super_secure!` |
| `NODE_ENV` | `production` |

6. Clicca su **Deploy**!

---

## 🎯 Cosa fa Vercel automaticamente

- **Frontend React**: Compilato in bundle statico ad alte prestazioni e distribuito sulla CDN globale di Vercel.
- **Backend Express & API**: Eseguito come funzione serverless Node.js all'endpoint `/api/*` e `/functions/*`.
- **Database Neon**: Connesso in pooling sicuro SSL a Neon PostgreSQL.
- **Client C++ / Loader**: Possono interrogare direttamente `https://tuo-progetto.vercel.app/api/v1/validate-license` e `https://tuo-progetto.vercel.app/api/v1/latest-version`.

---

## 🔑 Credenziali Utente Predefinite
- **Email**: `admin@supernova.com`
- **Password**: `admin`
*(Puoi cambiare la password o creare nuovi utenti dal pannello Settings)*
