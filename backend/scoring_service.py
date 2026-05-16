from datetime import datetime 

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
    if last_event_time and (now - last_event_time).total_seconds() < 60:
        multiplier = 2.0  # Raddoppia la penalità se è recidivo
        if (now - last_event_time).total_seconds() < 30:
            multiplier = 3.0  # Triplica se è molto recidivo
    last_event_time = now
    return base_penalty * multiplier, now # Punti da sottrarre al Safety Score e aggiornamento del timer di recidività