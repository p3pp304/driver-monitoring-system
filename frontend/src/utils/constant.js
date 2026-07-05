export const SESSION_STATUS = {
    STARTED: 'started',
    IDLE: 'idle',
    ACTIVE: 'active',
    FINISHED: 'finished'
};

export const GEOLOCATION_FALLBACK = {
    LAT: 41.1087,
    LNG: 16.8784,
    NAME: 'Politecnico di Bari'
};

export const DMS_CONFIG = {
    EAR_THRESHOLD: 0.2,  //Soglia sotto la quale gli occhi sono considerati chiusi
    X_SLEEP_THRESHOLD:  0.5, // tempo minimo di chiusura occhi dopo il quale SCATTA ALLARME
    ALARM_DEBOUNCE: 2000
};