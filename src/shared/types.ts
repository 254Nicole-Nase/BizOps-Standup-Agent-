// Types shared by the Express backend and the React client.

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "at_risk"
  | "blocked"
  | "done"

export type Severity = "high" | "medium" | "low"
export type Health = "Green" | "Yellow" | "Red"
export type LlmProvider = "gemini" | "none"
export type DataSource = "notion" | "demo"

export interface Task {
  id: string
  project: string
  owner: string
  status: TaskStatus
  /** 0-100 */
  progress: number
  blocker?: string
  /** Days since the task was flagged blocked / at risk. */
  blockerAgeDays?: number
  /** ISO date (YYYY-MM-DD). */
  dueDate?: string
  latestUpdate?: string
  url?: string
  lastEditedAt?: string
}

export interface RiskItem {
  taskId: string
  project: string
  owner: string
  status: TaskStatus
  summary: string
  severity: Severity
  ageDays: number
  dueInDays: number | null
  overdue: boolean
  /** Deterministic reasons that drove the severity score. */
  signals: string[]
  recommendedAction: string
}

export interface Metrics {
  totalTasks: number
  completedTasks: number
  inProgressTasks: number
  notStartedTasks: number
  atRiskTasks: number
  blockedTasks: number
  overdueTasks: number
  averageProgress: number
  highSeverityRisks: number
  confidence: number
  health: Health
  risks: RiskItem[]
}

export interface BriefRisk {
  project: string
  issue: string
  severity: Severity
  action: string
  owner: string
}

export interface Brief {
  headline: string
  summary: string
  wins: string[]
  risks: BriefRisk[]
  leadershipAsks: string[]
  nextWeekFocus: string[]
}

export interface GateResult {
  id: "confidence" | "high_risks" | "llm_valid" | "grounding"
  label: string
  passed: boolean
  detail: string
}

export type PhaseId = "ingest" | "analyze" | "compose" | "gate" | "publish"
export type PhaseState = "pending" | "running" | "done" | "failed" | "skipped"

export interface PhaseRecord {
  id: PhaseId
  state: PhaseState
  detail?: string
  startedAt?: string
  durationMs?: number
}

export interface LogEntry {
  at: string
  level: "info" | "success" | "warn" | "error"
  message: string
}

export interface RunSettings {
  slackChannel: string
  provider: LlmProvider
  model: string
  minConfidence: number
  highRiskLimit: number
  autoPublish: boolean
}

export interface PublishRecord {
  at: string
  mode: "bot" | "webhook" | "dry_run"
  channel: string
  permalink?: string
  approvedOverride: boolean
}

export interface RunRecord {
  id: string
  number: number
  trigger: "manual" | "schedule"
  startedAt: string
  finishedAt?: string
  status: "running" | "ready" | "held" | "published" | "failed"
  source: DataSource
  settings: RunSettings
  phases: PhaseRecord[]
  logs: LogEntry[]
  tasks: Task[]
  metrics?: Metrics
  brief?: Brief
  briefSource?: "llm" | "fallback"
  llm?: { provider: LlmProvider; model: string; latencyMs: number; error?: string }
  gates: GateResult[]
  slackText?: string
  publish?: PublishRecord
  error?: string
}

export type RunEvent =
  | { type: "run"; run: RunRecord }
  | { type: "phase"; phase: PhaseRecord }
  | { type: "log"; entry: LogEntry }
  | { type: "done"; run: RunRecord }
  | { type: "error"; message: string }

export interface ServerStatus {
  notion: { configured: boolean; database?: string }
  slack: { mode: "bot" | "webhook" | "none"; defaultChannel: string }
  providers: { id: LlmProvider; configured: boolean; defaultModel: string }[]
  schedule: { enabled: boolean; cron?: string; timezone?: string; nextRun?: string }
  defaults: RunSettings
  authRequired: boolean
}
