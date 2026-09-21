# Sistema Auto-Update per Loader C++

Guida completa per implementare gli aggiornamenti automatici del DLL nel tuo loader C++.

## Indice
- [Come Funziona](#come-funziona)
- [Setup Dashboard](#setup-dashboard)
- [Implementazione C++ Completa](#implementazione-c-completa)
- [Test e Debug](#test-e-debug)
- [Best Practices](#best-practices)

---

## Come Funziona

```
1. Loader si avvia
2. Controlla versione locale vs versione remota
3. Se diversa → Scarica nuovo DLL
4. Sostituisce il vecchio DLL
5. Carica il nuovo DLL in memoria
```

---

## Setup Dashboard

### 1. Crea un'applicazione

Vai su: **https://tuoprogetto.vercel.app/applications**

- Clicca **New Application**
- Nome: `My Game Loader`
- Descrizione: `Main loader for the game`
- Versione: `1.0.0`
- Salva e copia l'**APP_ID**

### 2. Aggiungi una release

Vai su: **https://tuoprogetto.vercel.app/updates**

- Seleziona la tua app
- Clicca **New Release**
- Version String: `V1.0` (deve corrispondere al tuo codice C++)
- Download URL: `https://tuo-server.com/update/loader.dll`
- Changelog: `Initial release`
- Force Update: ✅ (consigliato)
- Clicca **Publish Release**

### 3. Ottieni l'Endpoint API

Dopo aver creato la release, copia l'endpoint mostrato:
```
https://wncowlnkfjvmdhvtfxhz.supabase.co/functions/v1/latest-version?app_id=TUO_APP_ID
```

---

## Implementazione C++ Completa

### File: `auto_updater.hpp`

```cpp
#pragma once

#include <string>
#include <fstream>
#include <iostream>
#include <filesystem>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

namespace fs = std::filesystem;
using json = nlohmann::json;

class AutoUpdater {
private:
    std::string apiUrl;
    std::string currentVersion;
    std::string dllPath;
    
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        ((std::string*)userp)->append((char*)contents, size * nmemb);
        return size * nmemb;
    }
    
    static size_t WriteFileCallback(void* ptr, size_t size, size_t nmemb, FILE* stream) {
        return fwrite(ptr, size, nmemb, stream);
    }

public:
    struct UpdateInfo {
        bool updateAvailable;
        bool forceUpdate;
        std::string latestVersion;
        std::string downloadUrl;
        std::string changelog;
        std::string error;
    };
    
    AutoUpdater(const std::string& api_url, const std::string& current_ver, const std::string& dll_path)
        : apiUrl(api_url), currentVersion(current_ver), dllPath(dll_path) {
        curl_global_init(CURL_GLOBAL_ALL);
    }
    
    ~AutoUpdater() {
        curl_global_cleanup();
    }
    
    // Controlla aggiornamenti disponibili
    UpdateInfo checkForUpdates() {
        UpdateInfo info;
        info.updateAvailable = false;
        info.forceUpdate = false;
        
        CURL* curl = curl_easy_init();
        if (!curl) {
            info.error = "Failed to initialize CURL";
            return info;
        }
        
        std::string readBuffer;
        
        curl_easy_setopt(curl, CURLOPT_URL, apiUrl.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
        
        CURLcode res = curl_easy_perform(curl);
        long httpCode = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &httpCode);
        curl_easy_cleanup(curl);
        
        if (res != CURLE_OK) {
            info.error = "HTTP request failed: " + std::string(curl_easy_strerror(res));
            return info;
        }
        
        if (httpCode != 200) {
            info.error = "Server returned status " + std::to_string(httpCode);
            return info;
        }
        
        try {
            auto j = json::parse(readBuffer);
            
            info.latestVersion = j.value("version", "");
            info.downloadUrl = j.value("download_url", "");
            info.changelog = j.value("changelog", "");
            info.forceUpdate = j.value("force_update", false);
            
            // Confronta versioni
            if (info.latestVersion != currentVersion) {
                info.updateAvailable = true;
            }
            
        } catch (const json::parse_error& e) {
            info.error = "Failed to parse response: " + std::string(e.what());
        }
        
        return info;
    }
    
    // Scarica il nuovo DLL
    bool downloadUpdate(const std::string& url, const std::string& outputPath) {
        CURL* curl = curl_easy_init();
        if (!curl) return false;
        
        FILE* fp = fopen(outputPath.c_str(), "wb");
        if (!fp) {
            curl_easy_cleanup(curl);
            return false;
        }
        
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteFileCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, fp);
        curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 120L);
        curl_easy_setopt(curl, CURLOPT_NOPROGRESS, 0L);
        curl_easy_setopt(curl, CURLOPT_PROGRESSFUNCTION, ProgressCallback);
        
        CURLcode res = curl_easy_perform(curl);
        
        fclose(fp);
        curl_easy_cleanup(curl);
        
        return (res == CURLE_OK);
    }
    
    // Callback per mostrare progresso download
    static int ProgressCallback(void* clientp, double dltotal, double dlnow, double ultotal, double ulnow) {
        if (dltotal > 0) {
            int progress = (int)((dlnow / dltotal) * 100.0);
            std::cout << "\rDownload progress: " << progress << "%" << std::flush;
        }
        return 0;
    }
    
    // Applica l'aggiornamento (sostituisci DLL)
    bool applyUpdate(const std::string& newDllPath) {
        try {
            // Backup del vecchio DLL
            std::string backupPath = dllPath + ".backup";
            if (fs::exists(dllPath)) {
                fs::copy_file(dllPath, backupPath, fs::copy_options::overwrite_existing);
            }
            
            // Sostituisci con il nuovo
            fs::copy_file(newDllPath, dllPath, fs::copy_options::overwrite_existing);
            
            // Rimuovi il file temporaneo
            fs::remove(newDllPath);
            
            std::cout << "\n✅ Update applied successfully!" << std::endl;
            return true;
            
        } catch (const fs::filesystem_error& e) {
            std::cerr << "❌ Failed to apply update: " << e.what() << std::endl;
            return false;
        }
    }
    
    // Rollback in caso di errore
    bool rollback() {
        try {
            std::string backupPath = dllPath + ".backup";
            if (fs::exists(backupPath)) {
                fs::copy_file(backupPath, dllPath, fs::copy_options::overwrite_existing);
                std::cout << "✅ Rollback completed" << std::endl;
                return true;
            }
            return false;
        } catch (const fs::filesystem_error& e) {
            std::cerr << "❌ Rollback failed: " << e.what() << std::endl;
            return false;
        }
    }
};
```

---

## Esempio di Utilizzo nel Loader

### File: `main.cpp`

```cpp
#include "auto_updater.hpp"
#include <windows.h>
#include <iostream>

// ====== CONFIGURAZIONE ======
const std::string SUPABASE_URL = "https://wncowlnkfjvmdhvtfxhz.supabase.co";
const std::string APP_ID = "uuid-tua-applicazione";  // Dalla dashboard
const std::string CURRENT_VERSION = "V1.0";          // Aggiorna ad ogni release
const std::string DLL_PATH = "game_module.dll";

// Endpoint API
const std::string UPDATE_ENDPOINT = SUPABASE_URL + "/functions/v1/latest-version?app_id=" + APP_ID;

int main() {
    std::cout << "==================================" << std::endl;
    std::cout << "   GAME LOADER - AUTO UPDATE" << std::endl;
    std::cout << "==================================" << std::endl;
    std::cout << "Current Version: " << CURRENT_VERSION << std::endl;
    std::cout << std::endl;
    
    // 1. Inizializza updater
    AutoUpdater updater(UPDATE_ENDPOINT, CURRENT_VERSION, DLL_PATH);
    
    // 2. Controlla aggiornamenti
    std::cout << "🔍 Checking for updates..." << std::endl;
    auto updateInfo = updater.checkForUpdates();
    
    if (!updateInfo.error.empty()) {
        std::cerr << "⚠️  Update check failed: " << updateInfo.error << std::endl;
        std::cerr << "Continuing with current version..." << std::endl;
        // Continua comunque se il DLL esiste
    }
    else if (updateInfo.updateAvailable) {
        std::cout << "\n📦 New version available!" << std::endl;
        std::cout << "Latest Version: " << updateInfo.latestVersion << std::endl;
        
        if (!updateInfo.changelog.empty()) {
            std::cout << "\nChangelog:" << std::endl;
            std::cout << updateInfo.changelog << std::endl;
        }
        
        // Force update o chiedi conferma
        bool shouldUpdate = updateInfo.forceUpdate;
        
        if (!updateInfo.forceUpdate) {
            std::cout << "\nDo you want to update? (y/n): ";
            char choice;
            std::cin >> choice;
            shouldUpdate = (choice == 'y' || choice == 'Y');
        } else {
            std::cout << "\n⚠️  FORCE UPDATE REQUIRED" << std::endl;
        }
        
        if (shouldUpdate) {
            std::cout << "\n📥 Downloading update..." << std::endl;
            
            std::string tempDllPath = DLL_PATH + ".new";
            
            if (updater.downloadUpdate(updateInfo.downloadUrl, tempDllPath)) {
                std::cout << "\n✅ Download completed!" << std::endl;
                std::cout << "📝 Applying update..." << std::endl;
                
                if (updater.applyUpdate(tempDllPath)) {
                    std::cout << "✅ Update successfully installed!" << std::endl;
                    std::cout << "Version: " << updateInfo.latestVersion << std::endl;
                } else {
                    std::cerr << "❌ Failed to apply update. Rolling back..." << std::endl;
                    updater.rollback();
                }
            } else {
                std::cerr << "❌ Failed to download update." << std::endl;
            }
        }
    } else {
        std::cout << "✅ You are on the latest version!" << std::endl;
    }
    
    std::cout << "\n==================================" << std::endl;
    
    // 3. Carica il DLL
    std::cout << "\n🚀 Loading module..." << std::endl;
    
    HMODULE hModule = LoadLibraryA(DLL_PATH.c_str());
    if (!hModule) {
        std::cerr << "❌ Failed to load DLL: " << DLL_PATH << std::endl;
        std::cerr << "Error code: " << GetLastError() << std::endl;
        std::cin.get();
        return 1;
    }
    
    std::cout << "✅ Module loaded successfully!" << std::endl;
    
    // 4. Trova la funzione di entry point (esempio)
    typedef void (*InitFunc)();
    InitFunc initFunc = (InitFunc)GetProcAddress(hModule, "Initialize");
    
    if (initFunc) {
        std::cout << "🎮 Starting game..." << std::endl;
        initFunc();
    } else {
        std::cerr << "❌ Entry point not found in DLL" << std::endl;
    }
    
    // Cleanup
    std::cout << "\nPress Enter to exit..." << std::endl;
    std::cin.get();
    
    FreeLibrary(hModule);
    
    return 0;
}
```

---

## Test e Debug

### 1. Test Endpoint Manuale

Apri il browser o usa `curl`:

```bash
curl "https://wncowlnkfjvmdhvtfxhz.supabase.co/functions/v1/latest-version?app_id=TUO_APP_ID"
```

**Risposta attesa:**
```json
{
  "version": "V1.0",
  "download_url": "https://tuo-server.com/update/loader.dll",
  "changelog": "Initial release",
  "force_update": true,
  "released_at": "2026-08-02T12:00:00Z"
}
```

### 2. Test Versioning

Nel tuo codice C++:
```cpp
// Versione locale
const std::string CURRENT_VERSION = "V1.0";

// Se server ha "V1.1" → update disponibile
// Se server ha "V1.0" → nessun update
```

### 3. Test Download

Testa che il DLL si scarichi correttamente:
```cpp
AutoUpdater updater(UPDATE_ENDPOINT, "V0.0", "test.dll");
auto info = updater.checkForUpdates();
if (info.updateAvailable) {
    updater.downloadUpdate(info.downloadUrl, "test_download.dll");
}
```

---

## Best Practices

### 1. Hosting del DLL

**Opzioni consigliate:**

- **GitHub Releases** (gratis)
  ```
  https://github.com/tuo-user/tuo-repo/releases/download/v1.0/loader.dll
  ```

- **GitHub Raw** (per file singoli)
  ```
  https://github.com/wg27b8s8kn-spec/ZIT/raw/refs/heads/main/SKUZA.dll
  ```

- **Dropbox** (con link diretto)
  ```
  https://www.dropbox.com/s/ABC123/loader.dll?dl=1
  ```

- **Server proprio**
  ```
  https://tuo-server.com/updates/loader.dll
  ```

- **Cloudflare R2** (economico per file grandi)

### 2. Versioning Scheme

```cpp
// Buoni esempi:
"V1.0"
"V1.1"
"V2.0"

// Da evitare (non string-confrontabili facilmente):
"1.0.0"
"v1.0"
```

### 3. Backup Automatico

```cpp
// Prima di ogni aggiornamento
std::string backupPath = dllPath + ".backup";
fs::copy_file(dllPath, backupPath, fs::copy_options::overwrite_existing);
```

### 4. Verifica Integrità (SHA256)

```cpp
#include <openssl/sha.h>

std::string calculateSHA256(const std::string& filePath) {
    std::ifstream file(filePath, std::ios::binary);
    SHA256_CTX context;
    SHA256_Init(&context);
    
    char buffer[4096];
    while (file.read(buffer, sizeof(buffer))) {
        SHA256_Update(&context, buffer, file.gcount());
    }
    
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256_Final(hash, &context);
    
    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    return ss.str();
}

// Uso:
// Aggiungi "sha256" nel JSON response della dashboard
// Confronta dopo il download prima di applicare
```

### 5. Gestione Errori

```cpp
// Modalità offline-first
if (!updateInfo.error.empty()) {
    // Log l'errore ma continua
    if (fs::exists(DLL_PATH)) {
        // Usa versione locale
        std::cout << "⚠️  Update check failed, using cached version" << std::endl;
    } else {
        // Errore critico
        std::cerr << "❌ No DLL found and update check failed" << std::endl;
        return 1;
    }
}
```

### 6. UI Progresso (Console)

```cpp
void ShowProgressBar(double progress) {
    int barWidth = 50;
    std::cout << "[";
    int pos = barWidth * progress;
    for (int i = 0; i < barWidth; ++i) {
        if (i < pos) std::cout << "=";
        else if (i == pos) std::cout << ">";
        else std::cout << " ";
    }
    std::cout << "] " << int(progress * 100.0) << "%\r";
    std::cout.flush();
}
```

---

## Troubleshooting

### Problema: "No version found for this app"

**Causa:** APP_ID errato o nessuna release pubblicata

**Soluzione:**
1. Vai su dashboard → Applications
2. Copia l'APP_ID corretto
3. Vai su Updates e pubblica una release

### Problema: Download fallisce

**Causa:** URL non raggiungibile o HTTPS certificate issue

**Soluzione:**
```cpp
// Per debug (NON in produzione):
curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
```

### Problema: DLL non si carica dopo update

**Causa:** DLL corrotto o incompatibile

**Soluzione:**
```cpp
// Rollback automatico
if (!LoadLibraryA(DLL_PATH.c_str())) {
    std::cerr << "DLL corrupted, rolling back..." << std::endl;
    updater.rollback();
    LoadLibraryA(DLL_PATH.c_str());
}
```

---

## CMake Configuration

```cmake
cmake_minimum_required(VERSION 3.10)
project(GameLoader)

set(CMAKE_CXX_STANDARD 17)

# Find packages
find_package(CURL REQUIRED)
find_package(nlohmann_json REQUIRED)
find_package(OpenSSL REQUIRED)  # Per SHA256

add_executable(loader
    main.cpp
    auto_updater.hpp
)

target_link_libraries(loader
    CURL::libcurl
    nlohmann_json::nlohmann_json
    OpenSSL::SSL
    OpenSSL::Crypto
)

# Windows specific
if(WIN32)
    target_link_libraries(loader ws2_32)
endif()
```

---

## Workflow Completo

```
1. Sviluppo
   - Modifica il tuo DLL
   - Incrementa CURRENT_VERSION nel loader
   - Compila entrambi

2. Release
   - Carica DLL su server/GitHub
   - Copia URL pubblico del DLL
   - Vai su dashboard → Updates
   - Crea nuova release con:
     * Version String = CURRENT_VERSION
     * Download URL = URL del DLL
     * Force Update = true (se breaking changes)

3. Deploy
   - Distribuisci il nuovo LOADER.exe agli utenti
   - Il loader scaricherà automaticamente il DLL aggiornato

4. Utenti
   - Avviano loader.exe
   - Sistema controlla aggiornamenti
   - Scarica e applica automaticamente
   - Carica il DLL aggiornato
```

---

## Supporto

- Dashboard: https://tuoprogetto.vercel.app/updates
- API Docs: https://supabase.com/docs
- GitHub: https://github.com/newaccbroken6-ops/SUPER-auth
