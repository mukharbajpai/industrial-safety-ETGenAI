import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import SensorsIcon from "@mui/icons-material/Sensors";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import EngineeringIcon from "@mui/icons-material/Engineering";
import PsychologyIcon from "@mui/icons-material/Psychology";
import SettingsIcon from "@mui/icons-material/Settings";

const drawerWidth = 250;

const menuItems = [
  { title: "Dashboard", icon: <DashboardIcon /> },
  { title: "Analytics", icon: <AnalyticsIcon /> },
  { title: "Sensors", icon: <SensorsIcon /> },
  { title: "Equipment", icon: <PrecisionManufacturingIcon /> },
  { title: "Workers", icon: <EngineeringIcon /> },
  { title: "AI Insights", icon: <PsychologyIcon /> },
  { title: "Alerts", icon: <WarningAmberIcon /> },
  { title: "Settings", icon: <SettingsIcon /> },
];

interface Props {
  selected: string;
  onSelect: (title: string) => void;
}

export default function Sidebar({ selected, onSelect }: Props) {
  return (
    <Box
      sx={{
        width: drawerWidth,
        minHeight: "100vh",
        bgcolor: "#0F172A",
        color: "white",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #1E293B",
      }}
    >
      <Toolbar sx={{ justifyContent: "center", py: 2 }}>
        <Typography variant="h5" fontWeight="bold" color="#4FC3F7">
          Safety AI
        </Typography>
      </Toolbar>

      <Divider sx={{ bgcolor: "#334155" }} />

      <List sx={{ px: 1, mt: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.title}
            selected={selected === item.title}
            onClick={() => onSelect(item.title)}
            sx={{
              borderRadius: 2,
              mb: 1,
              color: "#E2E8F0",

              "&:hover": {
                bgcolor: "#1E293B",
              },

              "&.Mui-selected": {
                bgcolor: "#1976D2",
              },

              "&.Mui-selected:hover": {
                bgcolor: "#1565C0",
              },
            }}
          >
            <ListItemIcon
              sx={{
                color: "#64B5F6",
                minWidth: 42,
              }}
            >
              {item.icon}
            </ListItemIcon>

            <ListItemText primary={item.title} />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider sx={{ bgcolor: "#334155" }} />

      <Box p={2}>
        <Typography variant="body2" color="#94A3B8">
          Industrial Safety
        </Typography>

        <Typography variant="caption" color="#64748B">
          AI Intelligence Platform
        </Typography>
      </Box>
    </Box>
  );
}