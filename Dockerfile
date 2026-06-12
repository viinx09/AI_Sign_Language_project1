FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=5000

CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 backend.app:app
