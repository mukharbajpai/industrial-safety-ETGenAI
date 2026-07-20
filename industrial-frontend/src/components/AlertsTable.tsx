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
  alerts: any[];
}

function getChipColor(severity: string) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "error";
    case "high":
      return "error";
    case "warning":
      return "warning";
    case "medium":
      return "warning";
    case "normal":
      return "success";
    case "low":
      return "success";
    default:
      return "default";
  }
}

export default function AlertsTable({
  loading,
  alerts,
}: Props) {

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper
      sx={{
        mt: 3,
        p: 2,
        borderRadius: 3,
      }}
    >
      <Typography
        variant="h6"
        fontWeight="bold"
        mb={2}
      >
        Active Alerts
      </Typography>

      <Table>

        <TableHead>

          <TableRow>

            <TableCell>ID</TableCell>

            <TableCell>Equipment</TableCell>

            <TableCell>Alert</TableCell>

            <TableCell align="center">
              Severity
            </TableCell>

            <TableCell align="center">
              Confidence
            </TableCell>

            <TableCell>
              Time
            </TableCell>

          </TableRow>

        </TableHead>

        <TableBody>

          {alerts.map((alert: any, index) => {

            const severity =
              alert.severity ??
              alert.level ??
              "Unknown";

            return (
              <TableRow
                key={alert.id ?? index}
                hover
              >
                <TableCell>
                  {alert.id ??
                    `ALT-${index + 1}`}
                </TableCell>

                <TableCell>
                  {alert.equipment ??
                    alert.equipment_name ??
                    alert.machine ??
                    "-"}
                </TableCell>

                <TableCell>
                  {alert.message ??
                    alert.description ??
                    alert.alert ??
                    "-"}
                </TableCell>

                <TableCell align="center">

                  <Chip
                    label={severity}
                    color={getChipColor(severity)}
                  />

                </TableCell>

                <TableCell align="center">
                  {alert.confidence ??
                    alert.ai_confidence ??
                    "-"}
                  {alert.confidence ||
                  alert.ai_confidence
                    ? "%"
                    : ""}
                </TableCell>

                <TableCell>
                  {alert.timestamp ??
                    alert.time ??
                    alert.created_at ??
                    "-"}
                </TableCell>

              </TableRow>
            );

          })}

          {alerts.length === 0 && (
            <TableRow>

              <TableCell
                colSpan={6}
                align="center"
              >
                No active alerts.
              </TableCell>

            </TableRow>
          )}

        </TableBody>

      </Table>

    </Paper>
  );
}