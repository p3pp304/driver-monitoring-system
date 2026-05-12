import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import json
from datetime import datetime
from gemini_service import genera_assistenza_vocale
from maps_service import get_nearest_safe_zone

def calculate_smart_penalty(var_x, last_event_time):
    now = datetime.now()
    
    # 1. Penalità base proporzionale alla durata
    if (float(var_x) < 1.5):
        base_penalty = 5
    elif (float(var_x) < 3.0):
        base_penalty = 10
    else:
        base_penalty = 20

    # 2. Controllo recidività (entro 1 minuto)
    multiplier = 1.0
    if last_event_time and (now - last_event_time).seconds < 60:
        multiplier = 2.0  # Raddoppia la penalità se è recidivo
        if (now - last_event_time).seconds < 30:
            multiplier = 3.0  # Triplica se è molto recidivo
    last_event_time = now
    return base_penalty * multiplier, now # Punti da sottrarre al Safety Score e aggiornamento del timer di recidività


# Inizializzazione dell'applicazione FastAPI
app = FastAPI()                                                        

@app.get("/")
async def health_check():
    """
    Verifica che il container sia online e restituisce la soglia x corrente.
    """
    return {
        "status": "DMS Backend Online",
        "version": "2.0.0",
        "architecture": "Edge-Computing (V2N)",
        "framework": "FastAPI (Asynchronous)"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Core del sistema proattivo. Riceve la telemetria dal nodo frontend (React)
    e innesca i moduli di assistenza (Voice & Maps).
    """
    # Fase di Handshake: il server accetta la connessione permanente
    await websocket.accept()
    print("✅ Connessione WebSocket stabilita. In attesa di telemetria...")

    last_event_time = None  # Lo stato va mantenuto a livello di sessione WebSocket, non globale, per gestire più veicoli contemporaneamente
    
    try:
        # Loop infinito: il server "ascolta" in silenzio senza consumare CPU
        while True:
            # 1. Ricezione dell'allarme dal Frontend
            data = await websocket.receive_text()

            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                print(f"⚠️ Dati ricevuti non validi: {data}")
                continue  # Ignora questo ciclo e aspetta il prossimo messaggio
            
            # 2. Controllo dell'evento ricevuto
            if payload.get("event") == "DROWSINESS_DETECTED":
                var_x = payload.get("variable_x")
                location = payload.get("location")
                print(f"🚨 ALLARME RICEVUTO! Il conducente ha chiuso gli occhi per {var_x} secondi | Posizione: {location['lat']}, {location['lng']}")
                
                # --- PILASTRO 1 & 2: LOGICA DI INTERVENTO PROATTIVO ---
                # asyncio.gather attende che entrambi finiscano, dimezzando i tempi di latenza
                
                ai_task = genera_assistenza_vocale(var_x) 
                maps_task = get_nearest_safe_zone(location["lat"], location["lng"]) 
                ai_response, safe_zone = await asyncio.gather(ai_task, maps_task) # Ottimizziamo i tempi di risposta eseguendo in parallelo l'IA e la ricerca della safe zone

                # 3. Costruzione del pacchetto di "Risoluzione Attiva"
                penalty_points,last_event_time = calculate_smart_penalty(var_x, last_event_time)
                risoluzione = {
                    "type": "PROACTIVE_ASSISTANCE",
                    "voice_text": ai_response,
                    "maps_route": safe_zone,
                    "penalty": penalty_points
                }
                
                # 4. Invio delle istruzioni al veicolo (Frontend)
                await websocket.send_text(json.dumps(risoluzione))
                print("📡 Assistenza Proattiva inviata al veicolo con successo.")

    except WebSocketDisconnect:
        print("❌ Veicolo disconnesso. Sessione V2N terminata.")
    except Exception as e:
        print(f"⚠️ Errore critico nel server: {e}")
    
