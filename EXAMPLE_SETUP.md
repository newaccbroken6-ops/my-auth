# Setup Esempio con il tuo DLL

## URL del tuo DLL
```
https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll
```

---

## 1️⃣ Setup Dashboard

### Crea applicazione
1. Vai su: https://tuoprogetto.vercel.app/applications
2. Clicca **New Application**
3. Compila:
   - **Name:** `SKUZA Loader`
   - **Description:** `Main loader for SKUZA`
   - **Version:** `1.0.0`
4. Salva e **copia l'APP_ID** (esempio: `550e8400-e29b-41d4-a716-446655440000`)

### Crea prima release
1. Vai su: https://tuoprogetto.vercel.app/updates
2. Seleziona `SKUZA Loader`
3. Clicca **New Release**
4. Compila:
   - **Version String:** `V1.0`
   - **Download URL:** `https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll`
   - **Changelog:** `Initial release`
   - **Force Update:** ✅ (attiva)
5. Clicca **Publish Release**

### Copia endpoint
Dopo aver creato la release, vedrai l'endpoint:
```
https://wncowlnkfjvmdhvtfxhz.supabase.co/functions/v1/latest-version?app_id=TUO_APP_ID
```

---

## 2️⃣ Codice C++ Pronto

### File: `config.hpp`

```cpp
#pragma once
#include <string>

// ==========================================
// CONFIGURAZIONE - MODIFICA QUESTI VALORI
// ==========================================

namespace Config {
    // Supabase
    const std::string SUPABASE_URL = "https://wncowlnkfjvmdhvtfxhz.supabase.co";
    
    // App ID (dalla dashboard)
    const std::string APP_ID = "INSERISCI_QUI_IL_TUO_APP_ID";
    
    // Versione corrente (aggiorna ad ogni release)
    const std::string CURRENT_VERSION = "V1.0";
    
    // Path locale del DLL
    const std::string DLL_NAME = "SKUZA.dll";
    
    // Endpoint completo
    const std::string UPDATE_ENDPOINT = SUPABASE_URL + "/functions/v1/latest-version?app_id=" + APP_ID;
}
```

### File: `main.cpp` (esempio completo)

```cpp
#include <iostream>
#include <windows.h>
#include "config.hpp"
#include "auto_updater.hpp"

void ShowBanner() {
    std::cout << R"(
    ╔═══════════════════════════════════════╗
    ║       SKUZA LOADER - AUTO UPDATE      ║
    ╚═══════════════════════════════════════╝
    )" << std::endl;
}

int main() {
    ShowBanner();
    
    std::cout << "Version: " << Config::CURRENT_VERSION << std::endl;
    std::cout << "DLL: " << Config::DLL_NAME << std::endl;
    std::cout << std::endl;
    
    // ======================================
    // FASE 1: CHECK AGGIORNAMENTI
    // ======================================
    
    AutoUpdater updater(
        Config::UPDATE_ENDPOINT,
        Config::CURRENT_VERSION,
        Config::DLL_NAME
    );
    
    std::cout << "[*] Checking for updates..." << std::endl;
    auto updateInfo = updater.checkForUpdates();
    
    if (!updateInfo.error.empty()) {
        std::cout << "[!] Update check failed: " << updateInfo.error << std::endl;
        std::cout << "[*] Continuing with local version..." << std::endl;
    }
    else if (updateInfo.updateAvailable) {
        std::cout << "\n[+] New version available!" << std::endl;
        std::cout << "    Current: " << Config::CURRENT_VERSION << std::endl;
        std::cout << "    Latest:  " << updateInfo.latestVersion << std::endl;
        
        if (!updateInfo.changelog.empty()) {
            std::cout << "\n[i] Changelog:\n" << updateInfo.changelog << std::endl;
        }
        
        if (updateInfo.forceUpdate) {
            std::cout << "\n[!] FORCE UPDATE REQUIRED" << std::endl;
        }
        
        bool shouldUpdate = updateInfo.forceUpdate;
        
        if (!updateInfo.forceUpdate) {
            std::cout << "\nUpdate now? (y/n): ";
            char choice;
            std::cin >> choice;
            shouldUpdate = (choice == 'y' || choice == 'Y');
        }
        
        if (shouldUpdate) {
            std::cout << "\n[*] Downloading update..." << std::endl;
            std::cout << "    URL: " << updateInfo.downloadUrl << std::endl;
            
            std::string tempPath = Config::DLL_NAME + ".new";
            
            if (updater.downloadUpdate(updateInfo.downloadUrl, tempPath)) {
                std::cout << "\n[+] Download completed!" << std::endl;
                std::cout << "[*] Applying update..." << std::endl;
                
                if (updater.applyUpdate(tempPath)) {
                    std::cout << "[+] Update installed successfully!" << std::endl;
                    std::cout << "    Version: " << updateInfo.latestVersion << std::endl;
                } else {
                    std::cout << "[!] Failed to apply update" << std::endl;
                    std::cout << "[*] Rolling back..." << std::endl;
                    updater.rollback();
                }
            } else {
                std::cout << "[!] Download failed" << std::endl;
            }
        } else {
            std::cout << "[*] Update skipped" << std::endl;
        }
    } else {
        std::cout << "[+] You are on the latest version!" << std::endl;
    }
    
    std::cout << "\n" << std::string(43, '=') << std::endl;
    
    // ======================================
    // FASE 2: CARICA DLL
    // ======================================
    
    std::cout << "\n[*] Loading " << Config::DLL_NAME << "..." << std::endl;
    
    HMODULE hModule = LoadLibraryA(Config::DLL_NAME.c_str());
    
    if (!hModule) {
        std::cerr << "[!] Failed to load DLL" << std::endl;
        std::cerr << "    Error code: " << GetLastError() << std::endl;
        std::cout << "\nPress Enter to exit...";
        std::cin.ignore();
        std::cin.get();
        return 1;
    }
    
    std::cout << "[+] DLL loaded successfully!" << std::endl;
    
    // ======================================
    // FASE 3: ESEGUI ENTRY POINT (opzionale)
    // ======================================
    
    // Esempio: chiama una funzione dal DLL
    typedef void (*InitFunc)();
    InitFunc initFunc = (InitFunc)GetProcAddress(hModule, "Initialize");
    
    if (initFunc) {
        std::cout << "[*] Calling Initialize()..." << std::endl;
        initFunc();
    } else {
        std::cout << "[!] Initialize() not found in DLL" << std::endl;
    }
    
    // ======================================
    // CLEANUP
    // ======================================
    
    std::cout << "\n[*] Press Enter to exit..." << std::endl;
    std::cin.ignore();
    std::cin.get();
    
    FreeLibrary(hModule);
    std::cout << "[+] Cleanup completed" << std::endl;
    
    return 0;
}
```

---

## 3️⃣ Workflow Completo

### Prima Release (V1.0)

**Dashboard:**
1. Version: `V1.0`
2. URL: `https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll`
3. Force Update: ✅

**Codice C++:**
```cpp
const std::string CURRENT_VERSION = "V1.0";
```

**Distribuzione:**
- Compila loader.exe
- Distribuisci agli utenti
- Utenti avviano loader.exe
- Download automatico di SKUZA.dll

---

### Nuova Release (V1.1)

**Dashboard:**
1. Vai su Updates
2. New Release
3. Version: `V1.1`
4. URL: `https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll`
   (o nuovo URL se hai cambiato file)
5. Changelog: `- Fixed bug XYZ\n- Added feature ABC`
6. Publish

**Codice C++ (per prossima versione loader):**
```cpp
const std::string CURRENT_VERSION = "V1.1";
```

**Utenti:**
- Avviano il VECCHIO loader.exe (V1.0)
- Sistema rileva V1.1 disponibile
- Scarica automaticamente nuovo SKUZA.dll
- Lo sostituisce
- Carica la nuova versione

---

## 4️⃣ Test Immediato

### Test 1: Verifica endpoint API

Apri il browser o PowerShell:

```powershell
# PowerShell
$appId = "TUO_APP_ID_QUI"
$url = "https://wncowlnkfjvmdhvtfxhz.supabase.co/functions/v1/latest-version?app_id=$appId"
Invoke-RestMethod -Uri $url
```

**Output atteso:**
```json
{
  "version": "V1.0",
  "download_url": "https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll",
  "changelog": "Initial release",
  "force_update": true,
  "released_at": "2026-08-02T..."
}
```

### Test 2: Download manuale DLL

```powershell
# PowerShell - scarica il DLL
Invoke-WebRequest -Uri "https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll" -OutFile "SKUZA.dll"

# Verifica dimensione
Get-Item SKUZA.dll | Select-Object Length
```

### Test 3: Loader in modalità debug

Nel tuo `main.cpp`, aggiungi:

```cpp
#define DEBUG_MODE  // Decomenta per debug

#ifdef DEBUG_MODE
    std::cout << "[DEBUG] API Endpoint: " << Config::UPDATE_ENDPOINT << std::endl;
    std::cout << "[DEBUG] Current Version: " << Config::CURRENT_VERSION << std::endl;
    std::cout << "[DEBUG] DLL Path: " << Config::DLL_NAME << std::endl;
#endif
```

---

## 5️⃣ Checklist Pre-Release

Ogni volta che rilasci una nuova versione:

- [ ] Hai compilato il nuovo SKUZA.dll?
- [ ] Hai caricato su GitHub/server?
- [ ] URL è raggiungibile? (test con browser)
- [ ] Hai creato release nella dashboard?
- [ ] Version string corrisponde al codice C++?
- [ ] Hai testato il download?
- [ ] Changelog è chiaro?
- [ ] Force Update impostato correttamente?

---

## 6️⃣ Troubleshooting

### ❌ "No version found for this app"

```
Causa: APP_ID errato nel codice C++
Fix: Copia APP_ID dalla dashboard → Applications
```

### ❌ "Download failed" / "HTTP 404"

```
Causa: URL GitHub non raggiungibile
Fix: Verifica che il file esista:
https://github.com/wg27b8s8kn-spec/ZIT/blob/main/SKUZA.dll
```

### ❌ "Failed to load DLL"

```
Causa: DLL corrotto o dipendenze mancanti
Fix: 
1. Testa il DLL manualmente
2. Verifica con Dependency Walker
3. Controlla Visual C++ Redistributables
```

### ❌ "Update check failed: Connection timeout"

```
Causa: Firewall o assenza connessione internet
Fix: Aggiungi modalità offline-first (usa cache locale)
```

---

## 7️⃣ Prossimi Passi

1. **Compila il loader**
   ```bash
   mkdir build
   cd build
   cmake ..
   cmake --build . --config Release
   ```

2. **Testa localmente**
   - Esegui `loader.exe`
   - Verifica download SKUZA.dll
   - Verifica caricamento

3. **Crea APP_ID nella dashboard**
   - Applications → New Application
   - Copia APP_ID

4. **Crea prima release**
   - Updates → New Release
   - Version: V1.0
   - URL: GitHub raw link
   - Force Update: ON

5. **Aggiorna `config.hpp`**
   ```cpp
   const std::string APP_ID = "il-tuo-app-id-copiato";
   ```

6. **Ricompila e distribuisci**
   ```bash
   cmake --build . --config Release
   ```

7. **Testa end-to-end**
   - Avvia loader.exe
   - Verifica scaricamento automatico
   - Verifica caricamento DLL

---

## 📞 Supporto

- Dashboard: https://tuoprogetto.vercel.app
- GitHub: https://github.com/newaccbroken6-ops/SUPER-auth
- Docs: CPP_AUTO_UPDATE.md

---

## 🎯 Esempio Output Loader

```
    ╔═══════════════════════════════════════╗
    ║       SKUZA LOADER - AUTO UPDATE      ║
    ╚═══════════════════════════════════════╝

Version: V1.0
DLL: SKUZA.dll

[*] Checking for updates...
[+] New version available!
    Current: V1.0
    Latest:  V1.1

[i] Changelog:
- Fixed rendering bug
- Added new features

[!] FORCE UPDATE REQUIRED

[*] Downloading update...
    URL: https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll
Download progress: 100%

[+] Download completed!
[*] Applying update...
[+] Update installed successfully!
    Version: V1.1

===========================================

[*] Loading SKUZA.dll...
[+] DLL loaded successfully!
[*] Calling Initialize()...

[*] Press Enter to exit...
```
