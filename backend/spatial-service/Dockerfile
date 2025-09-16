FROM python:3.9-slim-bullseye

WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "120", "spatial:app"]