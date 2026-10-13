import { useState } from "react"
import Icon from "@/components/Icon"
import Lamps from "@/components/Lamps"
import { HEALTH_LABEL, isoWeek, PHASE_PROGRESS, RAG_LABEL, STATIONS } from "@/lib/copy"
import type { PhaseId, RunRecord } from "@/shared/types"

interface Props {
  run: RunRecord | null
  isLatest: boolean
  running: boolean
  publishing: boolean
  projectCount: number
  channel: string
  canRun: boolean
  onRun: () => void
  onPublish: (override: boolean) => void
  onShowLatest: () => void
}

type StopState = "ahead" | "here" | "passed" | "alert"

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

const dateline = (date: Date) =>
  `Week ${isoWeek(date)} · ${date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`

const seconds = (ms?: number) => (ms === undefined ? "" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)

/** State and caption for one stop on the route line. */
const stop = (id: PhaseId, run: RunRecord | null, running: boolean, projectCount: number): { state: StopState; note: string } => {
  const phase = run?.phases.find((item) => item.id === id)
  if (!run || !phase) return { state: "ahead", note: "" }
  if (phase.state === "running") return { state: "here", note: "now" }
  if (phase.state === "failed") return { state: "alert", note: "failed" }

  if (id === "publish") {
    if (run.status === "published") return { state: "passed", note: run.publish?.approvedOverride ? "posted by hand" : "posted" }
    if (!running && (run.status === "ready" || run.status === "held")) return { state: "here", note: "your call" }
    return { state: "ahead", note: "" }
  }
  if (phase.state !== "done") return { state: "ahead", note: "" }

  const failed = run.gates.filter((gate) => !gate.passed).length
  const notes: Record<Exclude<PhaseId, "publish">, string> = {
    // Mid-run the record has no tasks or metrics yet, so fall back to the streamed phase detail.
    ingest: `${run.tasks.length || projectCount} projects`,
    analyze: run.metrics ? `${run.metrics.risks.length} risks` : (phase.detail?.split(" · ")[0] ?? ""),
    compose: run.briefSource === "fallback" ? "template" : seconds(phase.durationMs),
    gate: run.gates.length ? `${run.gates.length - failed}/${run.gates.length} pass` : "",
  }
  return { state: id === "gate" && failed ? "alert" : "passed", note: notes[id] }
}

export default function StatusHero(props: Props) {
  const { run, isLatest, running, publishing, projectCount, channel, canRun, onRun, onPublish, onShowLatest } = props
  const [confirming, setConfirming] = useState(false)
  const current = run?.phases.find((phase) => phase.state === "running")
  const failedChecks = run?.gates.filter((gate) => !gate.passed).length ?? 0
  const status = running ? "running" : (run?.status ?? "idle")
  const health = running ? undefined : run?.metrics?.health

  const writeButton = (label: string, primary: boolean) => (
    <button className={`btn ${primary ? "btn-primary" : "btn-quiet"}`} onClick={onRun} disabled={!canRun}>
      {label}
    </button>
  )

  let title = "Write this week's update"
  let body = `Reads the ${projectCount || ""} projects in your Notion tracker, flags what's slipping and drafts a short update for leadership. Nothing reaches Slack until you approve it.`
  let actions = writeButton("Write this week's brief", true)

  if (status === "running") {
    title = current ? PHASE_PROGRESS[current.id] : "Getting started…"
    body = "Usually 10 to 30 seconds. Follow along on the line below."
    actions = (
      <button className="btn btn-primary" disabled>
        <span className="spinner" /> Writing…
      </button>
    )
  } else if (status === "ready") {
    title = "Ready for your review"
    body = `All ${run!.gates.length} checks passed. Read the draft, then post it to ${channel}.`
    actions = (
      <>
        <button className="btn btn-primary" onClick={() => onPublish(false)} disabled={publishing}>
          <Icon name="send" size={16} />
          {publishing ? "Posting…" : "Post to Slack"}
        </button>
        {writeButton("Redraft", false)}
      </>
    )
  } else if (status === "held") {
    title = `Held: ${failedChecks} ${failedChecks === 1 ? "check" : "checks"} failed`
    body = "Nothing was posted. The Checks panel says what went wrong. Redraft, or post it yourself if it reads right."
    actions = confirming ? (
      <div className="confirm" role="group" aria-label="Confirm posting">
        <span>Post with a failed check? The brief is marked as posted by hand.</span>
        <div className="confirm-buttons">
          <button
            className="btn btn-danger"
            onClick={() => {
              setConfirming(false)
              onPublish(true)
            }}
            disabled={publishing}
          >
            Post anyway
          </button>
          <button className="btn btn-quiet" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <>
        {writeButton("Redraft", true)}
        <button className="btn btn-quiet" onClick={() => setConfirming(true)} disabled={publishing}>
          {publishing ? "Posting…" : "Post anyway…"}
        </button>
      </>
    )
  } else if (status === "published") {
    title = `Posted to ${run!.publish?.channel ?? channel}`
    body = `${run!.publish ? when(run!.publish.at) : ""}${run!.publish?.approvedOverride ? ". Posted by hand after a failed check" : ""}.`
    actions = (
      <>
        {run!.publish?.permalink && (
          <a className="btn btn-primary" href={run!.publish.permalink} target="_blank" rel="noreferrer">
            Open in Slack
            <Icon name="external" size={15} />
          </a>
        )}
        {writeButton("Write a new brief", !run!.publish?.permalink)}
      </>
    )
  } else if (status === "failed") {
    title = "The brief couldn't be written"
    body = run?.error ?? "The Activity tab has the details. Try again in a minute."
    actions = writeButton("Try again", true)
  }

  return (
    <section className={`hero hero-${status}`} aria-live="polite">
      {run && !isLatest && !running && (
        <p className="hero-banner">
          Brief #{run.number}, {when(run.startedAt)}.{" "}
          <button className="link" onClick={onShowLatest}>
            Back to the latest
          </button>
        </p>
      )}

      <div className="hero-top">
        <div className="hero-signal">
          <Lamps health={health} size="lg" />
          <div>
            <p className="dateline">{dateline(run ? new Date(run.startedAt) : new Date())}</p>
            {health && (
              <p className="rag-word" data-health={health}>
                {RAG_LABEL[health]}: {HEALTH_LABEL[health].toLowerCase()}
              </p>
            )}
          </div>
        </div>
        <div className="hero-actions">{actions}</div>
      </div>

      <h1>{title}</h1>
      <p className="hero-body">{body}</p>

      <ol className={`route ${running ? "is-running" : ""}`} aria-label="Progress">
        {STATIONS.map((station) => {
          const { state, note } = stop(station.id, run, running, projectCount)
          return (
            <li key={station.id} className={`stop stop-${state}`}>
              <span className="stop-dot" />
              <span className="stop-name">{station.name}</span>
              <span className="stop-note">{note || " "}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
