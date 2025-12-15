FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements-docker.txt /app/backend/requirements-docker.txt
RUN python -m pip install --upgrade pip && \
    python -m pip install -r /app/backend/requirements-docker.txt

COPY backend /app/backend
COPY main /app/main

EXPOSE 8000
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]

