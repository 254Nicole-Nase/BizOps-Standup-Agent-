import type { Task } from "../src/shared/types"

const isoDaysFromNow = (days: number, now: Date) => {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Demo tracker used when Notion is not configured. Dates are relative to
 * "now" so blocker ages and due-date pressure stay realistic on every run.
 */
export const sampleTasks = (now = new Date()): Task[] => {
  const due = (days: number) => isoDaysFromNow(days, now)
  return [
    {
      id: "demo-1",
      project: "Platform Rebrand",
      owner: "Maya Chen",
      status: "blocked",
      progress: 78,
      blocker: "Final logo sign-off pending from the CMO",
      blockerAgeDays: 4,
      dueDate: due(6),
      latestUpdate: "All assets ready for launch except the primary mark. Web templates are done.",
    },
    {
      id: "demo-2",
      project: "API v3 Launch",
      owner: "James Park",
      status: "blocked",
      progress: 64,
      blocker: "Load-test environment not allocated by Infra",
      blockerAgeDays: 2,
      dueDate: due(12),
      latestUpdate: "Endpoints are feature complete. Waiting on a perf environment to validate the 5k RPS target.",
    },
    {
      id: "demo-3",
      project: "Customer Portal",
      owner: "Sara Liu",
      status: "at_risk",
      progress: 86,
      blocker: "Legal review of the new data-retention terms",
      blockerAgeDays: 5,
      dueDate: due(3),
      latestUpdate: "UAT passed. Legal has not responded on the ToS changes, and that blocks go-live.",
    },
    {
      id: "demo-4",
      project: "Partner Onboarding",
      owner: "Ari Patel",
      status: "in_progress",
      progress: 72,
      dueDate: due(18),
      latestUpdate: "3 of 5 launch partners integrated. Docs portal live.",
    },
    {
      id: "demo-5",
      project: "Billing Automation",
      owner: "Noah Kim",
      status: "in_progress",
      progress: 58,
      dueDate: due(-2),
      latestUpdate: "Invoice generation done. Dunning flows slipped a sprint because of a Stripe webhook bug.",
    },
    {
      id: "demo-6",
      project: "Security Audit",
      owner: "Dina Rahman",
      status: "done",
      progress: 100,
      dueDate: due(-5),
      latestUpdate: "SOC 2 Type II fieldwork complete with zero critical findings.",
    },
    {
      id: "demo-7",
      project: "Support AI Copilot",
      owner: "Ethan Hall",
      status: "done",
      progress: 100,
      dueDate: due(-3),
      latestUpdate: "Rolled out to 100% of agents. Median handle time down 18%.",
    },
    {
      id: "demo-8",
      project: "Data Warehouse Cleanup",
      owner: "Lena Ortiz",
      status: "at_risk",
      progress: 49,
      blocker: "Two analysts reassigned to the board-deck request",
      blockerAgeDays: 1,
      dueDate: due(25),
      latestUpdate: "Deprecated 40% of stale tables. Velocity halved this week.",
    },
    {
      id: "demo-9",
      project: "Retention Campaign",
      owner: "Ivy Gomez",
      status: "done",
      progress: 100,
      dueDate: due(-1),
      latestUpdate: "Win-back sequence shipped. Early read: +3.1pt reactivation.",
    },
    {
      id: "demo-10",
      project: "Compliance Vault",
      owner: "Marco Silva",
      status: "in_progress",
      progress: 68,
      dueDate: due(30),
      latestUpdate: "Encryption-at-rest rollout on track. Key-rotation runbook in review.",
    },
    {
      id: "demo-11",
      project: "Mobile App 2.0",
      owner: "Priya Nair",
      status: "not_started",
      progress: 0,
      dueDate: due(45),
      latestUpdate: "Kickoff scheduled once Platform Rebrand assets land.",
    },
  ]
}
