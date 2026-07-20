import {
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box,
} from "@mui/material";

interface Props {
  loading: boolean;
  equipment: any[];
}

function healthColor(score: number) {
  if (score < 40) return "error";
  if (score < 70) return "warning";
  return "success";
}

export default function EquipmentTable({ loading, equipment }: Props) {
  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3 }}>

      <Typography variant="h6" fontWeight="bold" mb={2}>
        Equipment Health
      </Typography>

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Equipment</TableCell>
            <TableCell>Zone</TableCell>
            <TableCell align="center">Health Score</TableCell>
            <TableCell align="center">Remaining Life (days)</TableCell>
            <TableCell align="center">Last Service (days ago)</TableCell>
            <TableCell align="center">Maintenance Due</TableCell>
            <TableCell align="center">Fault Code</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {equipment.map((eq: any, index: number) => {
            const score = Number(eq.health_score ?? 0);

            return (
              <TableRow key={eq.equipment_id ?? index} hover>
                <TableCell>{eq.equipment_id ?? `E-${index + 1}`}</TableCell>
                <TableCell>{eq.zone ?? "-"}</TableCell>

                <TableCell align="center">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Box sx={{ width: 80 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, Math.max(0, score))}
                        color={healthColor(score)}
                      />
                    </Box>
                    {score.toFixed(0)}%
                  </Box>
                </TableCell>

                <TableCell align="center">
                  {eq.remaining_useful_life ?? "-"}
                </TableCell>

                <TableCell align="center">
                  {eq.last_service_days ?? "-"}
                </TableCell>

                <TableCell align="center">
                  <Chip
                    label={eq.maintenance_due ? "Yes" : "No"}
                    color={eq.maintenance_due ? "warning" : "success"}
                    size="small"
                  />
                </TableCell>

                <TableCell align="center">
                  {eq.fault_code ?? "None"}
                </TableCell>
              </TableRow>
            );
          })}

          {equipment.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                No equipment data available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>

      </Table>

    </Paper>
  );
}
