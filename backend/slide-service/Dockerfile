FROM python:3.9-slim-bullseye

# Install system dependencies required for image processing
RUN apt-get update && apt-get install -y libjpeg-dev zlib1g-dev

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["gunicorn", "--bind", "0.0.0.0:9006", "slide:app"]