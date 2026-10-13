import { useState } from "react"
import Icon from "@/components/Icon"
import { PHASE_PROGRESS, STEPS } from "@/lib/copy"
import type { PhaseRecord, RunRecord } from "@/shared/types"

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

type StepState = "todo" | "active" | "done" | "warn"

const stepState = (phases: PhaseRecord[], ids: string[], run: RunRecord | null): StepState => {
  const mine = phases.filter((phase) => ids.includes(phase.id))
  if (!run) return "todo"
  if (mine.some((phase) => phase.state === "running")) return "active"
  if (mine.some((phase) => phase.state === "failed")) return "warn"
  if (ids.includes("gate") && run.status === "held") return "warn"
  if (ids.includes("publish")) {
    if (run.status === "published") return "done"
    if (run.status === "ready" || run.status === "held") return "active"
    return "todo"
  }
  return mine.every((phase) => phase.state === "done" || phase.state === "skipped") ? "done" : "todo"
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

export default function StatusHero(props: Props) {
  const { run, isLatest, running, publishing, projectCount, channel, canRun, onRun, onPublish, onShowLatest } = props
  const [confirming, setConfirming] = useState(false)
  const phases = run?.phases ?? []
  const current = phases.find((phase) => phase.state === "running")
  const failedChecks = run?.gates.filter((gate) => !gate.passed).length ?? 0
  const status = running ? "running" : (run?.status ?? "idle")
  const doneCount = phases.filter((phase) => phase.state === "done" || phase.state === "skipped").length
  const progress = running ? Math.max(8, Math.round((doneCount / 5) * 100)) : 0

  const writeButton = (label: string, primary: boolean) => (
    <button className={`btn ${primary ? "btn-primary" : "btn-secondary"}`} onClick={onRun} disabled={!canRun}>
      <Icon name={primary ? "sparkle" : "refresh"} size={16} />
      {label}
    </button>
  )

  let tone = "neutral"
  let eyebrow = "This week's update"
  let title = "Let's write this week's update"
  let body = `The agent reads the ${projectCount || "projects"} ${projectCount === 1 ? "project" : "projects"} in your Notion tracker, flags anything at risk and drafts a short update for leadership. Nothing goes to Slack until you approve it.`
  let actions = writeButton("Write this week's brief", true)

  if (status === "running") {
    tone = "active"
    eyebrow = "Working on it"
    title = current ? PHASE_PROGRESS[current.id] : "Getting started…"
    body = "This usually takes 10 to 30 seconds. You can watch each step below."
    actions = (
      <button className="btn btn-primary" disabled>
        <span className="spinner" /> Writing…
      </button>
    )
  } else if (status === "ready") {
    tone = "good"
    eyebrow = "Ready for you"
    title = "Your brief is ready to review"
    body = `All ${run!.gates.length} checks passed. Read it below, then share it with ${channel} when you're happy.`
    actions = (
      <>
        <button className="btn btn-primary" onClick={() => onPublish(false)} disabled={publishing}>
          <Icon name="send" size={16} />
          {publishing ? "Posting…" : "Post to Slack"}
        </button>
        {writeButton("Write a new draft", false)}
      </>
    )
  } else if (status === "held") {
    tone = "warn"
    eyebrow = "Needs a closer look"
    title = `${failedChecks} ${failedChecks === 1 ? "check" : "checks"} didn't pass`
    body = "The draft wasn't posted. See why under Checks, then try again or post it anyway if it looks right to you."
    actions = confirming ? (
      <div className="confirm-row" role="group" aria-label="Confirm posting">
        <span>Post even though some checks failed? This is recorded on the brief.</span>
        <button
          className="btn btn-danger"
          onClick={() => {
            setConfirming(false)
            onPublish(true)
          }}
          disabled={publishing}
        >
          Yes, post it
        </button>
        <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    ) : (
      <>
        {writeButton("Try again", true)}
        <button className="btn btn-secondary" onClick={() => setConfirming(true)} disabled={publishing}>
          {publishing ? "Posting…" : "Post anyway…"}
        </button>
      </>
    )
  } else if (status === "published") {
    tone = "good"
    eyebrow = "Shared"
    title = "Shared with your team"
    body = `Posted to ${run!.publish?.channel ?? channel} ${run!.publish ? `on ${when(run!.publish.at)}` : ""}${
      run!.publish?.approvedOverride ? " (posted by a person after a failed check)" : ""
    }.`
    actions = (
      <>
        {run!.publish?.permalink && (
          <a className="btn btn-primary" href={run!.publish.permalink} target="_blank" rel="noreferrer">
            <Icon name="external" size={16} />
            Open in Slack
          </a>
        )}
        {writeButton("Write a new brief", !run!.publish?.permalink)}
      </>
    )
  } else if (status === "failed") {
    tone = "bad"
    eyebrow = "Something went wrong"
    title = "The brief couldn't be written"
    body = run?.error ?? "Check the Activity tab for details, then try again."
    actions = writeButton("Try again", true)
  }

  return (
    <section className={`hero card tone-${tone}`} aria-live="polite">
      {run && !isLatest && !running && (
        <div className="hero-banner">
          You're looking at brief #{run.number} from {when(run.startedAt)}.
          <button className="link" onClick={onShowLatest}>
            Back to the latest
          </button>
        </div>
      )}

      <div className="hero-main">
        <div className="hero-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-body">{body}</p>
        </div>
        <div className="hero-actions">{actions}</div>
      </div>

      {running && (
        <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      <ol className="steps">
        {STEPS.map((step, index) => {
          const state = stepState(phases, step.phases, run)
          return (
            <li key={step.title} className={`step step-${state}`}>
              <span className="step-badge">
                {state === "done" ? <Icon name="check" size={14} /> : state === "warn" ? "!" : index + 1}
              </span>
              <div>
                <p className="step-title">{step.title}</p>
                <p className="step-detail">{step.detail}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
