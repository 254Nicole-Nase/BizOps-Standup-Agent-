import { useState, type FormEvent } from "react"
import Lamps from "@/components/Lamps"

/** Shown when the server has an access code set and this browser hasn't entered it yet. */
export default function AccessGate({ failed, onSubmit }: { failed: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim()) onSubmit(code.trim())
  }

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <Lamps size="lg" />
        <h1>BizOps Standup Agent</h1>
        <p>This dashboard is private. Enter the access code your admin shared with you.</p>
        <label className="field" htmlFor="access-code">
          <span>Access code</span>
          <input
            id="access-code"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {failed && <small className="gate-error">That code didn't work. Check it and try again.</small>}
        </label>
        <button className="btn btn-primary" type="submit" disabled={!code.trim()}>
          Open dashboard
        </button>
      </form>
    </div>
  )
}
