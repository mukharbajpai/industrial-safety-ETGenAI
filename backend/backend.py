"""
backend.py

FastAPI application for the Industrial Safety Intelligence Platform.

Responsible for:
- Loading the 7 CSVs + 1 JSON dataset from disk
- Persisting them into SQLite (with indexes) for relational queries
- Exposing REST endpoints consumed by the React frontend
- Running the AIEngine on a background scheduler so predictions stay fresh

All endpoints return data that is either read directly from the datasets or
derived from them by ai_engine.AIEngine. Nothing here fabricates values.
"""

import asyncio
import json
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ai_engine import AIEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("backend")

BASE_DIR = Path(__file__).resolve().parent


# ======================================================================
# Configuration
# ======================================================================

class AppConfig:
    DATA_DIR = str(BASE_DIR / "data")
    DB_PATH = str(BASE_DIR / "safety_intelligence.db")
    LOW_MEMORY_MODE = os.getenv("LOW_MEMORY_MODE", "0").lower() in {"1", "true", "yes"}
    SKIP_SQLITE = os.getenv("SKIP_SQLITE", "0").lower() in {"1", "true", "yes"}

    # filename -> (loader kind, parse_dates)
    FILES = {
        "sensor_data": ("csv", ["timestamp"]),
        "worker_location": ("csv", ["timestamp"]),
        "permit_log": ("csv", ["start_time", "end_time"]),
        "equipment_health": ("csv", ["timestamp"]),
        "incident_history": ("csv", ["timestamp"]),
        "weather_data": ("csv", ["timestamp"]),
        "maintenance_schedule": ("csv", ["scheduled_date"]),
        "plant_layout": ("json", None),
    }

    PREDICTION_INTERVAL_SECONDS = int(os.getenv("PREDICTION_INTERVAL_SECONDS", "60"))


# ======================================================================
# Data loading + SQLite persistence
# ======================================================================

class DataStore:
    """Owns the in-memory dataframes, the SQLite mirror, and the AI engine."""

    def __init__(self) -> None:
        self.dfs: Dict[str, pd.DataFrame] = {}
        self.plant_layout: List[Dict[str, Any]] = []
        self.ai = AIEngine()
        self.load_errors: Dict[str, str] = {}

    def load_data(self) -> None:
        for name, (kind, parse_dates) in AppConfig.FILES.items():
            filename = f"{name}.json" if kind == "json" else f"{name}.csv"
            path = f"{AppConfig.DATA_DIR}/{filename}"
            try:
                if kind == "csv":
                    df = pd.read_csv(path)
                    for col in parse_dates or []:
                        if col in df.columns:
                            df[col] = pd.to_datetime(df[col], errors="coerce")
                    if AppConfig.LOW_MEMORY_MODE:
                        df = self._optimize_dataframe(df)
                        # No endpoint exposes worker-location history. Keeping the
                        # latest record per worker preserves every current-worker
                        # feature while avoiding ~200k redundant rows on small hosts.
                        if name == "worker_location" and {"worker_id", "timestamp"}.issubset(df.columns):
                            df = (
                                df.sort_values("timestamp")
                                .drop_duplicates(subset=["worker_id"], keep="last")
                                .copy()
                            )
                    self.dfs[name] = df
                    logger.info("Loaded %s -> shape=%s", filename, df.shape)
                else:
                    with open(path, "r") as f:
                        self.plant_layout = json.load(f)
                    logger.info("Loaded %s -> %d zones", filename, len(self.plant_layout))
            except Exception as exc:  # noqa: BLE001
                self.load_errors[name] = str(exc)
                logger.error("Failed to load %s: %s", filename, exc)

        if AppConfig.SKIP_SQLITE:
            logger.info("Skipping unused SQLite mirror (SKIP_SQLITE enabled).")
        else:
            self._init_sqlite()

    @staticmethod
    def _optimize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        """Reduce RAM without changing the values returned by the API."""
        for col in df.select_dtypes(include=["float64"]).columns:
            df[col] = pd.to_numeric(df[col], downcast="float")
        for col in df.select_dtypes(include=["int64"]).columns:
            df[col] = pd.to_numeric(df[col], downcast="integer")
        for col in df.select_dtypes(include=["object"]).columns:
            unique_count = df[col].nunique(dropna=False)
            if unique_count <= 1000 and unique_count <= max(32, len(df) // 10):
                df[col] = df[col].astype("category")
        return df

    def _init_sqlite(self) -> None:
        """Mirror the dataframes into SQLite with indexes for relational queries."""
        try:
            conn = sqlite3.connect(AppConfig.DB_PATH)
            for name, df in self.dfs.items():
                out = df.copy()
                for col in out.columns:
                    if pd.api.types.is_datetime64_any_dtype(out[col]):
                        out[col] = out[col].astype(str)
                out.to_sql(name, conn, if_exists="replace", index=False)

            cur = conn.cursor()
            index_spec = {
                "sensor_data": ["equipment_id", "zone", "timestamp"],
                "worker_location": ["worker_id", "zone", "timestamp"],
                "permit_log": ["equipment_id", "zone", "status"],
                "equipment_health": ["equipment_id", "timestamp"],
                "incident_history": ["equipment_id", "zone", "timestamp"],
                "maintenance_schedule": ["equipment_id"],
            }
            for table, cols in index_spec.items():
                if table not in self.dfs:
                    continue
                for col in cols:
                    if col in self.dfs[table].columns:
                        idx_name = f"idx_{table}_{col}"
                        try:
                            cur.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table}({col})")
                        except sqlite3.OperationalError as exc:
                            logger.warning("Index creation failed for %s.%s: %s", table, col, exc)
            conn.commit()
            conn.close()
            logger.info("SQLite mirror initialized at %s", AppConfig.DB_PATH)
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to initialize SQLite: %s", exc)

    def latest_per_key(self, table: str, key: str, time_col: str = "timestamp") -> pd.DataFrame:
        """Return the most recent row per `key` value in `table`, sorted by time_col."""
        if table not in self.dfs or self.dfs[table].empty:
            return pd.DataFrame()
        df = self.dfs[table]
        if time_col not in df.columns:
            return df
        return df.sort_values(time_col).drop_duplicates(subset=[key], keep="last")


data_store = DataStore()


def df_to_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Safely convert a dataframe to JSON-serializable records (datetimes -> ISO strings)."""
    if df is None or df.empty:
        return []
    out = df.copy()
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%dT%H:%M:%S")
    return json.loads(out.to_json(orient="records"))


# ======================================================================
# App lifecycle
# ======================================================================

async def prediction_scheduler() -> None:
    """Background task: re-run the AI batch predictions on a fixed interval."""
    while True:
        try:
            logger.info("Running scheduled AI batch predictions...")
            data_store.ai.run_batch_predictions(data_store.dfs)
        except Exception as exc:  # noqa: BLE001
            logger.error("Scheduler error: %s", exc)
        await asyncio.sleep(AppConfig.PREDICTION_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up: loading datasets and training AI models...")
    data_store.load_data()
    data_store.ai.initialize_models(data_store.dfs)
    task = asyncio.create_task(prediction_scheduler())
    yield
    task.cancel()
    logger.info("Shutting down application...")


app = FastAPI(title="Industrial Safety Intelligence Platform", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================================================================
# Health / meta
# ======================================================================

@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "datasets_loaded": list(data_store.dfs.keys()),
        "load_errors": data_store.load_errors,
    }


@app.get("/api/ai/model-status")
def model_status() -> Dict[str, Any]:
    """Transparency endpoint: what got trained, on how much data, with what metrics."""
    return data_store.ai.get_model_status()


@app.get("/api/plant-layout")
def get_plant_layout() -> List[Dict[str, Any]]:
    return data_store.plant_layout


# ======================================================================
# Raw / near-raw data endpoints
# ======================================================================

@app.get("/api/equipment")
def get_equipment() -> List[Dict[str, Any]]:
    """Latest health snapshot per equipment, joined with its current zone."""
    latest = data_store.latest_per_key("equipment_health", "equipment_id")
    return df_to_records(latest)


@app.get("/api/equipment/{equipment_id}/history")
def get_equipment_history(equipment_id: str, days: int = Query(90, ge=1, le=365)) -> Dict[str, Any]:
    df = data_store.dfs.get("equipment_health", pd.DataFrame())
    if df.empty:
        raise HTTPException(status_code=404, detail="equipment_health dataset not loaded")
    hist = df[df["equipment_id"] == equipment_id].sort_values("timestamp").tail(days)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No health history for {equipment_id}")
    return {"equipment_id": equipment_id, "history": df_to_records(hist)}


@app.get("/api/sensors/live")
def get_live_sensors() -> List[Dict[str, Any]]:
    latest = data_store.latest_per_key("sensor_data", "equipment_id")
    return df_to_records(latest)


@app.get("/api/sensors/{equipment_id}/history")
def get_sensor_history(equipment_id: str, points: int = Query(288, ge=1, le=5000)) -> Dict[str, Any]:
    df = data_store.dfs.get("sensor_data", pd.DataFrame())
    if df.empty:
        raise HTTPException(status_code=404, detail="sensor_data dataset not loaded")
    hist = df[df["equipment_id"] == equipment_id].sort_values("timestamp").tail(points)
    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No sensor history for {equipment_id}")
    return {"equipment_id": equipment_id, "history": df_to_records(hist)}


@app.get("/api/workers")
def get_workers() -> List[Dict[str, Any]]:
    latest = data_store.latest_per_key("worker_location", "worker_id")
    return df_to_records(latest)


@app.get("/api/workers/zone-summary")
def get_worker_zone_summary() -> List[Dict[str, Any]]:
    latest = data_store.latest_per_key("worker_location", "worker_id")
    if latest.empty:
        return []
    summary = (
        latest.groupby("zone")
        .apply(
            lambda g: pd.Series(
                {
                    "worker_count": len(g),
                    "working_count": int((g["working"] == "Yes").sum()),
                    "helmet_compliance_pct": round(float((g["helmet"] == "Yes").mean() * 100), 1),
                    "vest_compliance_pct": round(float((g["safety_vest"] == "Yes").mean() * 100), 1),
                    "confined_space_count": int((g["confined_space"] == "Yes").sum()),
                }
            ),
            include_groups=False,
        )
        .reset_index()
    )
    return df_to_records(summary)


@app.get("/api/permits")
def get_permits(status: Optional[str] = None) -> List[Dict[str, Any]]:
    df = data_store.dfs.get("permit_log", pd.DataFrame())
    if df.empty:
        return []
    if status:
        df = df[df["status"].str.lower() == status.lower()]
    return df_to_records(df)


@app.get("/api/maintenance")
def get_maintenance(equipment_id: Optional[str] = None) -> List[Dict[str, Any]]:
    df = data_store.dfs.get("maintenance_schedule", pd.DataFrame())
    if df.empty:
        return []
    if equipment_id:
        df = df[df["equipment_id"] == equipment_id]
    return df_to_records(df)


@app.get("/api/weather/latest")
def get_weather_latest() -> Dict[str, Any]:
    df = data_store.dfs.get("weather_data", pd.DataFrame())
    if df.empty:
        raise HTTPException(status_code=404, detail="weather_data dataset not loaded")
    latest = df.sort_values("timestamp").iloc[-1]
    return df_to_records(pd.DataFrame([latest]))[0]


@app.get("/api/weather/history")
def get_weather_history(hours: int = Query(72, ge=1, le=2200)) -> List[Dict[str, Any]]:
    df = data_store.dfs.get("weather_data", pd.DataFrame())
    if df.empty:
        return []
    return df_to_records(df.sort_values("timestamp").tail(hours))


@app.get("/api/incidents")
def get_incidents(
    zone: Optional[str] = None,
    severity: Optional[str] = None,
    equipment_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=5000),
) -> List[Dict[str, Any]]:
    df = data_store.dfs.get("incident_history", pd.DataFrame())
    if df.empty:
        return []
    if zone:
        df = df[df["zone"] == zone]
    if severity:
        df = df[df["severity"].str.lower() == severity.lower()]
    if equipment_id:
        df = df[df["equipment_id"] == equipment_id]
    return df_to_records(df.sort_values("timestamp", ascending=False).head(limit))


@app.get("/api/incidents/analytics")
def get_incident_analytics() -> Dict[str, Any]:
    return data_store.ai.get_incident_analytics(data_store.dfs)


# ======================================================================
# AI-derived endpoints
# ======================================================================

@app.get("/api/dashboard/overall-risk")
def get_overall_risk() -> Dict[str, Any]:
    return data_store.ai.get_overall_risk()


@app.get("/api/dashboard/active-alerts")
def get_active_alerts() -> List[Dict[str, Any]]:
    return data_store.ai.get_active_alerts()


@app.get("/api/ai/risk-predictions")
def get_risk_predictions() -> List[Dict[str, Any]]:
    return data_store.ai.get_risk_predictions()


@app.get("/api/ai/incident-predictions")
def get_incident_predictions() -> List[Dict[str, Any]]:
    return data_store.ai.get_incident_predictions()


@app.get("/api/ai/compound-risks")
def get_compound_risks() -> List[Dict[str, Any]]:
    return data_store.ai.get_compound_risks()


@app.get("/api/ai/recommendations")
def get_recommendations() -> List[Dict[str, Any]]:
    return data_store.ai.get_recommendations()


@app.get("/api/ai/explain/{equipment_id}")
def explain_prediction(equipment_id: str) -> Dict[str, Any]:
    explanation = data_store.ai.explain_equipment(equipment_id)
    if not explanation:
        raise HTTPException(status_code=404, detail=f"No explanation available for {equipment_id}")
    return explanation


# Serve the production React build from the same process and domain as the API.
# The Docker build copies Vite's `dist` output into backend/static.
STATIC_DIR = BASE_DIR / "static"
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
