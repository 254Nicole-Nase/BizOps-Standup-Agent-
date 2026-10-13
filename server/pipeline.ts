import { randomUUID } from "node:crypto"
import type {
  DataSource,
  LogEntry,
  PhaseId,
  RunEvent,
  RunRecord,
  RunSettings,
  Task,
} from "../src/shared/types"
import { computeMetrics, evaluateGates, fallbackBrief } from "./analysis"
import { providerConfigured } from "./config"
import { composeBrief } from "./llm"
import { fetchNotionTasks, notionConfigured } from "./notion"
import { sampleTasks } from "./sampleData"
import { briefToBlocks, briefToText, postToSlack } from "./slack"
import { getRun, nextRunNumber, saveRun } from "./store"

const PHASES: PhaseId[] = ["ingest", "analyze", "compose", "gate", "publish"]

type Emit = (event: RunEvent) => void

let activeRun: string | null = null
export const isRunning = () => activeRun !== null

export const loadTasks = async (): Promise<{ source: DataSource; tasks: Task[] }> =>
  notionConfigured()
    ? { source: "notion", tasks: await fetchNotionTasks() }
    : { source: "demo", tasks: sampleTasks() }

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const executeRun = async (
  settings: RunSettings,
  trigger: RunRecord["trigger"],
  emit: Emit = () => {},
): Promise<RunRecord> => {
  if (activeRun) throw new Error("A run is already in progress")
  activeRun = "starting"
  let number: number
  try {
    number = await nextRunNumber()
  } catch (error) {
    activeRun = null
    throw error
  }

  const run: RunRecord = {
    id: randomUUID(),
    number,
    trigger,
    startedAt: new Date().toISOString(),
    status: "running",
    source: notionConfigured() ? "notion" : "demo",
    settings,
    phases: PHASES.map((id) => ({ id, state: "pending" })),
    logs: [],
    tasks: [],
    gates: [],
  }
  activeRun = run.id

  const log = (level: LogEntry["level"], message: string) => {
    const entry = { at: new Date().toISOString(), level, message }
    run.logs.push(entry)
    emit({ type: "log", entry })
  }

  const phase = async <T>(id: PhaseId, work: (setDetail: (d: string) => void) => Promise<T>) => {
    const record = run.phases.find((item) => item.id === id)!
    const started = Date.now()
    Object.assign(record, { state: "running", startedAt: new Date().toISOString() })
    emit({ type: "phase", phase: { ...record } })
    try {
      const result = await work((detail) => (record.detail = detail))
      Object.assign(record, { state: "done", durationMs: Date.now() - started })
      return result
    } catch (error) {
      Object.assign(record, { state: "failed", durationMs: Date.now() - started, detail: describeError(error) })
      throw error
    } finally {
      emit({ type: "phase", phase: { ...record } })
    }
  }

  emit({ type: "run", run })
  log("info", `Run #${run.number} started (${trigger}).`)

  try {
    const { source, tasks } = await phase("ingest", async (detail) => {
      log("info", notionConfigured() ? "Querying Notion tracker database…" : "Notion not configured, using demo tracker.")
      const loaded = await loadTasks()
      detail(`${loaded.tasks.length} items from ${loaded.source === "notion" ? "Notion" : "demo data"}`)
      log("success", `Ingested ${loaded.tasks.length} tracker items.`)
      return loaded
    })
    run.source = source
    run.tasks = tasks
    if (tasks.length === 0) throw new Error("Tracker returned no items, so there is nothing to report on")

    const metrics = await phase("analyze", async (detail) => {
      const result = computeMetrics(tasks)
      detail(`${result.risks.length} risks · ${result.confidence}% confidence`)
      log(
        "success",
        `Scored ${result.risks.length} risks (${result.highSeverityRisks} high). Confidence ${result.confidence}% → ${result.health}.`,
      )
      return result
    })
    run.metrics = metrics

    await phase("compose", async (detail) => {
      const { provider, model } = settings
      if (provider === "none" || !providerConfigured(provider)) {
        if (provider !== "none") log("warn", `${provider} API key missing, so the deterministic writer was used.`)
        run.brief = fallbackBrief(tasks, metrics)
        run.briefSource = "fallback"
        run.llm = { provider: "none", model: "deterministic", latencyMs: 0 }
        detail("Deterministic template brief")
        return
      }
      log("info", `Composing brief with ${provider}/${model}…`)
      try {
        const result = await composeBrief(model, tasks, metrics)
        run.brief = result.brief
        run.briefSource = "llm"
        run.llm = { provider, model, latencyMs: result.latencyMs }
        detail(`${provider} · ${(result.latencyMs / 1000).toFixed(1)}s${result.attempts > 1 ? " · repaired" : ""}`)
        log("success", `Brief generated in ${result.latencyMs}ms${result.attempts > 1 ? " after a repair pass" : ""}.`)
      } catch (error) {
        const message = describeError(error)
        run.brief = fallbackBrief(tasks, metrics)
        run.briefSource = "fallback"
        run.llm = { provider, model, latencyMs: 0, error: message }
        detail("LLM failed, so the template brief was used")
        log("warn", `LLM error: ${message}. Fell back to the template brief.`)
      }
    })

    run.slackText = briefToText(run.brief!, metrics)

    const gatesPassed = await phase("gate", async (detail) => {
      run.gates = evaluateGates({
        tasks,
        metrics,
        brief: run.brief!,
        briefSource: run.briefSource!,
        settings,
        llmError: run.llm?.error,
      })
      for (const gate of run.gates) log(gate.passed ? "success" : "warn", `${gate.label}: ${gate.detail}`)
      const passed = run.gates.every((gate) => gate.passed)
      detail(`${run.gates.filter((gate) => gate.passed).length}/${run.gates.length} gates passed`)
      return passed
    })

    if (gatesPassed && settings.autoPublish) {
      await publishRun(run, false, log, emit)
    } else {
      const record = run.phases.find((item) => item.id === "publish")!
      record.state = "skipped"
      record.detail = gatesPassed ? "Awaiting approval" : "Held for human review"
      emit({ type: "phase", phase: { ...record } })
      run.status = gatesPassed ? "ready" : "held"
      log(gatesPassed ? "info" : "warn", gatesPassed ? "Brief ready. Approve to post." : "Quality gates failed. Brief held for review.")
    }
  } catch (error) {
    run.status = "failed"
    run.error = describeError(error)
    log("error", run.error)
  } finally {
    run.finishedAt = new Date().toISOString()
    activeRun = null
    await saveRun(run)
    emit({ type: "done", run })
  }
  return run
}

const publishRun = async (
  run: RunRecord,
  override: boolean,
  log: (level: LogEntry["level"], message: string) => void,
  emit: Emit,
) => {
  const record = run.phases.find((item) => item.id === "publish")!
  const started = Date.now()
  Object.assign(record, { state: "running", startedAt: new Date().toISOString() })
  emit({ type: "phase", phase: { ...record } })
  try {
    const result = await postToSlack(
      run.settings.slackChannel,
      run.slackText!,
      briefToBlocks(run.brief!, run.metrics!),
    )
    run.publish = {
      at: new Date().toISOString(),
      mode: result.mode,
      channel: run.settings.slackChannel,
      permalink: result.permalink,
      approvedOverride: override,
    }
    run.status = "published"
    Object.assign(record, {
      state: "done",
      durationMs: Date.now() - started,
      detail: result.mode === "dry_run" ? "Dry run (Slack not configured)" : `Posted to ${run.settings.slackChannel}`,
    })
    log(
      "success",
      result.mode === "dry_run"
        ? "Slack not configured. Recorded as a dry-run publish."
        : `Posted to ${run.settings.slackChannel}${override ? " (human override)" : ""}.`,
    )
  } catch (error) {
    Object.assign(record, { state: "failed", durationMs: Date.now() - started, detail: describeError(error) })
    log("error", describeError(error))
    throw error
  } finally {
    emit({ type: "phase", phase: { ...record } })
  }
}

/** Publish a finished run. Held runs require an explicit human override. */
export const approveAndPublish = async (id: string, override: boolean) => {
  const run = await getRun(id)
  if (!run) throw Object.assign(new Error("Run not found"), { status: 404 })
  if (run.status === "published") throw Object.assign(new Error("Run already published"), { status: 409 })
  if (run.status === "failed" || !run.brief) throw Object.assign(new Error("Run has no brief to publish"), { status: 409 })
  if (run.status === "held" && !override) {
    throw Object.assign(new Error("Quality gates failed. Pass override=true to publish anyway."), { status: 412 })
  }
  const log = (level: LogEntry["level"], message: string) =>
    run.logs.push({ at: new Date().toISOString(), level, message })
  try {
    await publishRun(run, run.status === "held", log, () => {})
  } finally {
    await saveRun(run)
  }
  return run
}
