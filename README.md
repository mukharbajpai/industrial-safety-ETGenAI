# Industrial Safety Intelligence Platform

A single-service React and FastAPI demonstration that loads industrial safety datasets, trains risk models, and presents predictions, alerts, equipment health, worker status, and recommendations in one dashboard.

## Application routes

- Dashboard: `/`
- API health: `/api/health`
- Interactive API documentation: `/docs`

The SQLite database is generated from the CSV datasets whenever the service starts and is not persisted between restarts.

`render.yaml` enables a low-memory demonstration mode for Render's free tier.
Local runs use the full datasets and model settings unless those environment
variables are explicitly enabled.
