import os
import httpx

# CONFIGURAZIONE API
GEOAPIFY_API_KEY = os.environ.get("GEOAPIFY_API_KEY")

# Inizializzazione connessione --> 3-three way HANDSHAKE (Keep-Alive)
async_client = httpx.AsyncClient(timeout=5.0)

def get_fallback_zone(lat: float, lng: float) -> dict:   #funzione di fallback--> restituisce zona di emergenza fittizia in caso di errore o assenza di risultati
    
    return {
            "name": "Area sosta d'emergenza",
            "lat": lat + 0.005,
            "lng": lng + 0.005,
            "distance_kilometers": 1,
            "success": False
        }

# LOGICA DI RICERCA (TRAMITE GEOAPIFY)

async def get_nearest_safe_zone(lat: float, lng: float)-> dict:

    if not GEOAPIFY_API_KEY:
        print("[ERRORE] Chiave API Geoapify mancante o non caricata dal file .env.")
        return get_fallback_zone(lat, lng)
    
    categories = "catering.cafe,service.vehicle.fuel"
    radius_meters = 5000  # raggio di ricerca di 5 km
    
    url = (
        f"https://api.geoapify.com/v2/places?"
        f"categories={categories}&"
        f"filter=circle:{lng},{lat},{radius_meters}&"
        f"bias=proximity:{lng},{lat}&"
        f"limit=1&apiKey={GEOAPIFY_API_KEY}"
    )

    try:
        response = await async_client.get(url)
        data = response.json()

        if not data.get("features"):
            print("[GEOAPIFY] Nessuna safe zone trovata nel raggio di 5 km.")
            return get_fallback_zone(lat, lng)
            
        nearest_place = data["features"][0]
        properties = nearest_place["properties"]
        
        # Recuperiamo i dati
        name = properties.get("name")
        poi_lat = properties.get("lat")
        poi_lng = properties.get("lon")
        distance_meters = properties.get("distance")  

        distance_kilometers = float(distance_meters) / 1000

        print(f"[GEOAPIFY] Match area: {name} a ({distance_kilometers}Km).")

        return {
            "name": name,
            "lat": poi_lat,
            "lng": poi_lng,
            "distance_kilometers": distance_kilometers,
            "success": True
        }

    except Exception as e:
        print(f"[ERRORE GEOAPIFY] {e}")
        # Fallback di emergenza nel caso l'API non risponda o non ci sia rete
        return get_fallback_zone(lat, lng)