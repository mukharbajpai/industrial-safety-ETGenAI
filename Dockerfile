FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /build

COPY industrial-frontend/package.json industrial-frontend/package-lock.json ./
RUN npm ci

COPY industrial-frontend/ ./
ENV VITE_API_BASE_URL=/api
RUN npm run build


FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/user \
    OMP_NUM_THREADS=2

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 user \
    && mkdir -p /home/user/app \
    && chown user:user /home/user/app

WORKDIR /home/user/app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /tmp/requirements.txt

COPY --chown=user:user backend/ ./
COPY --from=frontend-builder --chown=user:user /build/dist ./static

USER user

EXPOSE 10000

CMD ["sh", "-c", "uvicorn backend:app --host 0.0.0.0 --port ${PORT:-10000}"]
