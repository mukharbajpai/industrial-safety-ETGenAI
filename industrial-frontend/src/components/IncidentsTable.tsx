import {
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

interface Props {
  loading: boolean;
  incidents: any[];
}

function severityColor(severity: string) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
    case "high":
      return "error";
    case "warning":
    case "medium":
      return "warning";
    default:
      return "default";
  }
}

export default function IncidentsTable({ loading, incidents }: Props) {
  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3 }}>

      <Typography variant="h6" fontWeight="bold" mb={2}>
        Incident History
      </Typography>

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Incident</TableCell>
            <TableCell>Zone</TableCell>
            <TableCell>Equipment</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="center">Severity</TableCell>
            <TableCell align="center">Injuries</TableCell>
            <TableCell>Root Cause</TableCell>
            <TableCell>Time</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {incidents.slice(0, 50).map((incident: any, index: number) => (
            <TableRow key={incident.incident_id ?? index} hover>
              <TableCell>{incident.incident_id ?? `I-${index + 1}`}</TableCell>
              <TableCell>{incident.zone ?? "-"}</TableCell>
              <TableCell>{incident.equipment_id ?? "-"}</TableCell>
              <TableCell>{incident.incident_type ?? "-"}</TableCell>

              <TableCell align="center">
                <Chip
                  label={incident.severity ?? "-"}
                  color={severityColor(incident.severity)}
                  size="small"
                />
              </TableCell>

              <TableCell align="center">{incident.injuries ?? 0}</TableCell>
              <TableCell>{incident.root_cause ?? "-"}</TableCell>
              <TableCell>{incident.timestamp ?? "-"}</TableCell>
            </TableRow>
          ))}

          {incidents.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                No incident data available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>

      </Table>

    </Paper>
  );
}
