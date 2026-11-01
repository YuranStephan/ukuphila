import type { ReactNode } from "react";

/*
 * Inline SVG charts, drawn on the server. Specs follow the dataviz method: bars at most 24px with a 4px rounded data end
 * and a square base, 2px lines, a 2px surface gap between fills, hairline solid grid, selective labels, one axis.
 * Hover comes from `data-tip` (see chart-tips.tsx), and every chart has a table view for the same numbers.
 */

const niceMax = (value: number) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
};

function topRoundedBar(x: number, y: number, width: number, height: number, radius = 4) {
  const r = Math.min(radius, width / 2, height);
  return `M${x} ${y + height}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height}Z`;
}

export type Series = { key: string; label: string; color: string };

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function TableView({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="table-view">
      <summary>Ver como tabela</summary>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {head.map((cell) => (
                <th key={cell}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Columns over time for one or two stacked series. */
export function ColumnChart({
  data,
  series,
  formatValue,
  formatTick,
  height = 220,
  labelEvery,
}: {
  data: ({ label: string } & Record<string, number | string>)[];
  series: Series[];
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  height?: number;
  labelEvery?: number;
}) {
  const width = 720;
  const margin = { top: 14, right: 4, bottom: 26, left: 44 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const totals = data.map((row) => series.reduce((sum, item) => sum + Number(row[item.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const band = innerWidth / Math.max(data.length, 1);
  const barWidth = Math.min(24, Math.max(3, band - 2));
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 7));
  const ticks = [0, 0.5, 1].map((share) => share * max);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Gráfico: ${series.map((item) => item.label).join(", ")}`}>
      {ticks.map((tick) => {
        const y = margin.top + innerHeight - (tick / max) * innerHeight;
        return (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--grelha)" />
            <text x={margin.left - 8} y={y + 4} textAnchor="end">
              {(formatTick ?? formatValue)(tick)}
            </text>
          </g>
        );
      })}
      {data.map((row, index) => {
        const x = margin.left + index * band + (band - barWidth) / 2;
        let base = margin.top + innerHeight;
        const tip = `${row.label}\n${series.map((item) => `${item.label}: ${formatValue(Number(row[item.key] ?? 0))}`).join("\n")}`;
        return (
          <g key={row.label} data-tip={tip}>
            <rect className="chart-hit" x={margin.left + index * band} y={margin.top} width={band} height={innerHeight} />
            {series.map((item, seriesIndex) => {
              const value = Number(row[item.key] ?? 0);
              if (value <= 0) return null;
              const h = Math.max(1.5, (value / max) * innerHeight);
              base -= h;
              const isTop = series.slice(seriesIndex + 1).every((rest) => Number(row[rest.key] ?? 0) <= 0);
              const y = base;
              base -= isTop ? 0 : 2;
              return isTop ? <path key={item.key} className="chart-mark" d={topRoundedBar(x, y, barWidth, h)} fill={item.color} /> : <rect key={item.key} className="chart-mark" x={x} y={y} width={barWidth} height={h} fill={item.color} />;
            })}
            {index % every === 0 ? (
              <text x={x + barWidth / 2} y={height - 7} textAnchor="middle">
                {row.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={margin.left} x2={width - margin.right} y1={margin.top + innerHeight} y2={margin.top + innerHeight} stroke="var(--line)" />
    </svg>
  );
}

/** Horizontal bars ranked by value, with the number at the tip. */
export function BarList({ rows, formatValue, color = "var(--serie-1)", max }: { rows: { label: string; value: number; hint?: string; color?: string }[]; formatValue: (value: number) => string; color?: string; max?: number }) {
  const top = max ?? Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="bar-list">
      {rows.map((row) => (
        <div key={row.label} className="bar-row" data-tip={`${row.label}: ${formatValue(row.value)}${row.hint ? `\n${row.hint}` : ""}`}>
          <span className="bar-label truncate">{row.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${Math.max(1.5, (row.value / top) * 100)}%`, background: row.color ?? color }} />
          </span>
          <span className="bar-value num">{formatValue(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Parts of a whole on one line. The gap between segments is what separates them. */
export function StackedLine({ rows, formatValue }: { rows: { label: string; value: number; color: string }[]; formatValue: (value: number) => string }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="stack" style={{ ["--gap" as string]: "10px" }}>
      <div className="stacked-line" role="img" aria-label="Distribuição">
        {rows
          .filter((row) => row.value > 0)
          .map((row) => (
            <span key={row.label} data-tip={`${row.label}: ${formatValue(row.value)}`} style={{ flexGrow: row.value, background: row.color }} />
          ))}
      </div>
      <div className="legend">
        {rows.map((row) => (
          <span key={row.label}>
            <i style={{ background: row.color }} />
            {row.label} · {total ? Math.round((row.value / total) * 100) : 0}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function Funnel({ steps }: { steps: { label: string; value: number; note?: string }[] }) {
  const top = Math.max(...steps.map((step) => step.value), 1);
  return (
    <ol className="funnel">
      {steps.map((step, index) => (
        <li key={step.label} data-tip={`${step.label}: ${step.value}`}>
          <span className="funnel-bar" style={{ width: `${Math.max(4, (step.value / top) * 100)}%`, opacity: 1 - index * 0.14 }} />
          <span className="funnel-text">
            <strong className="num">{step.value}</strong> {step.label}
            {step.note ? <span className="muted"> · {step.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Tiny trend for stat tiles. No axis, so the tile's own number carries the value. */
export function Spark({ values, color = "var(--serie-1)", width = 96, height = 30 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * (width - 6) + 3, height - 4 - ((value - min) / span) * (height - 8)]);
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points.map((point) => point.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} stroke="var(--surface-card)" strokeWidth="2" />
    </svg>
  );
}
