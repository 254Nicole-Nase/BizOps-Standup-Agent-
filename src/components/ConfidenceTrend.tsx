import { useState } from "react"
import type { RunSummary } from "@/lib/api"

const WIDTH = 280
const HEIGHT = 96
const PAD = { top: 10, right: 8, bottom: 18, left: 26 }

/** Delivery-confidence line over recent runs with the gate threshold as a reference line. */
export default function ConfidenceTrend({ runs, threshold }: { runs: RunSummary[]; threshold: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const points = runs
    .filter((run) => run.metrics)
    .slice(0, 12)
    .reverse()
    .map((run) => ({ number: run.number, value: run.metrics!.confidence, at: run.startedAt }))

  if (points.length < 2) {
    return <p className="empty-note">A trend line appears after two briefs.</p>
  }

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (index / (points.length - 1)) * plotW
  const y = (value: number) => PAD.top + (1 - value / 100) * plotH
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`).join(" ")
  const active = hover !== null ? points[hover] : null

  return (
    <div className="trend-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="trend-svg"
        role="img"
        aria-label={`On-track score over the last ${points.length} briefs`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="trend-grid" />
            <text x={PAD.left - 6} y={y(tick) + 3} className="trend-axis" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={y(threshold)}
          y2={y(threshold)}
          className="trend-threshold"
        />
        <text x={WIDTH - PAD.right} y={y(threshold) + 11} className="trend-axis" textAnchor="end">
          min {threshold}%
        </text>
        <path d={path} className="trend-line" />
        {active && <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + plotH} className="trend-cross" />}
        {points.map((point, index) => (
          <g key={point.number}>
            <circle cx={x(index)} cy={y(point.value)} r={hover === index ? 4.5 : 3} className="trend-dot" />
            <rect
              x={x(index) - plotW / points.length / 2}
              y={PAD.top}
              width={plotW / points.length}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          </g>
        ))}
        <text x={PAD.left} y={HEIGHT - 4} className="trend-axis">
          #{points[0].number}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 4} className="trend-axis" textAnchor="end">
          #{points[points.length - 1].number}
        </text>
      </svg>
      <div className="trend-readout">
        {active ? (
          <>
            Brief #{active.number}: <strong>{active.value}%</strong> on{" "}
            {new Date(active.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </>
        ) : (
          <>
            On-track score, latest <strong>{points[points.length - 1].value}%</strong>
          </>
        )}
      </div>
    </div>
  )
}
