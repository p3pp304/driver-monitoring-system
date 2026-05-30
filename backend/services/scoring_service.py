from datetime import datetime 

def calculate_smart_penalty(var_x, last_event_time):
    now = datetime.now()
    
    # Penalità base proporzionale alla durata
    if (float(var_x) < 1.5):
        base_penalty = 5
    elif (float(var_x) < 3.0):
        base_penalty = 10
    else:
        base_penalty = 20

    # Controllo recidività 
    multiplier = 1.0
    if last_event_time and (now - last_event_time).total_seconds() < 60:
        multiplier = 2.0  # Raddoppia la penalità (2 distrazioni in 60'')
        if (now - last_event_time).total_seconds() < 30:
            multiplier = 3.0  # Triplica penalità (2 distrazioni in 30'')
    last_event_time = now
    penalty = base_penalty * multiplier
    return penalty, now 