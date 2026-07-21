import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;

/* ---------------- Dashboard ---------------- */

export const getOverallRisk = () =>
  api.get("/dashboard/overall-risk");

export const getActiveAlerts = () =>
  api.get("/dashboard/active-alerts");

/* ---------------- Sensors ---------------- */

export const getLiveSensors = () =>
  api.get("/sensors/live");

/* ---------------- Equipment ---------------- */

export const getEquipment = () =>
  api.get("/equipment");

/* ---------------- Workers ---------------- */

export const getWorkers = () =>
  api.get("/workers");

/* ---------------- Weather ---------------- */

export const getWeather = () =>
  api.get("/weather/latest");

/* ---------------- Incidents ---------------- */

export const getIncidents = () =>
  api.get("/incidents");

/* ---------------- Maintenance ---------------- */

export const getMaintenance = () =>
  api.get("/maintenance");

/* ---------------- AI ---------------- */

export const getPredictions = () =>
  api.get("/ai/risk-predictions");

export const getRecommendations = () =>
  api.get("/ai/recommendations");

export const explainEquipment = (id: number | string) =>
  api.get(`/ai/explain/${id}`);
