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
  predictions: any[];
}

function riskColor(level: string) {
  switch ((level || "").toLowerCase()) {
    case "critical":
      return "error";
    case "high":
      return "error";
    case "medium":
      return "warning";
    default:
      return "success";
  }
}

export default function PredictionsTable({ loading, predictions }: Props) {
  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3 }}>

      <Typography variant="h6" fontWeight="bold" mb={2}>
        AI Risk Predictions
      </Typography>

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Equipment</TableCell>
            <TableCell>Zone</TableCell>
            <TableCell align="center">Risk Score</TableCell>
            <TableCell align="center">Risk Level</TableCell>
            <TableCell align="center">P(Normal)</TableCell>
            <TableCell align="center">P(Warning)</TableCell>
            <TableCell align="center">P(Critical)</TableCell>
            <TableCell>Current Reading</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {predictions.map((pred: any, index: number) => (
            <TableRow key={pred.equipment_id ?? index} hover>
              <TableCell>{pred.equipment_id ?? `E-${index + 1}`}</TableCell>
              <TableCell>{pred.zone ?? "-"}</TableCell>
              <TableCell align="center">{pred.risk_score ?? "-"}</TableCell>

              <TableCell align="center">
                <Chip
                  label={pred.risk_level ?? "-"}
                  color={riskColor(pred.risk_level)}
                  size="small"
                />
              </TableCell>

              <TableCell align="center">{pred.p_normal ?? "-"}</TableCell>
              <TableCell align="center">{pred.p_warning ?? "-"}</TableCell>
              <TableCell align="center">{pred.p_critical ?? "-"}</TableCell>
              <TableCell>{pred.current_reading_risk_level ?? "-"}</TableCell>
            </TableRow>
          ))}

          {predictions.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center">
                No predictions available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>

      </Table>

    </Paper>
  );
}
