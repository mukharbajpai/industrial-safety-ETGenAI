Replace backend.py and ai_engine.py with these files.

Folder:
project/
  backend.py
  ai_engine.py
  data/
    sensor_data.csv
    worker_location.csv
    permit_log.csv
    equipment_health.csv
    incident_history.csv
    weather_data.csv
    maintenance_schedule.csv
    plant_layout.json

Install:
pip install fastapi uvicorn pandas numpy scikit-learn xgboost shap

Run:
python backend.py

Swagger:
http://localhost:8000/docs
