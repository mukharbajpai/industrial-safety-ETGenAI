import { useEffect, useState } from "react";

import {
  getOverallRisk,
  getActiveAlerts,
  getLiveSensors,
  getEquipment,
  getWorkers,
  getWeather,
  getIncidents,
  getMaintenance,
  getPredictions,
  getRecommendations,
} from "./api";

export interface DashboardData {
  risk: any;
  alerts: any[];
  sensors: any[];
  equipment: any[];
  workers: any[];
  weather: any;
  incidents: any[];
  maintenance: any[];
  predictions: any[];
  recommendations: any[];
}

export function useDashboard(refreshIntervalMs: number = 10000) {
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [data, setData] = useState<DashboardData>({
    risk: null,
    alerts: [],
    sensors: [],
    equipment: [],
    workers: [],
    weather: null,
    incidents: [],
    maintenance: [],
    predictions: [],
    recommendations: [],
  });

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [
        risk,
        alerts,
        sensors,
        equipment,
        workers,
        weather,
        incidents,
        maintenance,
        predictions,
        recommendations,
      ] = await Promise.all([
        getOverallRisk(),
        getActiveAlerts(),
        getLiveSensors(),
        getEquipment(),
        getWorkers(),
        getWeather(),
        getIncidents(),
        getMaintenance(),
        getPredictions(),
        getRecommendations(),
      ]);

      setData({
        risk: risk.data,
        alerts: alerts.data,
        sensors: sensors.data,
        equipment: equipment.data,
        workers: workers.data,
        weather: weather.data,
        incidents: incidents.data,
        maintenance: maintenance.data,
        predictions: predictions.data,
        recommendations: recommendations.data,
      });

      setError("");
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);

      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Unable to connect to backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    if (refreshIntervalMs <= 0) {
      return;
    }

    const interval = setInterval(loadDashboard, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [refreshIntervalMs]);

  return {
    loading,
    error,
    data,
    lastUpdated,
    refresh: loadDashboard,
  };
}