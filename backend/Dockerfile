# Immagine base Python 3.10 slim
FROM python:3.10-slim

WORKDIR /app

# Installazione librerie Python (assicurati di aver aggiunto numpy e opencv-python nel file)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Avvio con auto-reload per lo sviluppo sulla porta 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]