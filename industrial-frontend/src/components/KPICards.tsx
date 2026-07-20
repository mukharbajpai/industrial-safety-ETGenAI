import {
  Box,
  ButtonBase,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from "@mui/material";

import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SensorsIcon from "@mui/icons-material/Sensors";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";

import { getRiskColor } from "../Utils";

interface Props {
  loading: boolean;
  risk: any;
  alerts: any[];
  sensors: any[];
  equipment: any[];
  onNavigate?: (section: string) => void;
}

const colorMap: Record<string, string> = {
  success: "#2e7d32",
  warning: "#ed6c02",
  error: "#d32f2f",
};

function Card({
  icon,
  label,
  value,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={{
        width: "100%",
        borderRadius: 3,
        textAlign: "left",
        display: "block",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",

        "&:hover": onClick
          ? {
              transform: "translateY(-2px)",
              boxShadow: 3,
            }
          : undefined,
      }}
    >
      <Paper
        sx={{
          p: 2.5,
          borderRadius: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
          height: "100%",
          width: "100%",
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            bgcolor: `${accent}22`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>

        <Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>

          <Typography variant="h5" fontWeight="bold">
            {value}
          </Typography>
        </Box>
      </Paper>
    </ButtonBase>
  );
}

export default function KPICards({
  loading,
  risk,
  alerts,
  sensors,
  equipment,
  onNavigate,
}: Props) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  const riskValue =
    typeof risk === "number"
      ? risk
      : risk?.score ?? risk?.overall_risk ?? risk?.risk ?? 0;

  const riskAccent = colorMap[getRiskColor(Number(riskValue) || 0)];

  const activeAlertsCount = alerts?.length ?? 0;
  const sensorsOnlineCount = sensors?.length ?? 0;
  const equipmentCount = equipment?.length ?? 0;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={6} md={3}>
        <Card
          icon={<WarningAmberIcon />}
          label="Overall Risk"
          value={`${riskValue}%`}
          accent={riskAccent}
          onClick={onNavigate ? () => onNavigate("AI Insights") : undefined}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card
          icon={<NotificationsActiveIcon />}
          label="Active Alerts"
          value={activeAlertsCount}
          accent={activeAlertsCount > 0 ? colorMap.error : colorMap.success}
          onClick={onNavigate ? () => onNavigate("Alerts") : undefined}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card
          icon={<SensorsIcon />}
          label="Live Sensors"
          value={sensorsOnlineCount}
          accent={colorMap.success}
          onClick={onNavigate ? () => onNavigate("Sensors") : undefined}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card
          icon={<PrecisionManufacturingIcon />}
          label="Equipment"
          value={equipmentCount}
          accent="#1976d2"
          onClick={onNavigate ? () => onNavigate("Equipment") : undefined}
        />
      </Grid>
    </Grid>
  );
}