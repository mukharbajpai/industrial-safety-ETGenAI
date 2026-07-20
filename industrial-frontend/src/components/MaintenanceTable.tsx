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
  maintenance: any[];
}

export default function MaintenanceTable({ loading, maintenance }: Props) {
  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3, mt: 3 }}>

      <Typography variant="h6" fontWeight="bold" mb={2}>
        Maintenance Schedule
      </Typography>

      <Table>

        <TableHead>
          <TableRow>
            <TableCell>Maintenance ID</TableCell>
            <TableCell>Equipment</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Scheduled Date</TableCell>
            <TableCell align="center">Completed</TableCell>
            <TableCell>Technician</TableCell>
            <TableCell align="center">Duration (hrs)</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {maintenance.slice(0, 50).map((item: any, index: number) => (
            <TableRow key={item.maintenance_id ?? index} hover>
              <TableCell>{item.maintenance_id ?? `M-${index + 1}`}</TableCell>
              <TableCell>{item.equipment_id ?? "-"}</TableCell>
              <TableCell>{item.maintenance_type ?? "-"}</TableCell>
              <TableCell>{item.scheduled_date ?? "-"}</TableCell>

              <TableCell align="center">
                <Chip
                  label={item.completed ? "Yes" : "No"}
                  color={item.completed ? "success" : "warning"}
                  size="small"
                />
              </TableCell>

              <TableCell>{item.technician ?? "-"}</TableCell>
              <TableCell align="center">{item.duration_hours ?? "-"}</TableCell>
            </TableRow>
          ))}

          {maintenance.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} align="center">
                No maintenance records available.
              </TableCell>
            </TableRow>
          )}
        </TableBody>

      </Table>

    </Paper>
  );
}
