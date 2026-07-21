"""
ai_engine.py

AI Engine for the Industrial Safety Intelligence Platform.

Every number produced here is derived from the 8 provided datasets:
sensor_data, worker_location, permit_log, equipment_health, incident_history,
weather_data, maintenance_schedule, plant_layout.

No random/synthetic values are generated. Where a model cannot be trained
(not enough data, missing labels), the engine falls back gracefully and
reports that in get_model_status() rather than inventing numbers.
"""

import logging
import os
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
from xgboost import XGBClassifier

SHAP_ENABLED = os.getenv("DISABLE_SHAP", "0").lower() not in {"1", "true", "yes"}
if SHAP_ENABLED:
    import shap
else:
    shap = None

logger = logging.getLogger("ai_engine")

RISK_LABEL_MAP = {"Normal": 0, "Warning": 1, "Critical": 2}
RISK_LABEL_INV = {v: k for k, v in RISK_LABEL_MAP.items()}

SENSOR_BASE_COLS = [
    "temperature", "pressure", "gas_ppm", "humidity",
    "vibration", "power_consumption", "flow_rate",
]

# Rolling window of 6 samples == 30 minutes, since sensor_data is on a 5-minute cadence.
ROLL_WINDOW = 6

MIN_ROWS_TO_TRAIN_RISK = 200
MIN_ROWS_TO_TRAIN_INCIDENT = 40
MIN_CLASS_COUNT_TO_TRAIN_INCIDENT = 5

LOW_MEMORY_MODE = os.getenv("LOW_MEMORY_MODE", "0").lower() in {"1", "true", "yes"}
MAX_RISK_TRAIN_ROWS = int(os.getenv("MAX_RISK_TRAIN_ROWS", "50000" if LOW_MEMORY_MODE else "0"))
MAX_ANOMALY_TRAIN_ROWS = int(os.getenv("MAX_ANOMALY_TRAIN_ROWS", "20000" if LOW_MEMORY_MODE else "0"))
RISK_N_ESTIMATORS = int(os.getenv("RISK_N_ESTIMATORS", "80" if LOW_MEMORY_MODE else "200"))
INCIDENT_N_ESTIMATORS = int(os.getenv("INCIDENT_N_ESTIMATORS", "80" if LOW_MEMORY_MODE else "150"))
MODEL_N_JOBS = int(os.getenv("MODEL_N_JOBS", "2" if LOW_MEMORY_MODE else "-1"))


class AIEngine:
    def __init__(self) -> None:
        self.risk_model: Optional[XGBClassifier] = None
        self.incident_model: Optional[XGBClassifier] = None
        self.anomaly_detector: Optional[IsolationForest] = None
        self.risk_explainer = None

        self.risk_feature_cols: List[str] = []
        self.incident_feature_cols: List[str] = []

        self.models_initialized = False
        self.risk_model_trained = False
        self.incident_model_trained = False
        self.training_metrics: Dict[str, Any] = {}
        self.training_rows: Dict[str, int] = {}

        # Cached state served by the API
        self.current_risk: Dict[str, Any] = {"score": 0.0, "level": "Unknown", "as_of": None}
        self.active_alerts: List[Dict[str, Any]] = []
        self.risk_predictions: List[Dict[str, Any]] = []
        self.incident_predictions: List[Dict[str, Any]] = []
        self.compound_risks: List[Dict[str, Any]] = []
        self.recommendations: List[Dict[str, Any]] = []
        self.explanations: Dict[str, Dict[str, Any]] = {}

        # Data-driven thresholds computed at training time (not hardcoded guesses)
        self.gas_ppm_p95: float = 0.0
        self.vibration_p95: float = 0.0

    # ------------------------------------------------------------------
    # Feature engineering
    # ------------------------------------------------------------------

    def _engineer_sensor_features(self, sensor_df: pd.DataFrame) -> pd.DataFrame:
        """Add rolling/derivative features to sensor_data, grouped per equipment."""
        if sensor_df is None or sensor_df.empty:
            return pd.DataFrame()

        df = sensor_df.sort_values(["equipment_id", "timestamp"]).copy()
        g = df.groupby("equipment_id", group_keys=False)

        df["temp_roll_mean"] = g["temperature"].transform(lambda s: s.rolling(ROLL_WINDOW, min_periods=1).mean())
        df["pressure_delta"] = g["pressure"].transform(lambda s: s.diff().fillna(0))
        df["vibration_roll_mean"] = g["vibration"].transform(lambda s: s.rolling(ROLL_WINDOW, min_periods=1).mean())
        df["gas_rate"] = g["gas_ppm"].transform(lambda s: s.diff().fillna(0))
        df["power_roll_mean"] = g["power_consumption"].transform(lambda s: s.rolling(ROLL_WINDOW, min_periods=1).mean())

        return df

    def _daily_incident_dataset(self, dfs: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """
        Build a daily, per-equipment training table for incident prediction by joining:
        - equipment_health (daily snapshot: health_score, RUL, last_service_days, fault_code)
        - sensor_data aggregated to daily stats per equipment
        - incident_history collapsed to a daily occurred/not-occurred label
        """
        equip = dfs.get("equipment_health", pd.DataFrame())
        sensor = dfs.get("sensor_data", pd.DataFrame())
        incidents = dfs.get("incident_history", pd.DataFrame())

        if equip.empty or sensor.empty:
            return pd.DataFrame()

        equip = equip.copy()
        equip["date"] = pd.to_datetime(equip["timestamp"]).dt.date

        sensor = sensor.copy()
        sensor["date"] = pd.to_datetime(sensor["timestamp"]).dt.date
        sensor["risk_label"] = sensor["risk_level"].map(RISK_LABEL_MAP)

        daily_sensor = sensor.groupby(["equipment_id", "date"]).agg(
            temp_mean=("temperature", "mean"),
            temp_max=("temperature", "max"),
            pressure_mean=("pressure", "mean"),
            pressure_std=("pressure", "std"),
            gas_mean=("gas_ppm", "mean"),
            gas_max=("gas_ppm", "max"),
            vibration_mean=("vibration", "mean"),
            vibration_max=("vibration", "max"),
            power_mean=("power_consumption", "mean"),
            warning_or_worse_count=("risk_label", lambda s: int((s >= 1).sum())),
        ).reset_index()

        merged = equip.merge(daily_sensor, on=["equipment_id", "date"], how="left")

        if not incidents.empty:
            inc = incidents.copy()
            inc["date"] = pd.to_datetime(inc["timestamp"]).dt.date
            daily_incidents = inc.groupby(["equipment_id", "date"]).size().reset_index(name="incident_count")
            merged = merged.merge(daily_incidents, on=["equipment_id", "date"], how="left")
        else:
            merged["incident_count"] = 0

        merged["incident_count"] = merged["incident_count"].fillna(0)
        merged["incident_occurred"] = (merged["incident_count"] > 0).astype(int)
        merged["fault_flag"] = (merged["fault_code"].fillna("NONE") != "NONE").astype(int)

        num_cols = merged.select_dtypes(include=[np.number]).columns
        merged[num_cols] = merged[num_cols].fillna(0)

        return merged

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def initialize_models(self, dfs: Dict[str, pd.DataFrame]) -> None:
        logger.info("Initializing AI models from real datasets...")
        try:
            self._train_risk_model(dfs)
            self._train_incident_model(dfs)
            self._train_anomaly_detector(dfs)
            self.models_initialized = True
        except Exception as exc:  # noqa: BLE001
            logger.error("Model initialization failed: %s", exc)

        # Populate all derived state immediately so the API has data on first request.
        self.run_batch_predictions(dfs)

    def _train_risk_model(self, dfs: Dict[str, pd.DataFrame]) -> None:
        sensor = dfs.get("sensor_data", pd.DataFrame())
        if sensor.empty or "risk_level" not in sensor.columns:
            logger.warning("sensor_data missing or has no risk_level column; risk model not trained.")
            return

        feat_df = self._engineer_sensor_features(sensor)
        feat_df["risk_label"] = feat_df["risk_level"].map(RISK_LABEL_MAP)
        feat_df = feat_df.dropna(subset=["risk_label"])

        if len(feat_df) < MIN_ROWS_TO_TRAIN_RISK:
            logger.warning("Not enough rows (%d) to train risk model.", len(feat_df))
            return

        if 0 < MAX_RISK_TRAIN_ROWS < len(feat_df):
            feat_df, _ = train_test_split(
                feat_df,
                train_size=MAX_RISK_TRAIN_ROWS,
                random_state=42,
                stratify=feat_df["risk_label"],
            )
            logger.info("Low-memory mode: sampled %d rows for risk training.", len(feat_df))

        self.gas_ppm_p95 = float(sensor["gas_ppm"].quantile(0.95))
        self.vibration_p95 = float(sensor["vibration"].quantile(0.95))

        feature_cols = SENSOR_BASE_COLS + [
            "temp_roll_mean", "pressure_delta", "vibration_roll_mean", "gas_rate", "power_roll_mean",
        ]
        self.risk_feature_cols = feature_cols

        X = feat_df[feature_cols].fillna(0)
        y = feat_df["risk_label"].astype(int)

        # Class weights derived from the actual observed label distribution (no guessing).
        class_counts = y.value_counts()
        total = len(y)
        sample_weight = y.map(lambda c: total / (len(class_counts) * class_counts[c])).values

        X_train, X_test, y_train, y_test, w_train, _ = train_test_split(
            X, y, sample_weight, test_size=0.2, random_state=42, stratify=y
        )

        model = XGBClassifier(
            n_estimators=RISK_N_ESTIMATORS,
            max_depth=6,
            learning_rate=0.1,
            objective="multi:softprob",
            num_class=3,
            eval_metric="mlogloss",
            tree_method="hist",
            random_state=42,
            n_jobs=MODEL_N_JOBS,
        )
        model.fit(X_train, y_train, sample_weight=w_train)

        preds = model.predict(X_test)
        f1_macro = float(f1_score(y_test, preds, average="macro"))

        self.risk_model = model
        self.risk_model_trained = True
        self.training_rows["risk_model"] = int(len(X))
        self.training_metrics["risk_model_f1_macro"] = round(f1_macro, 4)
        self.training_metrics["risk_model_class_distribution"] = {
            RISK_LABEL_INV[k]: int(v) for k, v in class_counts.items()
        }

        try:
            if shap is None:
                raise RuntimeError("SHAP disabled by DISABLE_SHAP")
            self.risk_explainer = shap.TreeExplainer(model)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not build SHAP explainer: %s", exc)
            self.risk_explainer = None

        logger.info("Risk model trained on %d rows, macro-F1=%.3f", len(X), f1_macro)

    def _train_incident_model(self, dfs: Dict[str, pd.DataFrame]) -> None:
        daily = self._daily_incident_dataset(dfs)
        if daily.empty or len(daily) < MIN_ROWS_TO_TRAIN_INCIDENT:
            logger.warning("Not enough daily rows (%d) to train incident model.", len(daily))
            return

        label_counts = daily["incident_occurred"].value_counts()
        if len(label_counts) < 2 or label_counts.min() < MIN_CLASS_COUNT_TO_TRAIN_INCIDENT:
            logger.warning("Incident label classes too imbalanced/sparse to train reliably: %s", label_counts.to_dict())
            return

        feature_cols = [
            "health_score", "remaining_useful_life", "last_service_days", "fault_flag",
            "temp_mean", "temp_max", "pressure_mean", "pressure_std",
            "gas_mean", "gas_max", "vibration_mean", "vibration_max",
            "power_mean", "warning_or_worse_count",
        ]
        feature_cols = [c for c in feature_cols if c in daily.columns]
        self.incident_feature_cols = feature_cols

        X = daily[feature_cols].fillna(0)
        y = daily["incident_occurred"].astype(int)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        model = XGBClassifier(
            n_estimators=INCIDENT_N_ESTIMATORS,
            max_depth=5,
            learning_rate=0.1,
            objective="binary:logistic",
            eval_metric="logloss",
            tree_method="hist",
            random_state=42,
            n_jobs=MODEL_N_JOBS,
        )
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        f1 = float(f1_score(y_test, preds))

        self.incident_model = model
        self.incident_model_trained = True
        self.training_rows["incident_model"] = int(len(X))
        self.training_metrics["incident_model_f1"] = round(f1, 4)

        logger.info("Incident model trained on %d daily rows, F1=%.3f", len(X), f1)

    def _train_anomaly_detector(self, dfs: Dict[str, pd.DataFrame]) -> None:
        sensor = dfs.get("sensor_data", pd.DataFrame())
        if sensor.empty:
            return
        X = sensor[SENSOR_BASE_COLS].fillna(0)
        if len(X) < MIN_ROWS_TO_TRAIN_RISK:
            return
        if 0 < MAX_ANOMALY_TRAIN_ROWS < len(X):
            X = X.sample(n=MAX_ANOMALY_TRAIN_ROWS, random_state=42)
            logger.info("Low-memory mode: sampled %d rows for anomaly training.", len(X))
        detector = IsolationForest(contamination=0.02, random_state=42, n_jobs=MODEL_N_JOBS)
        detector.fit(X)
        self.anomaly_detector = detector
        logger.info("Anomaly detector fit on %d sensor rows.", len(X))

    # ------------------------------------------------------------------
    # Batch predictions (called on startup + every scheduler tick)
    # ------------------------------------------------------------------

    def run_batch_predictions(self, dfs: Dict[str, pd.DataFrame]) -> None:
        sensor = dfs.get("sensor_data", pd.DataFrame())
        if sensor.empty:
            logger.warning("No sensor_data available; skipping batch predictions.")
            return

        try:
            latest_ts = sensor["timestamp"].max()
            feat_df = self._engineer_sensor_features(sensor)
            latest_snapshot = feat_df.sort_values("timestamp").drop_duplicates(subset=["equipment_id"], keep="last")

            self._update_risk_predictions(latest_snapshot, latest_ts)
            self._update_active_alerts(sensor, latest_ts)
            self._update_incident_predictions(dfs)
            self._update_compound_risks(dfs, latest_snapshot, latest_ts)
            self._update_recommendations(dfs, latest_snapshot)
            self._update_explanations(latest_snapshot)
        except Exception as exc:  # noqa: BLE001
            logger.error("Error during batch predictions: %s", exc)

    def _update_risk_predictions(self, latest_snapshot: pd.DataFrame, latest_ts) -> None:
        if not self.risk_model_trained or latest_snapshot.empty:
            self.risk_predictions = []
            self.current_risk = {"score": 0.0, "level": "Unknown", "as_of": str(latest_ts)}
            return

        X = latest_snapshot[self.risk_feature_cols].fillna(0)
        probs = self.risk_model.predict_proba(X)  # shape (n_equipment, 3)

        predictions = []
        for i, (_, row) in enumerate(latest_snapshot.iterrows()):
            p_normal, p_warning, p_critical = probs[i]
            score = round(float(p_warning * 50 + p_critical * 100), 2)
            predictions.append({
                "equipment_id": row["equipment_id"],
                "zone": row["zone"],
                "as_of": row["timestamp"].isoformat() if hasattr(row["timestamp"], "isoformat") else str(row["timestamp"]),
                "p_normal": round(float(p_normal), 4),
                "p_warning": round(float(p_warning), 4),
                "p_critical": round(float(p_critical), 4),
                "risk_score": score,
                "risk_level": "Critical" if score > 66 else "High" if score > 33 else "Medium" if score > 10 else "Low",
                "current_reading_risk_level": row.get("risk_level", "Unknown"),
            })

        self.risk_predictions = sorted(predictions, key=lambda p: p["risk_score"], reverse=True)

        overall_score = max((p["risk_score"] for p in predictions), default=0.0)
        self.current_risk = {
            "score": round(overall_score, 2),
            "level": "Critical" if overall_score > 66 else "High" if overall_score > 33 else "Medium" if overall_score > 10 else "Low",
            "as_of": str(latest_ts),
            "equipment_count": len(predictions),
        }

    def _update_active_alerts(self, sensor: pd.DataFrame, latest_ts) -> None:
        """Alerts = actual Warning/Critical sensor readings in the most recent 24-hour window."""
        window_start = latest_ts - pd.Timedelta(hours=24)
        recent = sensor[(sensor["timestamp"] > window_start) & (sensor["risk_level"] != "Normal")].copy()
        recent = recent.sort_values("timestamp", ascending=False)

        alerts = []
        for _, row in recent.head(50).iterrows():
            alerts.append({
                "id": f"{row['equipment_id']}-{row['timestamp'].isoformat()}",
                "equipment_id": row["equipment_id"],
                "zone": row["zone"],
                "severity": row["risk_level"],
                "description": (
                    f"{row['equipment_id']} reported {row['risk_level']} risk_level "
                    f"(gas_ppm={row['gas_ppm']:.2f}, vibration={row['vibration']:.2f}, "
                    f"temperature={row['temperature']:.1f})"
                ),
                "timestamp": row["timestamp"].isoformat(),
            })
        self.active_alerts = alerts

    def _update_incident_predictions(self, dfs: Dict[str, pd.DataFrame]) -> None:
        if not self.incident_model_trained:
            self.incident_predictions = []
            return

        daily = self._daily_incident_dataset(dfs)
        if daily.empty:
            self.incident_predictions = []
            return

        latest_day = daily.sort_values("date").drop_duplicates(subset=["equipment_id"], keep="last")
        X = latest_day[self.incident_feature_cols].fillna(0)
        probs = self.incident_model.predict_proba(X)[:, 1]

        predictions = []
        for i, (_, row) in enumerate(latest_day.iterrows()):
            predictions.append({
                "equipment_id": row["equipment_id"],
                "zone": row.get("zone", "Unknown"),
                "date": str(row["date"]),
                "incident_probability": round(float(probs[i]) * 100, 2),
                "health_score": float(row.get("health_score", 0)),
                "remaining_useful_life": float(row.get("remaining_useful_life", 0)),
                "recent_warning_count": int(row.get("warning_or_worse_count", 0)),
            })

        self.incident_predictions = sorted(
            [p for p in predictions if p["incident_probability"] >= 40],
            key=lambda p: p["incident_probability"],
            reverse=True,
        )

    def _update_compound_risks(self, dfs: Dict[str, pd.DataFrame], latest_snapshot: pd.DataFrame, latest_ts) -> None:
        """
        Compound risk = elevated sensor reading (data-driven threshold, not the exact instant reading)
        AND an open permit for that equipment/zone AND workers currently present and working in that zone.
        """
        self.compound_risks = []
        permit_df = dfs.get("permit_log", pd.DataFrame())
        worker_df = dfs.get("worker_location", pd.DataFrame())

        if latest_snapshot.empty or permit_df.empty or worker_df.empty:
            return
        if self.gas_ppm_p95 <= 0:
            return

        elevated = latest_snapshot[
            (latest_snapshot["gas_ppm"] >= self.gas_ppm_p95)
            | (latest_snapshot["vibration"] >= self.vibration_p95)
            | (latest_snapshot["risk_level"] != "Normal")
        ]
        if elevated.empty:
            return

        open_permits = permit_df[permit_df["status"] == "Open"]
        latest_workers = worker_df.sort_values("timestamp").drop_duplicates(subset=["worker_id"], keep="last")
        working_now = latest_workers[latest_workers["working"] == "Yes"]

        for _, eq_row in elevated.iterrows():
            zone = eq_row["zone"]
            equipment_id = eq_row["equipment_id"]

            zone_permits = open_permits[
                (open_permits["zone"] == zone) | (open_permits["equipment_id"] == equipment_id)
            ]
            if zone_permits.empty:
                continue

            zone_workers = working_now[working_now["zone"] == zone]
            if zone_workers.empty:
                continue

            factors = []
            if eq_row["gas_ppm"] >= self.gas_ppm_p95:
                factors.append(f"Gas PPM {eq_row['gas_ppm']:.2f} at/above p95 threshold {self.gas_ppm_p95:.2f}")
            if eq_row["vibration"] >= self.vibration_p95:
                factors.append(f"Vibration {eq_row['vibration']:.2f} at/above p95 threshold {self.vibration_p95:.2f}")
            if eq_row["risk_level"] != "Normal":
                factors.append(f"Sensor risk_level = {eq_row['risk_level']}")
            factors.append(f"{len(zone_permits)} open permit(s) active in zone")
            factors.append(f"{len(zone_workers)} worker(s) currently working in zone")

            self.compound_risks.append({
                "id": f"CR-{equipment_id}-{zone}",
                "equipment_id": equipment_id,
                "zone": zone,
                "severity": "Critical",
                "factors": factors,
                "permit_ids": zone_permits["permit_id"].tolist(),
                "worker_count": int(len(zone_workers)),
                "description": f"Elevated risk at {equipment_id} in {zone} coincides with active permits and worker presence.",
                "as_of": str(latest_ts),
            })

    def _update_recommendations(self, dfs: Dict[str, pd.DataFrame], latest_snapshot: pd.DataFrame) -> None:
        recs: List[Dict[str, Any]] = []

        # 1) Compound risks -> highest priority, evacuate/stop work
        for cr in self.compound_risks:
            recs.append({
                "priority": "Critical",
                "reason": cr["description"],
                "action": "Suspend permit-based work and evacuate non-essential personnel",
                "affected_equipment": cr["equipment_id"],
                "affected_zone": cr["zone"],
            })

        # 2) High incident-probability equipment -> preventive maintenance
        for ip in self.incident_predictions[:5]:
            if ip["incident_probability"] >= 60:
                recs.append({
                    "priority": "High",
                    "reason": (
                        f"{ip['equipment_id']} has a {ip['incident_probability']:.1f}% predicted incident "
                        f"probability (health_score={ip['health_score']:.1f}, "
                        f"RUL={ip['remaining_useful_life']:.0f} days)."
                    ),
                    "action": "Schedule preventive maintenance and inspect before next shift",
                    "affected_equipment": ip["equipment_id"],
                    "affected_zone": ip["zone"],
                })

        # 3) Equipment health / fault codes from equipment_health.csv directly
        equip = dfs.get("equipment_health", pd.DataFrame())
        if not equip.empty:
            latest_health = equip.sort_values("timestamp").drop_duplicates(subset=["equipment_id"], keep="last")
            for _, row in latest_health.iterrows():
                if row.get("fault_code", "NONE") != "NONE":
                    recs.append({
                        "priority": "High",
                        "reason": f"{row['equipment_id']} reports active fault code {row['fault_code']}.",
                        "action": "Dispatch maintenance technician to clear fault",
                        "affected_equipment": row["equipment_id"],
                        "affected_zone": row["zone"],
                    })
                elif row.get("health_score", 100) < 80:
                    recs.append({
                        "priority": "Medium",
                        "reason": f"{row['equipment_id']} health score has degraded to {row['health_score']:.1f}.",
                        "action": "Add to next preventive maintenance cycle",
                        "affected_equipment": row["equipment_id"],
                        "affected_zone": row["zone"],
                    })

        # 4) Worker PPE compliance, from worker_location.csv directly
        worker_df = dfs.get("worker_location", pd.DataFrame())
        if not worker_df.empty:
            latest_workers = worker_df.sort_values("timestamp").drop_duplicates(subset=["worker_id"], keep="last")
            for zone, g in latest_workers.groupby("zone"):
                non_compliant = g[(g["helmet"] == "No") | (g["safety_vest"] == "No")]
                if len(non_compliant) > 0:
                    recs.append({
                        "priority": "Medium",
                        "reason": f"{len(non_compliant)} worker(s) in {zone} missing required PPE (helmet/vest).",
                        "action": "Notify safety officer to enforce PPE compliance",
                        "affected_equipment": None,
                        "affected_zone": zone,
                    })

        # 5) Weather-driven heat stress, from weather_data.csv directly
        weather_df = dfs.get("weather_data", pd.DataFrame())
        if not weather_df.empty:
            latest_weather = weather_df.sort_values("timestamp").iloc[-1]
            heat_p90 = float(weather_df["heat_index"].quantile(0.90))
            if latest_weather["heat_index"] >= heat_p90:
                recs.append({
                    "priority": "Medium",
                    "reason": f"Current heat index {latest_weather['heat_index']:.1f} is at/above the 90th percentile ({heat_p90:.1f}).",
                    "action": "Enforce hydration breaks and reduce outdoor exposure time",
                    "affected_equipment": None,
                    "affected_zone": "All outdoor zones",
                })

        if not recs:
            recs.append({
                "priority": "Low",
                "reason": "No elevated risk factors detected in the latest data.",
                "action": "Continue routine inspection schedule",
                "affected_equipment": None,
                "affected_zone": "All zones",
            })

        priority_rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        self.recommendations = sorted(recs, key=lambda r: priority_rank.get(r["priority"], 9))

    def _update_explanations(self, latest_snapshot: pd.DataFrame) -> None:
        self.explanations = {}
        if self.risk_explainer is None or latest_snapshot.empty:
            return

        X = latest_snapshot[self.risk_feature_cols].fillna(0)
        try:
            shap_values = self.risk_explainer.shap_values(X)
        except Exception as exc:  # noqa: BLE001
            logger.warning("SHAP computation failed: %s", exc)
            return

        # xgboost multiclass SHAP output can be (n_classes, n_samples, n_features) or a list of arrays.
        if isinstance(shap_values, list):
            per_class = shap_values
        elif isinstance(shap_values, np.ndarray) and shap_values.ndim == 3:
            per_class = [shap_values[:, :, c] for c in range(shap_values.shape[2])]
        else:
            per_class = [shap_values]

        expected_value = self.risk_explainer.expected_value
        if not isinstance(expected_value, (list, np.ndarray)):
            expected_value = [expected_value]

        for i, (_, row) in enumerate(latest_snapshot.iterrows()):
            equipment_id = row["equipment_id"]
            # Explain the "Critical" class (index 2) if available, else the last available class.
            class_idx = min(2, len(per_class) - 1)
            vals = per_class[class_idx][i]
            importance = {feat: round(float(v), 4) for feat, v in zip(self.risk_feature_cols, vals)}
            top_features = sorted(importance.items(), key=lambda kv: abs(kv[1]), reverse=True)[:5]

            self.explanations[equipment_id] = {
                "equipment_id": equipment_id,
                "explained_class": "Critical" if class_idx == 2 else RISK_LABEL_INV.get(class_idx, "Unknown"),
                "base_value": float(expected_value[class_idx]) if class_idx < len(expected_value) else float(expected_value[0]),
                "feature_importance": importance,
                "top_contributing_factors": [
                    {"feature": feat, "shap_value": val} for feat, val in top_features
                ],
            }

    # ------------------------------------------------------------------
    # Read-only accessors used by backend.py
    # ------------------------------------------------------------------

    def get_overall_risk(self) -> Dict[str, Any]:
        return self.current_risk

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        return self.active_alerts

    def get_risk_predictions(self) -> List[Dict[str, Any]]:
        return self.risk_predictions

    def get_incident_predictions(self) -> List[Dict[str, Any]]:
        return self.incident_predictions

    def get_compound_risks(self) -> List[Dict[str, Any]]:
        return self.compound_risks

    def get_recommendations(self) -> List[Dict[str, Any]]:
        return self.recommendations

    def explain_equipment(self, equipment_id: str) -> Dict[str, Any]:
        return self.explanations.get(equipment_id, {})

    def get_model_status(self) -> Dict[str, Any]:
        return {
            "models_initialized": self.models_initialized,
            "risk_model_trained": self.risk_model_trained,
            "incident_model_trained": self.incident_model_trained,
            "training_rows": self.training_rows,
            "training_metrics": self.training_metrics,
            "data_driven_thresholds": {
                "gas_ppm_p95": round(self.gas_ppm_p95, 3),
                "vibration_p95": round(self.vibration_p95, 3),
            },
        }

    def get_incident_analytics(self, dfs: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """Aggregate incident_history for the Analytics/Reports page."""
        incidents = dfs.get("incident_history", pd.DataFrame())
        if incidents.empty:
            return {}

        df = incidents.copy()
        df["month"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m")

        by_month = df.groupby("month").size().reset_index(name="count").to_dict(orient="records")
        by_zone = df.groupby("zone").size().reset_index(name="count").to_dict(orient="records")
        by_type = df.groupby("incident_type").size().reset_index(name="count").to_dict(orient="records")
        by_severity = df.groupby("severity").size().reset_index(name="count").to_dict(orient="records")
        by_root_cause = df.groupby("root_cause").size().reset_index(name="count").to_dict(orient="records")
        total_injuries = int(df["injuries"].sum())

        return {
            "total_incidents": int(len(df)),
            "total_injuries": total_injuries,
            "by_month": by_month,
            "by_zone": by_zone,
            "by_type": by_type,
            "by_severity": by_severity,
            "by_root_cause": by_root_cause,
        }
