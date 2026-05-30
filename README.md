# Driver Monitoring System (DMS) v2.0 - Edge Computing & V2N Architecture

Questa repository contiene il prototipo software di un **Driver Monitoring System (DMS)** sviluppato come progetto di tesi in Ingegneria Informatica e dell'Automazione (Politecnico di Bari, A.A. 2025/2026). 

Il sistema implementa un'architettura ibrida basata su **Edge Computing** nel frontend per l'elaborazione dei flussi video in tempo reale e una rete **V2N (Vehicle-to-Network)** asincrona via **WebSocket** connessa a un backend in **FastAPI**. Il sistema è interamente containerizzato tramite **Docker** attraverso due Dockerfile(frontend e backend) e un **Docker Compose**.

---

## 🏗️ Architettura del Sistema

Il sistema è suddiviso in due macro-servizi isolati che comunicano in modo bidirezionale e asincrono tramite protocollo **WebSocket**:

1. **Frontend (Edge Computing & HMI):**
   * Sviluppato in **React** sfruttando **Vite** come build-tool per garantire alte prestazioni nel rendering dell'interfaccia
   * Esegue algoritmi di **Computer Vision** in locale (**Edge Computing**) tramite i modelli di Deep Learning pre-addestrati di **MediaPipe (Face Mesh)** per calcolare l'**Eye Aspect Ratio (EAR)** del conducente.
   * Acquisisce le coordinate spaziali del conducente tramite le API hardware di **Geolocalizzazione** native del browser.
   * Invia al server un pacchetto contenente stato di sonnolenza e coordinate GPS *esclusivamente* quando rileva una distrazione prolungata, ottimizzando così il carico di rete.

2. **Backend:**
   * Sviluppato in **FastAPI** (Python) per gestire in modo efficiente il traffico asincrono
   * Integra modelli di **AI (Gemini API)** per elaborare feedback proattivi, contestuali e personalizzati di assistenza alla guida con l'obiettivo di evitare l'assuefazione dall'avviso statico al quale l'utente si abitua.
   * Utilizza le API di **Geoapify** per individuare dinamicamente l'area di sosta o l'area di servizio sicura più vicina alle coordinate ricevute.
   * Chiude il loop di sicurezza inviando istantaneamente al client il pacchetto di assistenza (istruzioni vocali generate dall'IA e coordinate dell'area di sosta più vicina) in risposta al trigger di emergenza generato dal frontend tramite messaggio di allarme.


## 📋 Prerequisiti

Prima di procedere con l'installazione, assicurarsi di avere a disposizione:
- **Docker** installato e configurato sulla macchina host.
- Una **Webcam** funzionante e accessibile per l'acquisizione dei frame video.
- Connessione a Internet attiva (per il download iniziale dei modelli MediaPipe e dI Docker).

---

## 🚀 Installazione e Avvio Rapido (Run)

Grazie all'integrazione dei container, l'intera pipeline di rete, la compilazione dei moduli e la mappatura dei volumi di memoria persistenti vengono avviate in modo identico su qualsiasi macchina attraverso pochissimi comandi da terminale (PORTABILITY).

### 1. Clonare il Repository
Scaricare i file sorgenti del progetto all'interno della propria workstation locale:

```bash
git clone <URL_DEL_TUO_REPOSITORY>
cd <NOME_DELLA_CARTELLA>
```


### 2. Configurare le Variabili d'Ambiente Private
Il backend necessita delle chiavi crittografiche per agganciarsi ai microservizi cloud esterni. Crea un file nominato esplicitamente **.env** all'interno della sottocartella **backend/** e compila il parametro per l'attivazione dell'assistente virtuale:

```env
GEMINI_API_KEY=inserisci_qui_la_tua_api_key_di_gemini
```

### 3. Compilazione ed Esecuzione dell'Infrastruttura
Dalla cartella principale del progetto (la radice dove risiede il file orchestratore **`docker-compose.yml`**), lanciare il comando esecutivo per forzare la build dei layer isolati e attivare i servizi in background:

```bash
docker compose up --build
```
Nota: Durante il primo avvio del comando, Docker scaricherà le distribuzioni Linux di base (Python e Node.js slim) ed eseguirà l'installazione interna di tutti i pacchetti e dei pacchetti software di Computer Vision. L'operazione potrebbe richiedere alcuni minuti a seconda delle performance della connessione.

### 4. Utilizzo del Sistema
Una volta completata l'inizializzazione, i log del server confermeranno l'accensione simultanea dei nodi:

* **Frontend Dashboard (HMI):** È raggiungibile aprendo il browser web all'indirizzo **http://localhost:5173**
* **Backend API (FastAPI):** Lavora in background gestendo la coda di ascolto sulla porta logica **http://localhost:8000**

⚠️ **Nota di Sicurezza Hardware:** Al primo caricamento della dashboard nel browser, l'applicazione solleverà i prompt nativi di sicurezza del sistema operativo. È obbligatorio acconsentire all'utilizzo della Fotocamera e della Geolocalizzazione. In caso contrario, i moduli hardware **useMediaPipe** e **useGeolocation** rimarranno inibiti, impedendo la cattura dei landmark facciali e il tracciamento della telemetria GPS su strada.

## 🛑 Interruzione dell'Ambiente e Disattivazione dei Canali

Per arrestare correttamente l'esecuzione dei container, terminare i thread asincroni ed eseguire il clean-up delle interfacce di rete allocate nel sistema, premere semplicemente **CTRL+C** all'interno del terminale principale.

In alternativa, per assicurare una disattivazione atomica dell'ambiente, eseguire il seguente comando da una nuova istanza di terminale posizionata nella root del progetto:

```bash
docker compose down
```