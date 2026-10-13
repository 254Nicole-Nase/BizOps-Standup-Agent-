import { useEffect } from "react"
import Icon from "@/components/Icon"

const STEPS = [
  {
    title: "Click “Write this week's brief”",
    body: "The agent reads every project in your Notion tracker: status, owner, blockers and due dates.",
  },
  {
    title: "It drafts the update",
    body: "It scores how on-track things are, finds what's urgent, and has AI write a short summary. Then it checks every fact against Notion.",
  },
  {
    title: "You review and post",
    body: "Read the draft, then post it to Slack with one click. Nothing is sent until you say so.",
  },
]

const TERMS = [
  ["On-track score", "0 to 100. Starts at 100 and drops for blocked, overdue or at-risk work. Calculated from Notion, not by AI."],
  ["Urgent risk", "A project that's blocked for days, overdue, or close to its deadline with little progress."],
  ["Checks", "Four safety checks every draft must pass before it can be posted automatically."],
]

export default function HowItWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-root">
      <div className="drawer-scrim" onClick={onClose} />
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="how-title">
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        <p className="eyebrow">Welcome</p>
        <h2 id="how-title">Your weekly update, written for you</h2>
        <p className="modal-lead">
          The BizOps Standup Agent turns your team's Notion tracker into a short status update for leadership and shares it in
          Slack. It takes about 20 seconds.
        </p>

        <ol className="how-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-badge">{index + 1}</span>
              <div>
                <p className="step-title">{step.title}</p>
                <p className="step-detail">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="terms">
          <p className="terms-head">Words you'll see</p>
          <dl>
            {TERMS.map(([term, meaning]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
