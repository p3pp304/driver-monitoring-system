import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import json
from datetime import datetime
from backend.services.gemini_service import genera_assistenza_vocale
from backend.services.maps_service import get_nearest_safe_zone
from backend.services.scoring_service import calculate_smart_penalty

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
    last_ai_response_time = None # Variabile di stato per il cooldown dell'IA
    
    # --- TASK IN BACKGROUND (Il nuovo gestore del Bonus) ---
    async def bonus_manager():
        try:
            while True:
                await asyncio.sleep(60) # Controlla ogni 60 secondi
                now = datetime.now()
                secondi_trascorsi = (now - last_event_time).total_seconds()
                
                if secondi_trascorsi >= 600: # 600 secondi = 10 minuti di guida sicura
                    messaggio_bonus = {
                        "type": "SAFETY_BONUS",
                        "points": 5
                    }
                    await websocket.send_text(json.dumps(messaggio_bonus))
                    # Resetta il timer dopo aver dato il bonus
                    last_event_time = now
                    print("🏆 Bonus sicurezza inviato al veicolo dal server.")
        except asyncio.CancelledError:
            pass # Chiusura silenziosa quando il veicolo si scollega

    # Avviamo il worker in parallelo alla connessione
    bonus_task = asyncio.create_task(bonus_manager())

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
                
                ai_task = genera_assistenza_vocale(var_x, last_ai_response_time) 
                maps_task = get_nearest_safe_zone(location["lat"], location["lng"]) 
                ai_result, safe_zone = await asyncio.gather(ai_task, maps_task) # Ottimizziamo i tempi di risposta eseguendo in parallelo l'IA e la ricerca della safe zone

                ai_response, last_ai_response_time = ai_result # Aggiorniamo il timer dell'IA solo dopo aver ricevuto la risposta (sia reale che di fallback)

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
    finally:
        bonus_task.cancel() # Assicuriamoci di chiudere il worker quando il veicolo si disconnette
    
