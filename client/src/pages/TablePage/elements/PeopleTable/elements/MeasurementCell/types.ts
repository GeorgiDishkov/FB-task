export interface MeasurementCellProps {
  /** The raw API value — a number-like string, or a sentinel such as "unknown". */
  raw: string;
  /** Appended when the value is numeric; the API's units are cm and kg. */
  unit: string;
}
