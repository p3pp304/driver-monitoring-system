# Driver Monitoring System (DMS) - Edge Computing & V2N Architecture

Questa repository contiene il prototipo software di un **Driver Monitoring System (DMS)** sviluppato come progetto di tesi in Ingegneria Informatica e dell'Automazione (Politecnico di Bari, A.A. 2025/2026). 

Il sistema implementa un'architettura ibrida basata su **Edge Computing** nel frontend per l'elaborazione dei flussi video in tempo reale e una rete **V2N (Vehicle-to-Network)** asincrona via **WebSocket** connessa a un backend in **FastAPI**. Il sistema è interamente containerizzato tramite **Docker** attraverso due Dockerfile(frontend e backend) e un **Docker Compose**.

---

## 🏗️ Architettura del Sistema

Il sistema è suddiviso in due macro-servizi isolati che comunicano in modo bidirezionale e asincrono tramite protocollo **WebSocket**:

1. **Frontend:**
   * Sviluppato in **React** sfruttando **Vite** come build-tool per garantire alte prestazioni nel rendering dell'interfaccia.
   * Esegue algoritmi di **Computer Vision** in locale (**Edge Computing**) tramite i modelli di Deep Learning pre-addestrati di **MediaPipe (Face Mesh)** per calcolare l'**Eye Aspect Ratio (EAR)** del conducente.
   * Acquisisce le posizione geografica del conducente tramite le API hardware di **Geolocalizzazione** native del browser.
   * Invia al server un pacchetto contenente stato di sonnolenza e coordinate GPS *esclusivamente* quando rileva una distrazione prolungata, ottimizzando così il carico di rete.

2. **Backend:**
   * Sviluppato in **FastAPI** (Python) per gestire in modo efficiente il traffico asincrono
   * Integra modelli di **AI (Gemini API)** per elaborare feedback proattivi, contestuali e personalizzati di assistenza alla guida con l'obiettivo di evitare l'assuefazione all'avviso statico al quale l'utente si abitua.
   * Utilizza le API di **Geoapify** per individuare l'area di sosta o l'area di servizio sicura più vicina alle coordinate ricevute.
   * Chiude il loop di sicurezza inviando istantaneamente al client il pacchetto di assistenza (istruzioni vocali generate dall'IA e coordinate dell'area di sosta più vicina) in risposta al trigger di emergenza generato dal frontend tramite messaggio di allarme inviato al server.


## 📋 Prerequisiti

Prima di procedere con l'installazione, assicurarsi di avere a disposizione:
- **Docker** installato e configurato sulla macchina host.
- Una **Webcam** funzionante e accessibile per l'acquisizione dei frame video.
- Connessione a Internet attiva (per il download iniziale dei modelli MediaPipe e di Docker).

---

## 💻 Avvio in Ambiente Locale (Modalità Sviluppo)

Per attività di debugging o per apportare modifiche rapide al codice sfruttando l'hot-reload senza utilizzare i container Docker, è possibile avviare i due macro-servizi nativamente sui rispettivi terminali.

### Configurare le Variabili d'Ambiente Private
Il backend necessita delle chiavi API per agganciarsi ai microservizi cloud esterni. Crea un file nominato **.env** all'interno della  cartella **backend/**:

```env
GEMINI_API_KEY=inserisci_qui_la_tua_api_key_di_gemini
GEOAPIFY_API_KEY= inserisci_qui_la_tua_api_key_di_geoapify
```

### 1. Avvio del Backend (FastAPI)
Aprire un terminale, posizionarsi all'interno della cartella `backend/` e inizializzare l'ambiente virtuale Python:

```bash
cd backend
python -m venv venv
```
Su Windows:
```bash
venv\Scripts\activate # Attivazione ambiente virtuale (Windows)
```
Su macOS/Linux:
```bash
source venv/bin/activate # Attivazione ambiente virtuale (macOS/Linux)
```
Installare dipendenze e avviare il server:
```bash
pip install -r requirements.txt  # Installazione delle dipendenze
python main.py
```

### 2. Avvio del Frontend (React)
Aprire un terminale, posizionarsi all'interno della cartella `frontend/` e avviare server di sviluppo Vite:

```bash
cd frontend
npm install

npm run dev # Avvio del server di sviluppo Vite
```

## 🚀 Installazione e Avvio Rapido (Run) con Docker

Grazie all'integrazione dei container, l'intera pipeline di rete, la compilazione dei moduli e la mappatura dei volumi di memoria persistenti vengono avviate in modo identico su qualsiasi macchina attraverso pochissimi comandi da terminale (PORTABILITY).

### 1. Clonare il Repository
Scaricare i file sorgenti del progetto all'interno della propria cartella di lavoro locale:

```bash
git clone <URL_DEL_TUO_REPOSITORY>
cd <NOME_DELLA_CARTELLA>
```


### 2. Configurare le Variabili d'Ambiente Private
Il backend necessita delle chiavi API per agganciarsi ai microservizi cloud esterni. Crea file `.env` come spiegato nella sezione di avvio in locale.

### 3. Compilazione ed Esecuzione dell'Infrastruttura
Dalla cartella principale del progetto, lanciare il comando esecutivo per forzare la build dei layer isolati e attivare i servizi in background:

```bash
docker compose up --build
```
Nota: Durante il primo avvio del comando, Docker scaricherà le distribuzioni Linux di base (Python e Node.js slim) ed eseguirà l'installazione interna di tutti i pacchetti e dei pacchetti software di Computer Vision. L'operazione potrebbe richiedere alcuni minuti a seconda della connessione.

### 4. Utilizzo del Sistema
Una volta completata l'inizializzazione, i log del server confermeranno l'accensione simultanea dei nodi:

* **Frontend (Interfaccia):** È raggiungibile aprendo il browser web all'indirizzo **http://localhost:5173**
* **Backend API (FastAPI):** Lavora in background gestendo la coda di ascolto sulla porta logica **http://localhost:8000**

⚠️ **Nota di Sicurezza Hardware:** Al primo caricamento della dashboard nel browser, è obbligatorio acconsentire all'utilizzo della Fotocamera e della Geolocalizzazione. In caso contrario, i moduli hardware **useMediaPipe** e **useGeolocation** rimarranno inibiti, impedendo l'acquisizione dei landmark facciali e il tracciamento della posizione GPS su strada.

## 🛑 Interruzione dell'Ambiente e Disattivazione dei Canali

Per arrestare correttamente l'esecuzione dei container, terminare i thread asincroni ed eseguire il clean-up delle interfacce di rete allocate nel sistema, premere semplicemente **CTRL+C** all'interno del terminale principale.

In alternativa, per assicurare una disattivazione atomica dell'ambiente, eseguire il seguente comando da una nuova istanza di terminale posizionata nella root del progetto:

```bash
docker compose down
```
