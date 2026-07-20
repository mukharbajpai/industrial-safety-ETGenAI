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
  workers: any[];
}

function yesNoChip(value: any) {
  const isYes = String(value).toLowerCase() === "yes";

  return (
    <Chip
      label={isYes ? "Yes" : "No"}
      color={isYes ? "success" : "error"}
      size="small"
    />
  );
}

export default function WorkersTable({ loading, workers }: Props) {
  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3 }}>

      <Typography variant="h6" fontWeight="bold" mb={2}>
        Worker Locations & Compliance
      </Typography>

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Worker</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Zone</TableCell>
            <TableCell align="center">Working</TableCell>
            <TableCell align="center">Helmet</TableCell>
            <TableCell align="center">Safety Vest</TableCell>
            <TableCell align="center">Confined Space</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {workers.map((worker: any, index: number) => (
            <TableRow key={worker.worker_id ?? index} hover>
              <TableCell>{worker.worker_name ?? worker.worker_id ?? `W-${index + 1}`}</TableCell>
              <TableCell>{worker.role ?? "-"}</TableCell>
              <TableCell>{worker.zone ?? "-"}</TableCell>
              <TableCell align="center">{yesNoChip(worker.working)}</TableCell>
              <TableCell align="center">{yesNoChip(worker.helmet)}</TableCell>
              <TableCell align="center">{yesNoChip(worker.safety_vest)}</TableCell>
              <TableCell align="center">{yesNoChip(worker.confined_space)}</TableCell>
            </TableRow>
          ))}

          {workers.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                No worker data available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>

      </Table>

    </Paper>
  );
}
