export type Severity =
  | "critical"
  | "warning"
  | "normal"
  | "high"
  | "medium"
  | "low";

export function getStatusColor(
  status?: string
):
  | "success"
  | "warning"
  | "error"
  | "default" {
  switch ((status ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "error";

    case "warning":
    case "medium":
      return "warning";

    case "normal":
    case "low":
    case "safe":
      return "success";

    default:
      return "default";
  }
}

export function getRiskColor(
  risk: number
):
  | "success"
  | "warning"
  | "error" {
  if (risk >= 80) return "error";
  if (risk >= 50) return "warning";
  return "success";
}

export function formatPercentage(
  value?: number | string | null
): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  const num =
    typeof value === "string"
      ? Number(value)
      : value;

  if (Number.isNaN(num)) {
    return String(value);
  }

  return `${num.toFixed(1)}%`;
}

export function formatNumber(
  value?: number | string | null,
  decimals = 2
): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  const num =
    typeof value === "string"
      ? Number(value)
      : value;

  if (Number.isNaN(num)) {
    return String(value);
  }

  return num.toFixed(decimals);
}

export function formatDateTime(
  value?: string | Date | null
): string {
  if (!value) return "-";

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTemperature(
  value?: number | string | null
): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return `${value} °C`;
}

export function formatHumidity(
  value?: number | string | null
): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return `${value}%`;
}

export function formatSensorValue(
  value?: number | string | null,
  unit?: string
): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return unit ? `${value} ${unit}` : String(value);
}

export function capitalize(
  text?: string
): string {
  if (!text) return "";

  return text.charAt(0).toUpperCase() + text.slice(1);
}