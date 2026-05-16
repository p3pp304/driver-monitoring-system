import { useRef, useCallback, useEffect } from 'react';

export function useGeolocation(sessionStatus) {
    const currentLocationRef = useRef({ lat: 41.1087, lng: 16.8784 }); // Coordinate di fallback (es. Politecnico di Bari)
    const watchIdRef = useRef(null); // Serve per spegnere il GPS a fine viaggio

    // Accensione GPS
    const startGPSMonitoring = useCallback(() => {
        if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
            // Successo
            (pos) => currentLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude },
            // Errore
            (err) => {
                    console.warn("[GPS] Errore di tracciamento:", err.message);
                }
        );
       } else {
            console.error("[GPS] Geolocalizzazione non supportata.");
       }
    },[]);

    const stopGPSMonitoring = useCallback(() => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current); 
            watchIdRef.current = null; 
        }
    },[]);

    useEffect(() => {
        if (sessionStatus === "active") {
            startGPSMonitoring();
        } else {
            stopGPSMonitoring();
        }
        return () => stopGPSMonitoring(); // Pulisce in caso di smontaggio del componente
    },[sessionStatus, startGPSMonitoring, stopGPSMonitoring]);
    
    return { currentLocationRef};
}   