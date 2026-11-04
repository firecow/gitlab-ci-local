const HRTIME_UNITS: [number, string][] = [[3600, "h"], [60, "min"], [1, "s"], [1e-3, "ms"], [1e-6, "μs"], [1e-9, "ns"]];

export function prettyHrtime ([seconds, nanoseconds]: [number, number]) {
    const total = seconds + nanoseconds / 1e9;
    const [size, unit] = HRTIME_UNITS.find(([size]) => total >= size) ?? [1e-9, "ns"];
    const value = total / size;
    return `${value >= 10 ? Math.round(value) : Number(value.toFixed(2))} ${unit}`;
}
