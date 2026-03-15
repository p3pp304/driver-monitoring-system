from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio

# Inizializzazione dell'applicazione FastAPI
app = FastAPI()

# --- CONFIGURAZIONE LOGICA PROATTIVA ---
# Variabile x: Soglia critica di chiusura occhi (espressa in secondi)
# Se il tempo di chiusura occhi > X_SLEEP_THRESHOLD -> Intervento Proattivo
X_SLEEP_THRESHOLD = 1.5 

@app.get("/")
async def health_check():
    """
    Rotta diagnostica (Capitolo 5).
    Verifica che il container sia online e restituisce la soglia x corrente.
    """
    return {
        "status": "DMS Backend Online",
        "version": "1.0.0",
        "active_threshold_x": f"{X_SLEEP_THRESHOLD}s",
        "framework": "FastAPI (Asynchronous)"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Core del monitoraggio in tempo reale
    Gestisce la connessione persistente per lo streaming dei dati biometrici.
    """
    # Fase di Handshake: il server accetta la connessione permanente
    await websocket.accept()
    print("Connessione WebSocket stabilita. Monitoraggio conducente attivo.")
    
    try:
        # Loop infinito di monitoraggio (Stateful)
        while True:
            # Ricezione dei dati dal Frontend (es. coordinate occhi da MediaPipe)
            # await non blocca il server mentre aspetta i dati
            data = await websocket.receive_text()
            
            # --- LOGICA DI ELABORAZIONE ---
            # Qui integreremo l'analisi dei landmark e il calcolo della variabile x
            
            # Risposta immediata al frontend per confermare la bassa latenza
            await websocket.send_text(f"Dati ricevuti. Analisi in corso con soglia x: {X_SLEEP_THRESHOLD}s")
            
    except WebSocketDisconnect:
        # Gestione della disconnessione (fine del viaggio o chiusura app)
        print("Conducente disconnesso. Sessione di monitoraggio terminata.")
    except Exception as e:
        print(f"Errore critico durante lo streaming: {e}")