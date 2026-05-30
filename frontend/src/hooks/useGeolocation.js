import { useRef, useEffect } from 'react';
import { GEOLOCATION_FALLBACK } from '../utils/constant';

const startGPSMonitoring = (currentLocationRef,watchIdRef) => {
    if (navigator.geolocation) {
    watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => currentLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude },
        (err) => {
                console.warn("[GPS] Errore di tracciamento:", err.message);
            }
    );
    } else {
        console.error("[GPS] Geolocalizzazione non supportata.");
    }
};

const stopGPSMonitoring = (watchIdRef) => {
    if (watchIdRef.current!== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null; 
        console.log("[GPS] Monitoraggio hardware interrotto e risorsa rilasciata.");
    }
};


export function useGeolocation(sessionStatus) {
    const currentLocationRef = useRef({ lat: GEOLOCATION_FALLBACK.LAT, lng: GEOLOCATION_FALLBACK.LNG }); // Coordinate di fallback (Politecnico di Bari)
    const watchIdRef = useRef(null); // Serve per spegnere il GPS a fine viaggio

    useEffect(() => {
        if (sessionStatus === "active") {
            startGPSMonitoring(currentLocationRef,watchIdRef);
        } else {
            stopGPSMonitoring(watchIdRef);
        }
        return () => stopGPSMonitoring(watchIdRef); // Clean-up in caso di smontaggio del componente
    },[sessionStatus]);
    
    return { currentLocationRef};
}   