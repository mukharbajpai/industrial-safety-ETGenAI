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
  sensors: any[];
}

function getStatus(sensor: any) {
  const temperature =
    sensor.temperature ??
    sensor.temp ??
    sensor.temperature_c ??
    0;

  const gas =
    sensor.gas ??
    sensor.gas_level ??
    sensor.gas_ppm ??
    0;

  if (temperature > 95 || gas > 80)
    return "Critical";

  if (temperature > 80 || gas > 40)
    return "Warning";

  return "Normal";
}

export default function SensorTable({
  loading,
  sensors,
}: Props) {

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Paper sx={{ p: 2, borderRadius: 3 }}>

      <Typography
        variant="h6"
        fontWeight="bold"
        mb={2}
      >
        Live Sensors
      </Typography>

      <Table>

        <TableHead>

          <TableRow>

            <TableCell>Sensor</TableCell>

            <TableCell>Location</TableCell>

            <TableCell align="center">
              Temperature
            </TableCell>

            <TableCell align="center">
              Gas
            </TableCell>

            <TableCell align="center">
              Humidity
            </TableCell>

            <TableCell align="center">
              Status
            </TableCell>

          </TableRow>

        </TableHead>

        <TableBody>

          {sensors.map((sensor: any, index) => {

            const temperature =
              sensor.temperature ??
              sensor.temp ??
              sensor.temperature_c ??
              "-";

            const gas =
              sensor.gas ??
              sensor.gas_level ??
              sensor.gas_ppm ??
              "-";

            const humidity =
              sensor.humidity ??
              sensor.humidity_percent ??
              "-";

            const status = getStatus(sensor);

            return (
              <TableRow key={sensor.id ?? index} hover>

                <TableCell>
                  {sensor.id ??
                    sensor.sensor_id ??
                    `S-${index + 1}`}
                </TableCell>

                <TableCell>
                  {sensor.location ??
                    sensor.area ??
                    "Factory"}
                </TableCell>

                <TableCell align="center">
                  {temperature}
                  {temperature !== "-" ? " °C" : ""}
                </TableCell>

                <TableCell align="center">
                  {gas}
                </TableCell>

                <TableCell align="center">
                  {humidity}
                  {humidity !== "-" ? "%" : ""}
                </TableCell>

                <TableCell align="center">

                  <Chip
                    label={status}
                    color={
                      status === "Critical"
                        ? "error"
                        : status === "Warning"
                        ? "warning"
                        : "success"
                    }
                  />

                </TableCell>

              </TableRow>
            );
          })}

          {sensors.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                align="center"
              >
                No sensor data available.
              </TableCell>
            </TableRow>
          )}

        </TableBody>

      </Table>

    </Paper>
  );
}