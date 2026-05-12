import os
import requests


# ==========================================
# 1. CONFIGURAZIONE API
# ==========================================
# In produzione, è consigliato inserire questa chiave in un file .env
GEOAPIFY_API_KEY = os.environ.get("GEOAPIFY_API_KEY")

# ==========================================
# 2. LOGICA DI RICERCA (TRAMITE GEOAPIFY)
# ==========================================

async def get_nearest_safe_zone(lat: float, lng: float):
    """
    Interroga le Places API di Geoapify per trovare il bar o la stazione di servizio
    più vicina alla posizione del conducente.
    """
    # Categorie: catering.cafe (bar) e service.fuel (stazioni di servizio)
    categories = "catering.cafe,service.vehicle.fuel"
    radius_meters = 5000  # Cerchiamo in un raggio di 5 km
    
    # Costruzione dell'URL
    # ATTENZIONE: Geoapify richiede coordinate nel formato lon,lat (longitudine prima)
    url = (
        f"https://api.geoapify.com/v2/places?"
        f"categories={categories}&"
        f"filter=circle:{lng},{lat},{radius_meters}&"
        f"bias=proximity:{lng},{lat}&"
        f"limit=1&apiKey={GEOAPIFY_API_KEY}"
    )

    try:
        # Effettuiamo la chiamata GET
        response = requests.get(url, timeout=5)
        data = response.json()

        # Controlliamo se la risposta contiene risultati validi
        if not data.get("features"):
            print("[GEOAPIFY] Nessuna safe zone trovata nel raggio di 5 km.")
            return {
            "name": "Area sosta d'emergenza",
            "lat": lat + 0.005,
            "lng": lng + 0.005,
            "distance_kilometers": 1,
            "minuti_stimati": 5,
            "success": False
        }
            

        # Estraiamo il primo risultato (il più vicino)
        nearest_feature = data["features"][0]
        properties = nearest_feature["properties"]
        
        # Recuperiamo i dati
        name = properties.get("name", "Area di ristoro")
        poi_lat = properties.get("lat")
        poi_lng = properties.get("lon")
        
        # Geoapify calcola già la distanza lineare in metri dalla posizione del conducente
        distance_meters = properties.get("distance", 1000)  # Default a 1 km se non fornito)
        
        # Stima dei minuti (assumendo una velocità media di circa 40 km/h in zone urbane/extraurbane)
        # 40 km/h = ~666 metri al minuto
        distance_kilometers = float(distance_meters) / 1000
        minuti_stimati = max(1, int(distance_meters / 666))

        print(f"[GEOAPIFY] Match: {name} a {minuti_stimati} min ({distance_meters}m).")

        return {
            "name": name,
            "lat": poi_lat,
            "lng": poi_lng,
            "distance_kilometers": distance_kilometers,
            "minuti_stimati": minuti_stimati,
            "success": True
        }

    except Exception as e:
        print(f"[ERRORE GEOAPIFY] {e}")
        # Fallback di emergenza nel caso l'API non risponda o non ci sia rete
        return {
            "name": "Area sosta d'emergenza",
            "lat": lat + 0.005,
            "lng": lng + 0.005,
            "distance_kilometers": 1,
            "minuti_stimati": 5,
            "success": False
        }