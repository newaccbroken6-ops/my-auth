# Come Hostare il DLL su GitHub per Auto-Update

Guida completa per configurare GitHub come hosting per i tuoi file DLL e collegarli al sistema di aggiornamenti automatici.

## Perché GitHub?

- ✅ **Gratis** - Storage illimitato per file pubblici
- ✅ **Veloce** - CDN globale
- ✅ **Affidabile** - 99.9% uptime
- ✅ **Versionamento** - Traccia ogni modifica
- ✅ **Semplice** - Solo un git push

---

## Setup Iniziale

### 1. Crea Repository GitHub

```bash
# Opzione A: Usa repository esistente
cd existing-repo

# Opzione B: Crea nuovo repository
mkdir my-dll-releases
cd my-dll-releases
git init
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

### 2. Aggiungi il DLL

```bash
# Copia il tuo DLL nella cartella
cp /path/to/your/file.dll .

# Aggiungi al git
git add file.dll
git commit -m "Add initial DLL release"
git push origin main
```

**Nota:** GitHub supporta file fino a 100MB. Per file più grandi usa GitHub Releases o Git LFS.

---

## Ottenere il Raw URL

### Formato URL

```
https://github.com/USERNAME/REPO/raw/refs/heads/BRANCH/PATH/FILE.dll
```

### Esempio Reale

Se hai:
- **Username:** `wg27b8s8kn-spec`
- **Repo:** `ZIT`
- **Branch:** `main`
- **File:** `SKUZA.dll` (nella root)

**URL sarà:**
```
https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll
```

### Come Trovare il Raw URL

**Metodo 1: Dalla pagina GitHub**
1. Vai al file su GitHub: `https://github.com/USER/REPO/blob/main/file.dll`
2. Clicca sul pulsante **"Raw"**
3. Copia l'URL dalla barra del browser

**Metodo 2: Manualmente**
Sostituisci `/blob/` con `/raw/refs/heads/` nell'URL del file:
```
Prima:  https://github.com/USER/REPO/blob/main/file.dll
Dopo:   https://github.com/USER/REPO/raw/refs/heads/main/file.dll
```

---

## Collegare GitHub alla Dashboard

### 1. Vai su Dashboard → Updates

Apri: https://tuoprogetto.vercel.app/updates

### 2. Clicca "New Release"

Compila:
- **Version String:** `V1.0` (deve corrispondere al tuo codice C++)
- **Download URL:** Incolla il raw URL di GitHub
- **Changelog:** Descrizione delle modifiche
- **Force Update:** ✅ se obbligatorio

### 3. Pubblica

Clicca **"Publish Release"** e il sistema è pronto!

---

## Workflow Completo

### Ogni Volta che Aggiorni il DLL:

```bash
# 1. Compila il nuovo DLL
# (tuo processo di build)

# 2. Sostituisci il file su GitHub
cp build/output/new-version.dll SKUZA.dll

# 3. Commit e push
git add SKUZA.dll
git commit -m "Update to v1.1 - Fixed bug XYZ"
git push origin main

# 4. Vai sulla dashboard e crea nuova release
# - Version: V1.1
# - URL: (stesso di prima, GitHub servirà automaticamente il nuovo file)
# - Changelog: "Fixed bug XYZ"
```

**Importante:** Se usi lo stesso nome file, l'URL rimane identico. GitHub serve automaticamente l'ultima versione.

---

## Opzioni Avanzate

### A. Usa GitHub Releases (Consigliato per versioni multiple)

```bash
# Crea una release su GitHub
gh release create v1.0 SKUZA.dll --title "Version 1.0" --notes "Initial release"

# URL della release:
# https://github.com/USER/REPO/releases/download/v1.0/SKUZA.dll
```

**Vantaggi:**
- Ogni versione ha URL unico
- Storico completo
- Download statistics

### B. Usa Branch Separato per Releases

```bash
# Crea branch dedicato
git checkout -b releases
git add SKUZA.dll
git commit -m "Release v1.0"
git push origin releases

# URL:
# https://github.com/USER/REPO/raw/refs/heads/releases/SKUZA.dll
```

### C. Organizza in Cartelle

```
repo/
├── releases/
│   ├── stable/
│   │   └── SKUZA.dll
│   ├── beta/
│   │   └── SKUZA-beta.dll
│   └── dev/
│       └── SKUZA-dev.dll
```

URL: `https://github.com/USER/REPO/raw/refs/heads/main/releases/stable/SKUZA.dll`

---

## Troubleshooting

### ❌ "Failed to download" / 404

**Causa:** URL errato o file non pubblico

**Soluzione:**
1. Verifica che il repository sia **pubblico**
2. Controlla che il path sia corretto
3. Prova ad aprire l'URL nel browser

### ❌ "File too large"

**Causa:** GitHub ha limite 100MB per file singoli

**Soluzione:**
- Usa Git LFS: `git lfs track "*.dll"`
- Usa GitHub Releases invece del repository
- Comprimi il DLL (ma dovrai decomprimerlo nel loader)

### ❌ "Old version still downloading"

**Causa:** Cache del browser o del loader

**Soluzione:**
- Aggiungi timestamp all'URL: `?v=1234567890`
- Cambia nome file per ogni versione
- Aspetta qualche minuto per cache CDN

---

## Alternative a GitHub

Se GitHub non va bene:

| Servizio | Costo | Limite | Velocità |
|----------|-------|--------|----------|
| **Cloudflare R2** | Gratis (10GB) | Alta | Ottima |
| **Dropbox** | Gratis (2GB) | Bassa | Buona |
| **Google Drive** | Gratis (15GB) | Media | Buona |
| **Firebase Storage** | Gratis (5GB) | Alta | Ottima |
| **Server Proprio** | Varia | Infinita | Dipende |

---

## Best Practices

### ✅ Do

- Usa nomi file consistenti
- Mantieni storico delle versioni
- Testa il download prima di pubblicare
- Usa semantic versioning (v1.0, v1.1, v2.0)
- Documenta ogni release con changelog

### ❌ Don't

- Non cambiare URL frequentemente
- Non usare repository privato (pagamento)
- Non dimenticare di fare push dopo il commit
- Non usare caratteri speciali nei nomi file

---

## Esempio Completo

### Repository Setup

```bash
# Crea repo
mkdir SKUZA-Releases
cd SKUZA-Releases

# Inizializza
git init
git remote add origin https://github.com/wg27b8s8kn-spec/ZIT.git

# Aggiungi README
echo "# SKUZA DLL Releases" > README.md
git add README.md
git commit -m "Initial commit"

# Aggiungi DLL
cp ../build/SKUZA.dll .
git add SKUZA.dll
git commit -m "Release v1.0"
git push -u origin main
```

### Dashboard Setup

1. **URL del DLL:**
   ```
   https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll
   ```

2. **Nella Dashboard → Updates:**
   - Version: `V1.0`
   - URL: (sopra)
   - Changelog: `Initial release`
   - Force Update: ✅

3. **Test nel Loader C++:**
   ```cpp
   const std::string CURRENT_VERSION = "V1.0";
   // Il loader scaricherà automaticamente da GitHub
   ```

---

## Supporto

- Dashboard: https://tuoprogetto.vercel.app/updates
- GitHub Docs: https://docs.github.com/en/repositories
- Raw URL Info: https://raw.githubusercontent.com

---

## Link Utili

- GitHub Desktop: https://desktop.github.com
- Git Command Line: https://git-scm.com
- GitHub CLI (`gh`): https://cli.github.com
- Esempio Repository: https://github.com/wg27b8s8kn-spec/ZIT
