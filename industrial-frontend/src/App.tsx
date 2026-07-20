import { useState } from "react";

import {
  AppBar,
  Avatar,
  Badge,
  Box,
  IconButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";

import NotificationsIcon from "@mui/icons-material/Notifications";
import RefreshIcon from "@mui/icons-material/Refresh";

import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import SensorTable from "./components/SensorTable";
import AlertsTable from "./components/AlertsTable";
import EquipmentTable from "./components/EquipmentTable";
import WorkersTable from "./components/WorkersTable";
import IncidentsTable from "./components/IncidentsTable";
import MaintenanceTable from "./components/MaintenanceTable";
import PredictionsTable from "./components/PredictionsTable";
import Settings from "./components/Settings";
import { useDashboard } from "./hooks";

export default function App() {
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(10);

  const { loading, error, data, lastUpdated, refresh } = useDashboard(
    refreshIntervalSec > 0 ? refreshIntervalSec * 1000 : 0
  );

  const [section, setSection] = useState("Dashboard");
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);

  const alertCount = data.alerts?.length ?? 0;

  let content;

  switch (section) {
    case "Sensors":
      content = <SensorTable loading={loading} sensors={data.sensors} />;
      break;

    case "Alerts":
      content = <AlertsTable loading={loading} alerts={data.alerts} />;
      break;

    case "Equipment":
      content = <EquipmentTable loading={loading} equipment={data.equipment} />;
      break;

    case "Workers":
      content = <WorkersTable loading={loading} workers={data.workers} />;
      break;

    case "Analytics":
      content = (
        <Box>
          <IncidentsTable loading={loading} incidents={data.incidents} />
          <MaintenanceTable loading={loading} maintenance={data.maintenance} />
        </Box>
      );
      break;

    case "AI Insights":
      content = (
        <PredictionsTable loading={loading} predictions={data.predictions} />
      );
      break;

    case "Settings":
      content = (
        <Settings
          refreshIntervalSec={refreshIntervalSec}
          onChangeRefreshInterval={setRefreshIntervalSec}
        />
      );
      break;

    case "Dashboard":
      content = (
        <Dashboard
          loading={loading}
          error={error}
          data={data}
          onNavigate={setSection}
          refresh={refresh}
          lastUpdated={lastUpdated}
        />
      );
      break;

    default:
      content = (
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
          <Typography variant="h6" fontWeight="bold">
            {section}
          </Typography>
          <Typography color="text.secondary" mt={1}>
            This section isn't built yet.
          </Typography>
        </Paper>
      );
  }

  return (
    <Box sx={{ display: "flex", bgcolor: "background.default", minHeight: "100vh" }}>

      <Sidebar selected={section} onSelect={setSection} />

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>

        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            color: "text.primary",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Toolbar>

            <Typography
              variant="h5"
              fontWeight="bold"
              sx={{ flexGrow: 1, color: "#1565C0" }}
            >
              Industrial Safety Intelligence Platform
            </Typography>

            <IconButton
              color="inherit"
              onClick={() => refresh()}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>

            <IconButton
              color="inherit"
              onClick={(e) => setNotifAnchor(e.currentTarget)}
            >
              <Badge badgeContent={alertCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <Menu
              anchorEl={notifAnchor}
              open={Boolean(notifAnchor)}
              onClose={() => setNotifAnchor(null)}
            >
              {alertCount === 0 && (
                <MenuItem disabled>No active alerts</MenuItem>
              )}

              {data.alerts?.slice(0, 5).map((alert: any, i: number) => (
                <MenuItem key={i} onClick={() => setNotifAnchor(null)}>
                  <ListItemText
                    primary={alert.message ?? alert.description ?? `Alert ${i + 1}`}
                    secondary={alert.severity ?? alert.location}
                  />
                </MenuItem>
              ))}
            </Menu>

            <Avatar sx={{ ml: 2, bgcolor: "#1976D2" }}>A</Avatar>

          </Toolbar>
        </AppBar>

        <Box sx={{ p: 3 }}>
          {content}
        </Box>

      </Box>
    </Box>
  );
}