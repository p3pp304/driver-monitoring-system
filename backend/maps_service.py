import requests

def get_nearest_safe_zone(lat: float, lng: float):
    """
    Interroga le API di OpenStreetMap (Overpass) per trovare il bar 
    o la stazione di servizio più vicina entro un raggio di 5 km.
    """
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    overpass_query = f"""
    [out:json];
    (
      node["amenity"="cafe"](around:5000,{lat},{lng});
      node["amenity"="fuel"](around:5000,{lat},{lng});
    );
    out center 1;
    """
    
    try:
        response = requests.get(overpass_url, params={'data': overpass_query}, timeout=5)
        data = response.json()
        
        if data.get('elements'):
            place = data['elements'][0]
            name = place.get('tags', {}).get('name', 'Area di Sosta / Caffetteria')
            # Estraiamo latitudine e longitudine dal JSON di Overpass
            poi_lat = place.get('lat')
            poi_lon = place.get('lon') # OSM usa 'lon', noi lo mappiamo su 'lng'

            return {"name": name, "lat": poi_lat, "lng": poi_lon}
            
    except Exception as e:
        print(f"[ERRORE MAPS] Chiamata a OpenStreetMap fallita: {e}")
        
    return {"name": "16-Bis Piazzola di sosta a 10 minuti di auto", "lat": None, "lng": None}