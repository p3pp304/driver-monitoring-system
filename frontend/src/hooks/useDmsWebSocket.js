 import { useEffect, useRef, useState } from 'react';
 
 // --- 1. WEBSOCKET ---

 export const useDmsWebSocket = (sessionStatus, onDistraction) => {
    const wsRef = useRef(null);
    const [techStatus, setTechStatus] = useState("Sistema di monitoraggio in attesa");  // Stato tecnico dettagliato per debugging (non mostrato all'utente finale, ma utile durante lo sviluppo)

    useEffect(() => {
            // Se non siamo in viaggio, non apriamo la connessione
            if (sessionStatus !== "active") {
                setTechStatus("Sistema di monitoraggio in attesa");
                return;
            }

            wsRef.current = new WebSocket('ws://localhost:8000/ws');
            
            wsRef.current.onopen = () => {
                setTechStatus("Connesso al server");
                console.log("[NETWORK] Handshake WebSocket completato sulla porta 8000."); 
            };
            
            wsRef.current.onclose = () => {
                setTechStatus("Disconnesso dal server");
                console.log("[NETWORK] Canale WebSocket chiuso.");
            }; 
            
            wsRef.current.onmessage = (event) => {
                const response = JSON.parse(event.data);
                if (response.type === "PROACTIVE_ASSISTANCE") {
                    // Passiamo i dati della risposta ad App.jsx tramite la callback
                    onDistraction(response);
                }
            };

            // Pulizia alla disconnessione o fine viaggio
            return () => { 
                if (wsRef.current) wsRef.current.close(); 
            };
        }, [sessionStatus, onDistraction]);

        // Funzione esposta per permettere ad App.jsx di inviare l'allarme
        const sendWsMessage = (message) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify(message));
            }
        };

        return { techStatus, sendWsMessage };
    };