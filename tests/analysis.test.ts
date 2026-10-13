import { describe, expect, it } from "vitest"
import { computeMetrics, evaluateGates, fallbackBrief, scoreTask } from "../server/analysis"
import { defaultSettings } from "../server/config"
import { sampleTasks } from "../server/sampleData"
import type { Task } from "../src/shared/types"

const NOW = new Date("2026-10-13T12:00:00Z")
const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  project: "Alpha",
  owner: "Ana",
  status: "in_progress",
  progress: 50,
  ...overrides,
})

describe("scoreTask", () => {
  it("ignores completed and healthy work", () => {
    expect(scoreTask(task({ status: "done", progress: 100 }), NOW)).toBeNull()
    expect(scoreTask(task({ dueDate: "2026-12-01" }), NOW)).toBeNull()
  })

  it("escalates a long-running blocker close to its deadline", () => {
    const risk = scoreTask(task({ status: "blocked", blockerAgeDays: 5, dueDate: "2026-10-16", blocker: "Legal" }), NOW)
    expect(risk?.severity).toBe("high")
    expect(risk?.signals).toEqual(["Marked blocked", "Open for 5 days", "Due in 3 days at 50%"])
    expect(risk?.summary).toBe("Legal")
  })

  it("flags overdue work even when not marked blocked", () => {
    const risk = scoreTask(task({ dueDate: "2026-10-10" }), NOW)
    expect(risk?.overdue).toBe(true)
    expect(risk?.severity).toBe("medium")
  })

  it("flags not-started work with a near deadline", () => {
    expect(scoreTask(task({ status: "not_started", progress: 0, dueDate: "2026-10-20" }), NOW)?.severity).toBe("medium")
  })
})

describe("computeMetrics", () => {
  it("scores the demo portfolio deterministically", () => {
    const metrics = computeMetrics(sampleTasks(NOW), NOW)
    expect(metrics.totalTasks).toBe(11)
    expect(metrics.completedTasks).toBe(3)
    expect(metrics.highSeverityRisks).toBe(2)
    expect(metrics.risks[0].severity).toBe("high")
    expect(metrics.confidence).toBe(71)
    expect(metrics.health).toBe("Yellow")
  })

  it("handles an empty tracker", () => {
    expect(computeMetrics([], NOW)).toMatchObject({ totalTasks: 0, confidence: 0, health: "Red" })
  })
})

describe("evaluateGates", () => {
  const tasks = sampleTasks(NOW)
  const metrics = computeMetrics(tasks, NOW)
  const settings = { ...defaultSettings(), provider: "gemini" as const, minConfidence: 70, highRiskLimit: 2 }

  it("passes a grounded LLM brief", () => {
    const gates = evaluateGates({ tasks, metrics, brief: fallbackBrief(tasks, metrics), briefSource: "llm", settings })
    expect(gates.every((gate) => gate.passed)).toBe(true)
  })

  it("fails grounding when the brief invents a project or drops an escalation", () => {
    const brief = fallbackBrief(tasks, metrics)
    brief.risks = [{ project: "Moonshot X", issue: "Made up", severity: "high", action: "Panic", owner: "Nobody" }]
    const grounding = evaluateGates({ tasks, metrics, brief, briefSource: "llm", settings }).find(
      (gate) => gate.id === "grounding",
    )
    expect(grounding?.passed).toBe(false)
    expect(grounding?.detail).toContain("Moonshot X")
  })

  it("fails the schema gate when the LLM fell back to the template", () => {
    const gates = evaluateGates({
      tasks,
      metrics,
      brief: fallbackBrief(tasks, metrics),
      briefSource: "fallback",
      settings,
      llmError: "timeout",
    })
    expect(gates.find((gate) => gate.id === "llm_valid")?.passed).toBe(false)
  })

  it("respects thresholds", () => {
    const gates = evaluateGates({
      tasks,
      metrics,
      brief: fallbackBrief(tasks, metrics),
      briefSource: "llm",
      settings: { ...settings, minConfidence: 90, highRiskLimit: 0 },
    })
    expect(gates.filter((gate) => !gate.passed).map((gate) => gate.id)).toEqual(["confidence", "high_risks"])
  })
})
