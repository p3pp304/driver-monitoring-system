# Driver Monitoring System (DMS) v2.0 - Edge AI & V2N Architecture

Questo repository contiene il prototipo software di un **Driver Monitoring System (DMS)** sviluppato come progetto di tesi in Ingegneria Informatica (Politecnico di Bari, A.A. 2025/2026). 

Il sistema implementa un'architettura ibrida basata su **Edge AI** nel frontend per l'elaborazione dei flussi video in tempo reale e una rete **V2N (Vehicle-to-Network)** asincrona via **WebSocket** connessa a un backend analitico in **FastAPI**. Il sistema è interamente containerizzato tramite **Docker** e **Docker Compose**.

---

## 🏗️ Architettura del Sistema

Il sistema è suddiviso in due macro-servizi isolati che comunicano in modo bidirezionale e asincrono:

1. **Frontend (HMI - Human-Machine Interface):** * Sviluppato in **React** sfruttando **Vite** come build-tool di nuova generazione.
   * Esegue algoritmi di **Computer Vision** locali direttamente nel browser tramite i modelli pre-addestrati di **MediaPipe (Face Mesh)** per calcolare l'**Eye Aspect Ratio (EAR)** del conducente.
   * Acquisisce la telemetria di posizionamento tramite le API di geolocalizzazione hardware native.
2. **Backend (Cervello Analitico):**
   * Sviluppato in **FastAPI** (Python) per garantire prestazioni asincrone ad alto rendimento.
   * Integra modelli di **Generative AI (Gemini API)** per elaborare feedback proattivi e personalizzati di assistenza alla guida in base allo stato del viaggio e del conducente.

---

## 📁 Struttura del Progetto

```text
├── backend/                  # Server FastAPI (Python)
│   ├── app/                  # Logica applicativa e gestione WebSocket
│   ├── .env                  # Variabili d'ambiente (API Keys)
│   └── Dockerfile            # Configurazione del container Python
├── frontend/                 # Interfaccia HMI (React + Vite)
│   ├── src/
│   │   ├── components/       # Componenti dell'interfaccia (VideoMonitoRAlertPanels...)
│   │   ├── hooks/            # Custom hooks isolati (useMediaPipe, useGeolocation...)
│   │   ├── utils/
│   │   │   ├── constant.js   # Centralizzazione degli stati (FSM) e costanti algoritmiche
│   │   │   └── helpers.js    # Utilità matematiche (Calcolo EAR e sintesi vocale)
│   │   └── main.js           # Entry-point dell'applicazione
│   │   index.html            # Scheletro HTML5 d'ancoraggio per il Virtual DOM
│   │   vite.config.js        # Configurazione di rete e polling per Docker
│   ├── package.json          # Manifesto delle dipendenze e script NPM
│   └── Dockerfile            # Configurazione del container Node.js (slim)
└── docker-compose.yml        # Orchestratore multinodo dell'infrastruttura