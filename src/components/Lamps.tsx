import type { Health } from "@/shared/types"

/** A red/amber/green signal head. The lit lamp is the reporting status; none lit means not scored yet. */
export default function Lamps({ health, size = "md" }: { health?: Health; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`lamps lamps-${size}`} role="img" aria-label={health ? `${health} status` : "Not scored yet"}>
      <span className={`lamp lamp-red ${health === "Red" ? "on" : ""}`} />
      <span className={`lamp lamp-amber ${health === "Yellow" ? "on" : ""}`} />
      <span className={`lamp lamp-green ${health === "Green" ? "on" : ""}`} />
    </span>
  )
}
