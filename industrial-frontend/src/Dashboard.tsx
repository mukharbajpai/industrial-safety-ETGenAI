import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";

import KPICards from "./components/KPICards";
import SensorTable from "./components/SensorTable";
import AlertsTable from "./components/AlertsTable";
import Charts from "./Charts";
import { DashboardData } from "./hooks";

interface Props {
  loading: boolean;
  error: string;
  data: DashboardData;
  onNavigate: (section: string) => void;
  refresh: () => void;
  lastUpdated: Date | null;
}

function levelChipColor(level: string): "success" | "warning" | "error" {
  switch ((level ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "error";
    case "medium":
    case "warning":
      return "warning";
    default:
      return "success";
  }
}

export default function Dashboard({
  loading,
  error,
  data,
  onNavigate,
  refresh,
  lastUpdated,
}: Props) {

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const topRisks = [...data.predictions]
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, 5);

  const recentIncidents = [...data.incidents]
    .sort(
      (a, b) =>
        new Date(b.timestamp ?? 0).getTime() -
        new Date(a.timestamp ?? 0).getTime()
    )
    .slice(0, 5);

  return (
    <Box>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={1}
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          Industrial Safety Dashboard
        </Typography>

        <Box display="flex" alignItems="center" gap={1}>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}

          <IconButton size="small" onClick={refresh} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <KPICards
        loading={loading}
        risk={data.risk}
        alerts={data.alerts}
        sensors={data.sensors}
        equipment={data.equipment}
        onNavigate={onNavigate}
      />

      <Box mt={3} />

      <Grid container spacing={3}>

        <Grid item xs={12}>
          <Charts
            sensors={data.sensors}
            predictions={data.predictions}
          />
        </Grid>

        <Grid item xs={12} md={8}>

          <Grid container spacing={3}>

            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
                <Typography variant="h6" fontWeight="bold" mb={1}>
                  Top At-Risk Equipment
                </Typography>

                <List dense>
                  {topRisks.length === 0 && (
                    <Typography color="text.secondary">
                      No risk predictions available.
                    </Typography>
                  )}

                  {topRisks.map((pred: any, index: number) => (
                    <ListItemButton
                      key={pred.equipment_id ?? index}
                      onClick={() => onNavigate("AI Insights")}
                      sx={{ borderRadius: 2, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={`${pred.equipment_id ?? "Unknown"} — ${pred.zone ?? ""}`}
                        secondary={`Risk score: ${pred.risk_score ?? "-"}`}
                      />

                      <Chip
                        label={pred.risk_level ?? "-"}
                        size="small"
                        color={levelChipColor(pred.risk_level)}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Paper sx={{ p: 3, borderRadius: 3, height: "100%" }}>
                <Typography variant="h6" fontWeight="bold" mb={1}>
                  Recent Incidents
                </Typography>

                {recentIncidents.length === 0 && (
                  <Typography color="text.secondary">
                    No recent incidents.
                  </Typography>
                )}

                <List dense>
                  {recentIncidents.map((incident: any, index: number) => (
                    <ListItemButton
                      key={incident.incident_id ?? index}
                      onClick={() => onNavigate("Analytics")}
                      sx={{ borderRadius: 2, mb: 0.5 }}
                    >
                      <ListItemText
                        primary={incident.incident_type ?? "Incident"}
                        secondary={`${incident.zone ?? "-"} · ${incident.timestamp ?? "-"}`}
                      />

                      <Chip
                        label={incident.severity ?? "-"}
                        size="small"
                        color={levelChipColor(incident.severity)}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            </Grid>

          </Grid>

        </Grid>

        <Grid item xs={12} md={4}>

          <Paper
            sx={{
              p: 3,
              borderRadius: 3,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >

            <Typography
              variant="h6"
              fontWeight="bold"
              mb={2}
            >
              AI Recommendations
            </Typography>

            <Box
              sx={{
                maxHeight: 320,
                overflowY: "auto",
                pr: 1,
              }}
            >
              {data.recommendations.length === 0 && (
                <Typography>
                  No recommendations available.
                </Typography>
              )}

              {data.recommendations.map(
                (rec: any, index: number) => {

                  const priority = (rec.priority ?? "").toLowerCase();

                  const severity =
                    priority === "high" || priority === "critical"
                      ? "error"
                      : priority === "medium"
                      ? "warning"
                      : "info";

                  const zoneOrEquipment =
                    rec.affected_zone ?? rec.affected_equipment;

                  return (
                    <Alert
                      key={index}
                      severity={severity}
                      sx={{ mb: 2 }}
                    >
                      <Typography variant="body2" fontWeight="bold">
                        {rec.reason ??
                          rec.message ??
                          rec.recommendation ??
                          "Recommendation"}
                      </Typography>

                      {rec.action && (
                        <Typography variant="body2">
                          Action: {rec.action}
                        </Typography>
                      )}

                      {zoneOrEquipment && (
                        <Typography variant="caption" color="text.secondary">
                          {zoneOrEquipment}
                        </Typography>
                      )}
                    </Alert>
                  );
                }
              )}
            </Box>

            <Box mt={3} />

            <Typography
              variant="h6"
              fontWeight="bold"
              mb={2}
            >
              Weather
            </Typography>

            {data.weather ? (
              <>

                <Typography>
                  Temperature :
                  {" "}
                  {data.weather.temperature ??
                    data.weather.temp ??
                    data.weather.temperature_outside ??
                    "-"}
                  °C
                </Typography>

                <Typography>
                  Humidity :
                  {" "}
                  {data.weather.humidity ??
                    data.weather.humidity_outside ??
                    "-"}%
                </Typography>

                <Typography>
                  Wind :
                  {" "}
                  {data.weather.wind_speed ??
                    data.weather.wind ??
                    "-"}
                </Typography>

              </>
            ) : (
              <Typography>
                Weather unavailable
              </Typography>
            )}

          </Paper>

        </Grid>

      </Grid>

      <Box mt={3} />

      <SensorTable
        loading={loading}
        sensors={data.sensors}
      />

      <AlertsTable
        loading={loading}
        alerts={data.alerts}
      />

    </Box>
  );
}