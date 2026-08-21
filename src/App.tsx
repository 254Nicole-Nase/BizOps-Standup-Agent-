import { useState, useEffect, useRef } from "react";

const INTEGRATIONS = [
  {
    name: "Notion",
    status: "connected",
    detail: "workspace: BizOps Q3",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    ),
  },
  {
    name: "Slack",
    status: "connected",
    detail: "#executive-updates",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
  },
  {
    name: "Gemini API",
    status: "connected",
    detail: "gemini-1.5-pro",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10S2 17.514 2 12 6.486 2 12 2zm0 3a7 7 0 1 0 0 14A7 7 0 0 0 12 5zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 12 7z" />
      </svg>
    ),
  },
  {
    name: "CrewAI",
    status: "running",
    detail: "2 agents active",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z" />
      </svg>
    ),
  },
];

const PIPELINE_STEPS = [
  {
    id: "fetch",
    label: "Fetch Notion Tasks",
    agent: "Data Collector",
    status: "done",
    duration: "1.2s",
    detail: "47 tasks retrieved across 6 projects",
  },
  {
    id: "analyze",
    label: "LLM Analysis",
    agent: "Analyst Agent",
    status: "done",
    duration: "3.8s",
    detail: "Blockers identified, progress scored",
  },
  {
    id: "summarize",
    label: "Generate Summary",
    agent: "Writer Agent",
    status: "active",
    duration: "...",
    detail: "Drafting executive narrative",
  },
  {
    id: "post",
    label: "Post to Slack",
    agent: "Publisher Agent",
    status: "pending",
    duration: "—",
    detail: "Awaiting draft approval",
  },
];

const BLOCKERS = [
  {
    project: "Platform Rebrand",
    task: "Design handoff from Figma blocked on stakeholder sign-off",
    owner: "Maya Chen",
    severity: "high",
    days: 3,
  },
  {
    project: "API v3 Launch",
    task: "Load testing incomplete — infra capacity undetermined",
    owner: "James Park",
    severity: "medium",
    days: 1,
  },
  {
    project: "Customer Portal",
    task: "Legal review of new data retention policy pending",
    owner: "Sara Liu",
    severity: "low",
    days: 5,
  },
];

const SUMMARY_LINES = [
  "**Week of Aug 18 — Executive Standup Summary**",
  "",
  "**Overall Health:** 🟡 Moderate — 3 blockers require attention",
  "",
  "**Platform Rebrand** — Design phase 78% complete. Figma handoff stalled pending stakeholder approval from VP Product (Day 3). Risk to Q3 timeline if unresolved by EOW.",
  "",
  "**API v3 Launch** — Core endpoints green. Load testing blocked on infra capacity decision. James Park to escalate to DevOps lead.",
  "",
  "**Customer Portal** — Frontend complete. Legal review of data retention policy is on Day 5. Recommend async follow-up with legal team today.",
  "",
  "**Wins this week:** Closed 12 tasks, shipped mobile push notifications, onboarded 3 enterprise accounts.",
];

const RUN_LOG = [
  { time: "09:01:03", level: "info", msg: "Agent pipeline initialized — weekly standup run" },
  { time: "09:01:04", level: "info", msg: "Notion API → fetching workspace: BizOps Q3" },
  { time: "09:01:05", level: "success", msg: "47 tasks fetched across 6 active projects" },
  { time: "09:01:06", level: "info", msg: "Analyst Agent → running LLM analysis (gemini-1.5-pro)" },
  { time: "09:01:09", level: "warn", msg: "Blocker detected: Platform Rebrand — stakeholder sign-off missing" },
  { time: "09:01:09", level: "warn", msg: "Blocker detected: API v3 — load testing blocked" },
  { time: "09:01:10", level: "success", msg: "Analysis complete — 3 blockers, 12 completions, 8 at-risk tasks" },
  { time: "09:01:10", level: "info", msg: "Writer Agent → generating executive narrative..." },
];

const METRICS = [
  { label: "Hours Saved / Week", value: "6.5", unit: "hrs", sub: "vs. 7h manual PM effort", accent: true },
  { label: "Tasks Analyzed", value: "47", unit: "", sub: "across 6 projects", accent: false },
  { label: "Summaries Posted", value: "24", unit: "", sub: "last 30 days", accent: false },
  { label: "Blockers Found", value: "3", unit: "", sub: "this week", accent: false },
];

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done" ? "#22c55e"
    : status === "active" ? "#0ed2c8"
    : status === "warn" ? "#f59e0b"
    : "#334155";

  return (
    <span
      className={status === "active" ? "animate-pulse-dot" : ""}
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function IntegrationCard({ integration }: { integration: typeof INTEGRATIONS[0] }) {
  const isRunning = integration.status === "running";
  return (
    <div
      style={{
        background: "#111827",
        border: "1px solid #1e2d45",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#0ed2c840")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d45")}
    >
      <span style={{ color: "#94a3b8" }}>{integration.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>
          {integration.name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748b", marginTop: 1 }}>
          {integration.detail}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <StatusDot status={isRunning ? "active" : "done"} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: isRunning ? "#0ed2c8" : "#22c55e" }}>
          {integration.status}
        </span>
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: typeof METRICS[0] }) {
  return (
    <div
      style={{
        background: metric.accent ? "linear-gradient(135deg, #0b2a2a 0%, #111827 100%)" : "#111827",
        border: `1px solid ${metric.accent ? "#0ed2c830" : "#1e2d45"}`,
        borderRadius: 12,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        transition: "transform 0.15s, border-color 0.2s",
        cursor: "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.borderColor = metric.accent ? "#0ed2c860" : "#2a3f5f";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.borderColor = metric.accent ? "#0ed2c830" : "#1e2d45";
      }}
    >
      {metric.accent && (
        <div style={{
          position: "absolute", top: -20, right: -20, width: 80, height: 80,
          background: "#0ed2c810", borderRadius: "50%",
        }} />
      )}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748b", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {metric.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 32,
          color: metric.accent ? "#0ed2c8" : "#e2e8f0", lineHeight: 1,
        }}>
          {metric.value}
        </span>
        {metric.unit && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#64748b" }}>{metric.unit}</span>
        )}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748b", marginTop: 6 }}>
        {metric.sub}
      </div>
    </div>
  );
}

function PipelineStep({ step, index }: { step: typeof PIPELINE_STEPS[0]; index: number }) {
  const statusColor =
    step.status === "done" ? "#22c55e"
    : step.status === "active" ? "#0ed2c8"
    : "#334155";

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: step.status === "active" ? "#0ed2c815" : step.status === "done" ? "#22c55e15" : "#1a2235",
          border: `1.5px solid ${statusColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {step.status === "done" ? (
            <svg viewBox="0 0 16 16" fill="none" width={12} height={12}>
              <path d="M3 8l3.5 3.5L13 5" stroke="#22c55e" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : step.status === "active" ? (
            <span className="animate-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ed2c8", display: "block" }} />
          ) : (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#334155", display: "block" }} />
          )}
        </div>
        {index < PIPELINE_STEPS.length - 1 && (
          <div style={{ width: 1, flex: 1, minHeight: 20, background: "#1e2d45", marginTop: 4 }} />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: index < PIPELINE_STEPS.length - 1 ? 18 : 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, color: step.status === "pending" ? "#475569" : "#e2e8f0" }}>
            {step.label}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#475569" }}>{step.duration}</span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b", marginBottom: 2 }}>
          {step.agent}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: step.status === "pending" ? "#334155" : "#94a3b8" }}>
          {step.detail}
        </div>
      </div>
    </div>
  );
}

function BlockerRow({ blocker }: { blocker: typeof BLOCKERS[0] }) {
  const sevColor = blocker.severity === "high" ? "#ef4444" : blocker.severity === "medium" ? "#f59e0b" : "#64748b";
  return (
    <div style={{
      background: "#111827",
      border: "1px solid #1e2d45",
      borderLeft: `3px solid ${sevColor}`,
      borderRadius: 8,
      padding: "12px 14px",
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: "4px 12px",
      alignItems: "start",
      transition: "border-color 0.2s",
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a3f5f")}
    onMouseLeave={e => (e.currentTarget.style.borderColor = "#1e2d45")}
    >
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: sevColor, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 }}>
          {blocker.project}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "#e2e8f0", lineHeight: 1.4 }}>
          {blocker.task}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748b", marginTop: 4 }}>
          Owner: {blocker.owner}
        </div>
      </div>
      <div style={{ textAlign: "right", paddingTop: 2 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          background: `${sevColor}18`, color: sevColor,
          padding: "2px 7px", borderRadius: 4, display: "inline-block",
          border: `1px solid ${sevColor}30`,
        }}>
          {blocker.severity}
        </span>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b", marginTop: 4 }}>
          Day {blocker.days}
        </div>
      </div>
    </div>
  );
}

function SummaryPanel() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines < SUMMARY_LINES.length) {
      const t = setTimeout(() => setVisibleLines(v => v + 1), 120);
      return () => clearTimeout(t);
    }
  }, [visibleLines]);

  return (
    <div style={{ fontFamily: "var(--font-body)", fontSize: 13, lineHeight: 1.7, color: "#94a3b8" }}>
      {SUMMARY_LINES.slice(0, visibleLines).map((line, i) => {
        if (!line) return <div key={i} style={{ height: 8 }} />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i} className="log-entry" style={{ animationDelay: `${i * 0.04}s` }}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={j} style={{ color: "#e2e8f0", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
                : part
            )}
          </div>
        );
      })}
      {visibleLines < SUMMARY_LINES.length && (
        <span style={{ display: "inline-block", width: 2, height: "1em", background: "#0ed2c8", marginLeft: 2, animation: "pulse-dot 0.7s ease-in-out infinite" }} />
      )}
    </div>
  );
}

function LogPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount < RUN_LOG.length) {
      const t = setTimeout(() => setVisibleCount(v => v + 1), 350);
      return () => clearTimeout(t);
    }
  }, [visibleCount]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [visibleCount]);

  const levelColor = (l: string) => l === "success" ? "#22c55e" : l === "warn" ? "#f59e0b" : "#64748b";

  return (
    <div ref={ref} style={{ overflowY: "auto", maxHeight: 180, display: "flex", flexDirection: "column", gap: 3 }}>
      {RUN_LOG.slice(0, visibleCount).map((entry, i) => (
        <div key={i} className="log-entry" style={{ display: "flex", gap: 10, alignItems: "flex-start", animationDelay: `${i * 0.05}s` }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#334155", flexShrink: 0, paddingTop: 1 }}>
            {entry.time}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: levelColor(entry.level), flexShrink: 0, paddingTop: 1, width: 52 }}>
            [{entry.level}]
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
            {entry.msg}
          </span>
        </div>
      ))}
      {visibleCount < RUN_LOG.length && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#334155" }}>▋</div>
      )}
    </div>
  );
}

function HoursSavedBar() {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(93), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b" }}>manual effort</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b" }}>7h / week</span>
      </div>
      <div style={{ height: 4, background: "#1a2235", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: "100%", background: "#334155", borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#0ed2c8" }}>with BizOps</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#0ed2c8" }}>0.5h / week</span>
      </div>
      <div style={{ height: 4, background: "#1a2235", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: "linear-gradient(90deg, #0ed2c8, #06b6d4)",
          width: `${width}%`,
          transition: "width 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
        }} />
      </div>
      <div style={{ marginTop: 12, padding: "8px 12px", background: "#0ed2c808", border: "1px solid #0ed2c820", borderRadius: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#0ed2c8" }}>
          93% reduction · ~$1,040 saved / month*
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [runState, setRunState] = useState<"idle" | "running" | "done">("done");
  const [activeTab, setActiveTab] = useState<"summary" | "blockers" | "log">("summary");
  const [nextRun] = useState("Mon 09:00 AM");

  const handleTrigger = () => {
    if (runState === "running") return;
    setRunState("running");
    setTimeout(() => setRunState("done"), 3000);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0f1a",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #1e2d45",
        padding: "0 28px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0d1220",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, #0ed2c8 0%, #06b6d4 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, color: "#e2e8f0", lineHeight: 1 }}>
              BizOps
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#64748b", letterSpacing: "0.08em" }}>
              STANDUP AGENT
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot status="active" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#64748b" }}>
              pipeline active
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#475569" }}>
            Next run: <span style={{ color: "#94a3b8" }}>{nextRun}</span>
          </div>
          <button
            onClick={handleTrigger}
            style={{
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12,
              background: runState === "running" ? "#0a1f1f" : "linear-gradient(135deg, #0ed2c8, #06b6d4)",
              color: runState === "running" ? "#0ed2c8" : "#0b0f1a",
              border: runState === "running" ? "1px solid #0ed2c840" : "none",
              borderRadius: 7, padding: "7px 16px", cursor: runState === "running" ? "default" : "pointer",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {runState === "running" ? (
              <>
                <span className="animate-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#0ed2c8", display: "inline-block" }} />
                Running...
              </>
            ) : "▶ Run Now"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "24px 28px", display: "grid", gridTemplateColumns: "280px 1fr 260px", gridTemplateRows: "auto 1fr auto", gap: 16, maxWidth: 1400, width: "100%", margin: "0 auto" }}>

        {/* Metrics row */}
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {METRICS.map(m => <MetricCard key={m.label} metric={m} />)}
        </div>

        {/* Left: Pipeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, padding: "18px 18px 16px",
            flex: 1,
          }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              Agent Pipeline
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b", fontWeight: 400 }}>
                run #24
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {PIPELINE_STEPS.map((step, i) => <PipelineStep key={step.id} step={step} index={i} />)}
            </div>
          </div>

          {/* Hours saved */}
          <div style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 4 }}>
              Hours Saved
            </div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748b", marginBottom: 8 }}>
              vs. manual PM standup effort
            </div>
            <HoursSavedBar />
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#334155", marginTop: 8 }}>
              *based on $75/hr avg PM rate · 52 weeks
            </div>
          </div>
        </div>

        {/* Center: Output */}
        <div style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1e2d45", padding: "0 18px" }}>
            {(["summary", "blockers", "log"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12,
                  color: activeTab === tab ? "#0ed2c8" : "#64748b",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "12px 14px 11px",
                  borderBottom: activeTab === tab ? "2px solid #0ed2c8" : "2px solid transparent",
                  transition: "color 0.15s",
                  textTransform: "capitalize",
                  letterSpacing: "0.02em",
                }}
              >
                {tab === "blockers" ? `Blockers (${BLOCKERS.length})` : tab === "log" ? "Run Log" : "Summary"}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {activeTab === "summary" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 4 }}>
                <StatusDot status="active" />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#0ed2c8" }}>generating</span>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
            {activeTab === "summary" && (
              <div className="animate-slide-in">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b",
                    background: "#1a2235", padding: "3px 8px", borderRadius: 4,
                    border: "1px solid #1e2d45",
                  }}>
                    → #executive-updates
                  </div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b",
                    background: "#1a2235", padding: "3px 8px", borderRadius: 4,
                    border: "1px solid #1e2d45",
                  }}>
                    gemini-1.5-pro
                  </div>
                </div>
                <SummaryPanel />
              </div>
            )}

            {activeTab === "blockers" && (
              <div className="animate-slide-in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                  3 blockers identified this week · sorted by severity
                </div>
                {BLOCKERS.map((b, i) => <BlockerRow key={i} blocker={b} />)}
              </div>
            )}

            {activeTab === "log" && (
              <div className="animate-slide-in">
                <div style={{
                  background: "#0b0f1a", borderRadius: 8, padding: "14px 16px",
                  border: "1px solid #1e2d45",
                }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#334155", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                    <span>bizops-agent · run #24 · 2026-08-21 09:01</span>
                    <StatusDot status="active" />
                  </div>
                  <LogPanel />
                </div>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          {activeTab === "summary" && (
            <div style={{ padding: "12px 18px", borderTop: "1px solid #1e2d45", display: "flex", gap: 8, alignItems: "center" }}>
              <button style={{
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12,
                background: "#0ed2c8", color: "#0b0f1a",
                border: "none", borderRadius: 7, padding: "7px 16px", cursor: "pointer",
                flex: 1, transition: "opacity 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Post to Slack
              </button>
              <button style={{
                fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 12,
                background: "none", color: "#64748b",
                border: "1px solid #1e2d45", borderRadius: 7, padding: "7px 14px", cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#334155"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; e.currentTarget.style.color = "#64748b"; }}
              >
                Edit Draft
              </button>
              <button style={{
                fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 12,
                background: "none", color: "#64748b",
                border: "1px solid #1e2d45", borderRadius: 7, padding: "7px 14px", cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#334155"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; e.currentTarget.style.color = "#64748b"; }}
              >
                Copy
              </button>
            </div>
          )}
        </div>

        {/* Right: Integrations + schedule */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 14 }}>
              Integrations
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {INTEGRATIONS.map(i => <IntegrationCard key={i.name} integration={i} />)}
            </div>
          </div>

          <div style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 14 }}>
              Schedule
            </div>
            {[
              { label: "Frequency", value: "Weekly, Monday" },
              { label: "Time", value: "09:00 AM UTC" },
              { label: "Notion DB", value: "Q3 Task Tracker" },
              { label: "Slack channel", value: "#executive-updates" },
              { label: "LLM", value: "gemini-1.5-pro" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #1a2235" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b" }}>{item.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94a3b8" }}>{item.value}</span>
              </div>
            ))}
            <button style={{
              width: "100%", marginTop: 14,
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12,
              background: "none", color: "#64748b",
              border: "1px solid #1e2d45", borderRadius: 7, padding: "8px 0", cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#334155"; e.currentTarget.style.color = "#94a3b8"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; e.currentTarget.style.color = "#64748b"; }}
            >
              Edit Config
            </button>
          </div>

          {/* Recent runs */}
          <div style={{ background: "#111827", border: "1px solid #1e2d45", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, color: "#e2e8f0", marginBottom: 12 }}>
              Recent Runs
            </div>
            {[
              { date: "Aug 18", status: "success", tasks: 47, time: "5.1s" },
              { date: "Aug 11", status: "success", tasks: 52, time: "4.8s" },
              { date: "Aug 04", status: "warn", tasks: 39, time: "6.2s" },
              { date: "Jul 28", status: "success", tasks: 44, time: "4.4s" },
            ].map((run, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < 3 ? "1px solid #1a2235" : "none" }}>
                <StatusDot status={run.status === "success" ? "done" : "warn"} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#94a3b8", flex: 1 }}>{run.date}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#64748b" }}>{run.tasks} tasks</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#475569" }}>{run.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stack badge row */}
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", paddingTop: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#334155" }}>STACK</span>
          {["Python", "CrewAI", "LangGraph", "Gemini API", "Slack API", "Notion API"].map(tech => (
            <span key={tech} style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              background: "#1a2235", color: "#64748b",
              padding: "3px 9px", borderRadius: 4,
              border: "1px solid #1e2d45",
            }}>
              {tech}
            </span>
          ))}
        </div>
      </main>
    </div>
  );
}
