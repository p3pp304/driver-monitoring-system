# Immagine base Python 3.10 slim
FROM python:3.10-slim

# Installazione dipendenze di sistema "corazzate" per Computer Vision
# Aggiungiamo libsm6, libxext6 e libxrender-dev per la stabilità di OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installazione librerie Python (assicurati di aver aggiunto numpy e opencv-python nel file)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Avvio con auto-reload per lo sviluppo sulla porta 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]