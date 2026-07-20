import {
  Box,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Typography,
} from "@mui/material";

import { useColorMode } from "../Themecontext";

interface Props {
  refreshIntervalSec: number;
  onChangeRefreshInterval: (seconds: number) => void;
}

const INTERVAL_OPTIONS = [
  { label: "5 seconds", value: 5 },
  { label: "10 seconds", value: 10 },
  { label: "30 seconds", value: 30 },
  { label: "60 seconds", value: 60 },
  { label: "Off (manual only)", value: 0 },
];

export default function Settings({
  refreshIntervalSec,
  onChangeRefreshInterval,
}: Props) {
  const { mode, toggleMode } = useColorMode();

  return (
    <Paper sx={{ p: 3, borderRadius: 3, maxWidth: 480 }}>

      <Typography variant="h6" fontWeight="bold" mb={1}>
        Settings
      </Typography>

      <Typography variant="body2" color="text.secondary" mb={3}>
        These preferences apply to this browser session only.
      </Typography>

      <Box mb={3}>
        <FormControlLabel
          control={
            <Switch
              checked={mode === "dark"}
              onChange={toggleMode}
            />
          }
          label="Dark mode"
        />
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box>
        <Typography variant="body1" fontWeight="bold" mb={1}>
          Dashboard auto-refresh
        </Typography>

        <Select
          size="small"
          value={refreshIntervalSec}
          onChange={(e) => onChangeRefreshInterval(Number(e.target.value))}
          sx={{ minWidth: 220 }}
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>

        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Controls how often live data is re-fetched from the backend.
        </Typography>
      </Box>

    </Paper>
  );
}