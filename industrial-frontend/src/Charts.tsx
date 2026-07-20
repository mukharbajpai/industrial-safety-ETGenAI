import { useState } from "react";

import {
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Box,
} from "@mui/material";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface Props {
  sensors: any[];
  predictions: any[];
}

const METRICS: { key: string; label: string; unit: string }[] = [
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "gas_ppm", label: "Gas (ppm)", unit: "ppm" },
  { key: "vibration", label: "Vibration", unit: "mm/s" },
  { key: "pressure", label: "Pressure", unit: "psi" },
];

function riskColor(level: string) {
  switch ((level ?? "").toLowerCase()) {
    case "critical":
      return "#D32F2F";
    case "high":
      return "#F4511E";
    case "medium":
      return "#FB8C00";
    default:
      return "#2E7D32";
  }
}

export default function Charts({
  sensors,
  predictions,
}: Props) {

  const [metric, setMetric] = useState(METRICS[0]);

  const chartData = sensors.map(
    (sensor: any, index: number) => ({
      name:
        sensor.equipment_id ??
        sensor.sensor_id ??
        sensor.id ??
        `S${index + 1}`,

      value:
        sensor[metric.key] ??
        0,
    })
  );

  const riskBarData = [...predictions]
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .map((pred: any, index: number) => ({
      name: pred.equipment_id ?? `E${index + 1}`,
      risk_score: pred.risk_score ?? 0,
      risk_level: pred.risk_level ?? "Low",
    }));

  return (
    <Grid container spacing={3}>

      <Grid item xs={12} md={8}>

        <Card elevation={3}>

          <CardContent>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1}
              mb={2}
            >
              <Typography variant="h6" fontWeight="bold">
                Live Sensor Readings
              </Typography>

              <ToggleButtonGroup
                size="small"
                exclusive
                value={metric.key}
                onChange={(_, value) => {
                  if (!value) return;
                  const found = METRICS.find((m) => m.key === value);
                  if (found) setMetric(found);
                }}
              >
                {METRICS.map((m) => (
                  <ToggleButton key={m.key} value={m.key}>
                    {m.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <ResponsiveContainer
              width="100%"
              height={320}
            >

              <LineChart
                data={chartData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis dataKey="name" />

                <YAxis />

                <Tooltip
                  formatter={(value: any) => [`${value} ${metric.unit}`, metric.label]}
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="value"
                  name={metric.label}
                  stroke="#1976d2"
                  strokeWidth={3}
                />

              </LineChart>

            </ResponsiveContainer>

          </CardContent>

        </Card>

      </Grid>

      <Grid item xs={12} md={4}>

        <Card elevation={3}>

          <CardContent>

            <Typography
              variant="h6"
              fontWeight="bold"
              mb={2}
            >
              Equipment Risk Scores
            </Typography>

            <ResponsiveContainer
              width="100%"
              height={320}
            >

              <BarChart
                data={riskBarData}
                layout="vertical"
                margin={{ left: 16 }}
              >

                <CartesianGrid strokeDasharray="3 3" />

                <XAxis type="number" domain={[0, 100]} />

                <YAxis type="category" dataKey="name" width={70} />

                <Tooltip
                  formatter={(value: any, _name: any, props: any) => [
                    `${value} (${props.payload.risk_level})`,
                    "Risk score",
                  ]}
                />

                <Bar dataKey="risk_score" radius={[0, 4, 4, 0]}>
                  {riskBarData.map((entry, index) => (
                    <Cell key={index} fill={riskColor(entry.risk_level)} />
                  ))}
                </Bar>

              </BarChart>

            </ResponsiveContainer>

            {riskBarData.length === 0 && (
              <Typography color="text.secondary" textAlign="center">
                No risk predictions available.
              </Typography>
            )}

          </CardContent>

        </Card>

      </Grid>

    </Grid>
  );
}