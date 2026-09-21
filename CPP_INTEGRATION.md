# Integrazione SUPER License System in C++

Questa guida mostra come integrare il sistema di licenze SUPER nel tuo progetto C++.

## Indice
- [Prerequisiti](#prerequisiti)
- [Endpoint API](#endpoint-api)
- [Esempio Completo C++](#esempio-completo-c)
- [Ottenere HWID](#ottenere-hwid)
- [Gestione Risposte](#gestione-risposte)
- [Best Practices](#best-practices)

---

## Prerequisiti

### Librerie Necessarie
Per le richieste HTTP hai diverse opzioni:

1. **cURL** (consigliato)
   ```bash
   # Windows (vcpkg)
   vcpkg install curl
   
   # Linux
   sudo apt-get install libcurl4-openssl-dev
   ```

2. **WinHTTP** (solo Windows, built-in)

3. **cpp-httplib** (header-only)
   ```bash
   # Scarica header singolo
   # https://github.com/yhirose/cpp-httplib
   ```

### JSON Library
```bash
# nlohmann/json (header-only)
# https://github.com/nlohmann/json
```

---

## Endpoint API

### Validazione Licenza
```
POST https://TUO-PROGETTO.supabase.co/functions/v1/validate-license
```

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "app_id": "uuid-della-tua-app",
  "hwid": "identificativo-hardware"
}
```

**Response:**
```json
// Successo
{
  "valid": true,
  "message": "License is valid",
  "license_type": "monthly",
  "expires_at": "2026-09-02T00:00:00Z"
}

// Errore
{
  "valid": false,
  "message": "Invalid license key"
}
```

---

## Esempio Completo C++

### File: `license_validator.hpp`

```cpp
#pragma once

#include <string>
#include <iostream>
#include <fstream>
#include <sstream>
#include <memory>

// Include cURL
#ifdef _WIN32
    #include <winsock2.h>
    #include <windows.h>
#endif
#include <curl/curl.h>

// Include nlohmann/json
#include <nlohmann/json.hpp>

using json = nlohmann::json;

class LicenseValidator {
private:
    std::string supabaseUrl;
    std::string appId;
    
    // Callback per cURL
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        ((std::string*)userp)->append((char*)contents, size * nmemb);
        return size * nmemb;
    }

public:
    LicenseValidator(const std::string& url, const std::string& app_id)
        : supabaseUrl(url), appId(app_id) {
        curl_global_init(CURL_GLOBAL_ALL);
    }
    
    ~LicenseValidator() {
        curl_global_cleanup();
    }
    
    // Ottieni HWID (Windows)
    #ifdef _WIN32
    std::string getHWID() {
        DWORD serialNumber;
        if (GetVolumeInformationA("C:\\", nullptr, 0, &serialNumber, nullptr, nullptr, nullptr, 0)) {
            std::stringstream ss;
            ss << std::hex << serialNumber;
            return "WIN-" + ss.str();
        }
        return "UNKNOWN";
    }
    #endif
    
    // Ottieni HWID (Linux)
    #ifdef __linux__
    std::string getHWID() {
        std::ifstream file("/etc/machine-id");
        std::string machineId;
        if (file.is_open()) {
            std::getline(file, machineId);
            file.close();
            return "LINUX-" + machineId.substr(0, 16);
        }
        return "UNKNOWN";
    }
    #endif
    
    // Validazione licenza
    struct LicenseResult {
        bool valid;
        std::string message;
        std::string licenseType;
        std::string expiresAt;
    };
    
    LicenseResult validate(const std::string& licenseKey, bool sendHwid = true) {
        LicenseResult result;
        result.valid = false;
        
        CURL* curl = curl_easy_init();
        if (!curl) {
            result.message = "Failed to initialize CURL";
            return result;
        }
        
        // Prepara JSON body
        json bodyJson;
        bodyJson["license_key"] = licenseKey;
        bodyJson["app_id"] = appId;
        if (sendHwid) {
            bodyJson["hwid"] = getHWID();
        }
        std::string bodyStr = bodyJson.dump();
        
        // URL completo
        std::string fullUrl = supabaseUrl + "/functions/v1/validate-license";
        
        // Configura headers
        struct curl_slist* headers = nullptr;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        
        // Response buffer
        std::string readBuffer;
        
        // Configura richiesta
        curl_easy_setopt(curl, CURLOPT_URL, fullUrl.c_str());
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bodyStr.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &readBuffer);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        
        // Esegui richiesta
        CURLcode res = curl_easy_perform(curl);
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        
        if (res != CURLE_OK) {
            result.message = "HTTP request failed: " + std::string(curl_easy_strerror(res));
            return result;
        }
        
        // Parse risposta JSON
        try {
            auto responseJson = json::parse(readBuffer);
            result.valid = responseJson.value("valid", false);
            result.message = responseJson.value("message", "Unknown response");
            
            if (result.valid) {
                result.licenseType = responseJson.value("license_type", "");
                result.expiresAt = responseJson.value("expires_at", "");
            }
        } catch (const json::parse_error& e) {
            result.message = "Failed to parse response: " + std::string(e.what());
        }
        
        return result;
    }
};
```

---

## Esempio di Utilizzo

### File: `main.cpp`

```cpp
#include "license_validator.hpp"
#include <iostream>

// CONFIGURAZIONE
const std::string SUPABASE_URL = "https://tuoprogetto.supabase.co";
const std::string APP_ID = "uuid-della-tua-applicazione";

int main() {
    // Inizializza validator
    LicenseValidator validator(SUPABASE_URL, APP_ID);
    
    // Input licenza dall'utente
    std::string licenseKey;
    std::cout << "Inserisci la tua chiave di licenza: ";
    std::cin >> licenseKey;
    
    // Valida licenza
    std::cout << "\nValidazione in corso..." << std::endl;
    std::cout << "HWID: " << validator.getHWID() << std::endl;
    
    auto result = validator.validate(licenseKey);
    
    if (result.valid) {
        std::cout << "\n✅ Licenza valida!" << std::endl;
        std::cout << "Tipo: " << result.licenseType << std::endl;
        std::cout << "Scadenza: " << result.expiresAt << std::endl;
        
        // Continua con il programma...
        std::cout << "\nAvvio applicazione..." << std::endl;
        // ... tuo codice ...
        
    } else {
        std::cout << "\n❌ Licenza non valida: " << result.message << std::endl;
        std::cout << "Contatta il supporto per assistenza." << std::endl;
        std::cin.get(); // Pausa
        return 1;
    }
    
    return 0;
}
```

---

## Ottenere HWID

### Windows - Alternativa con più info

```cpp
#ifdef _WIN32
#include <windows.h>
#include <comdef.h>
#include <Wbemidl.h>
#pragma comment(lib, "wbemuuid.lib")

std::string getDetailedHWID() {
    std::string hwid = "WIN-";
    
    // Metodo 1: Serial Number Volume C:
    DWORD serial;
    if (GetVolumeInformationA("C:\\", nullptr, 0, &serial, nullptr, nullptr, nullptr, 0)) {
        hwid += std::to_string(serial) + "-";
    }
    
    // Metodo 2: Computer Name
    char computerName[MAX_COMPUTERNAME_LENGTH + 1];
    DWORD size = sizeof(computerName);
    if (GetComputerNameA(computerName, &size)) {
        hwid += computerName;
    }
    
    return hwid;
}
#endif
```

### Cross-platform con CPU ID

```cpp
#include <array>
#include <cstdint>
#include <cstring>

std::string getCpuId() {
    uint32_t regs[4] = {0};
    
    #ifdef _WIN32
    __cpuid((int*)regs, 1);
    #else
    asm volatile("cpuid" : "=a"(regs[0]), "=b"(regs[1]), "=c"(regs[2]), "=d"(regs[3]) : "a"(1));
    #endif
    
    char cpuId[32];
    snprintf(cpuId, sizeof(cpuId), "CPU-%08X", regs[0]);
    return std::string(cpuId);
}
```

---

## Gestione Risposte

### Codici di Errore

| Messaggio | Descrizione |
|-----------|-------------|
| `License is valid` | Licenza attiva e funzionante |
| `Invalid license key` | Chiave non trovata nel database |
| `License has expired` | Licenza scaduta |
| `License is suspended` | Licenza sospesa dall'amministratore |
| `License is banned` | Licenza bannata |
| `HWID mismatch` | HWID diverso dal device registrato |
| `Rate limit exceeded` | Troppe richieste (max 10/min per IP) |
| `Missing license_key or app_id` | Parametri mancanti |

### Esempio Gestione Errori

```cpp
void handleLicenseResult(const LicenseResult& result) {
    if (result.valid) {
        // Licenza OK
        return;
    }
    
    // Gestione errori specifici
    if (result.message.find("expired") != std::string::npos) {
        std::cout << "La tua licenza è scaduta. Rinnova su: tuosito.com/renew" << std::endl;
    }
    else if (result.message.find("HWID") != std::string::npos) {
        std::cout << "Questa licenza è registrata su un altro dispositivo." << std::endl;
        std::cout << "Richiedi un reset HWID su: tuosito.com/reset-hwid" << std::endl;
    }
    else if (result.message.find("banned") != std::string::npos) {
        std::cout << "Licenza bannata. Contatta il supporto." << std::endl;
    }
    else {
        std::cout << "Licenza non valida: " << result.message << std::endl;
    }
}
```

---

## Best Practices

### 1. Salva la licenza localmente

```cpp
// Salva dopo prima validazione riuscita
void saveLicense(const std::string& key, const std::string& path = "license.dat") {
    std::ofstream file(path);
    file << key;
    file.close();
}

// Carica all'avvio
std::string loadLicense(const std::string& path = "license.dat") {
    std::ifstream file(path);
    std::string key;
    if (file.is_open()) {
        std::getline(file, key);
        file.close();
    }
    return key;
}
```

### 2. Cache della validazione

```cpp
bool isCachedValid() {
    // Leggi da cache locale con timestamp
    // Non fare richieste HTTP ogni avvio
    // Esempio: cache valida per 24 ore
    return false; // Implementare
}

void cacheValidation(bool valid) {
    // Salva risultato con timestamp
}
```

### 3. Protezione anti-tampering

```cpp
// Cripta la licenza salvata
std::string encryptLicense(const std::string& key) {
    // Implementa XOR cipher o AES
    std::string encrypted = key;
    const char key_xor[] = "YOUR_SECRET_KEY";
    for (size_t i = 0; i < key.length(); i++) {
        encrypted[i] ^= key_xor[i % sizeof(key_xor)];
    }
    return encrypted;
}

std::string decryptLicense(const std::string& encrypted) {
    // XOR è simmetrico
    return encryptLicense(encrypted);
}
```

### 4. Validazione all'avvio

```cpp
int main() {
    // Nascondi console per release (Windows)
    #ifdef _WIN32
    // ShowWindow(GetConsoleWindow(), SW_HIDE);
    #endif
    
    LicenseValidator validator(SUPABASE_URL, APP_ID);
    
    // Carica licenza salvata
    std::string licenseKey = loadLicense();
    
    if (licenseKey.empty()) {
        std::cout << "Nessuna licenza trovata." << std::endl;
        std::cout << "Inserisci la tua chiave: ";
        std::cin >> licenseKey;
    }
    
    // Controlla cache prima di validare online
    if (isCachedValid()) {
        std::cout << "Avvio (validazione cached)..." << std::endl;
        // Avvia applicazione
        return 0;
    }
    
    // Valida online
    auto result = validator.validate(licenseKey);
    
    if (result.valid) {
        saveLicense(licenseKey);
        cacheValidation(true);
        std::cout << "Licenza verificata!" << std::endl;
        // Avvia applicazione
    } else {
        handleLicenseResult(result);
        return 1;
    }
    
    return 0;
}
```

---

## Compilazione

### Con CMake

```cmake
cmake_minimum_required(VERSION 3.10)
project(MyApp)

set(CMAKE_CXX_STANDARD 17)

# Trova cURL
find_package(CURL REQUIRED)

# Trova nlohmann_json
find_package(nlohmann_json REQUIRED)

add_executable(myapp
    main.cpp
)

target_link_libraries(myapp
    CURL::libcurl
    nlohmann_json::nlohmann_json
)

# Windows specific
if(WIN32)
    target_link_libraries(myapp wininet)
endif()
```

### Compilazione diretta

```bash
# Linux
g++ -std=c++17 main.cpp -o myapp -lcurl

# Windows (MSVC)
cl main.cpp /I"path/to/curl/include" /link libcurl.lib

# Windows (MinGW)
g++ -std=c++17 main.cpp -o myapp.exe -lcurl
```

---

## Struttura Progetto Consigliata

```
tuo-progetto/
├── src/
│   ├── main.cpp
│   ├── license/
│   │   ├── license_validator.hpp
│   │   ├── license_validator.cpp
│   │   └── hwid.hpp
│   └── utils/
│       ├── crypto.hpp
│       └── config.hpp
├── include/
│   └── nlohmann/json.hpp
├── lib/
│   └── curl/
├── CMakeLists.txt
└── README.md
```

---

## Domande Frequenti

**Q: Posso usare questa integrazione in un progetto commerciale?**
A: Sì, il sistema è progettato per uso commerciale.

**Q: Cosa succede se il server è offline?**
A: Implementa una cache locale con validità temporanea (es. 7 giorni) per permettere l'uso offline.

**Q: Come gestisco gli aggiornamenti del software?**
A: Controlla `license_type` nella risposta per funzionalità premium vs base.

**Q: L'HWID è sicuro?**
A: È un deterrente base. Per protezione avanzata, implementa controlli multipli e offusca il codice.

---

## Supporto

- Dashboard: `https://tuoprogetto.vercel.app`
- API Docs: `https://supabase.com/docs`
- GitHub: `https://github.com/newaccbroken6-ops/SUPER-auth`
