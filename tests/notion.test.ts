import { describe, expect, it } from "vitest"
import { normalizeProgress, normalizeStatus, pageToTask } from "../server/notion"

const text = (value: string) => [{ plain_text: value }]

describe("Notion mapping", () => {
  it("normalizes common status vocabularies", () => {
    expect(normalizeStatus("Shipped")).toBe("done")
    expect(normalizeStatus("Blocked")).toBe("blocked")
    expect(normalizeStatus("Off track")).toBe("at_risk")
    expect(normalizeStatus("Backlog")).toBe("not_started")
    expect(normalizeStatus("Doing")).toBe("in_progress")
    expect(normalizeStatus(undefined)).toBe("in_progress")
  })

  it("accepts fractional and percentage progress", () => {
    expect(normalizeProgress(0.42, "in_progress")).toBe(42)
    expect(normalizeProgress(64, "in_progress")).toBe(64)
    expect(normalizeProgress(undefined, "done")).toBe(100)
    expect(normalizeProgress(140, "in_progress")).toBe(100)
  })

  it("maps a page using fuzzy property names", () => {
    const task = pageToTask(
      {
        id: "page-1",
        url: "https://notion.so/page-1",
        last_edited_time: "2026-10-10T12:00:00Z",
        properties: {
          "Initiative": { type: "title", title: text("API v3 Launch") },
          assignee: { type: "people", people: [{ name: "James Park" }] },
          Status: { type: "status", status: { name: "Blocked" } },
          Progress: { type: "number", number: 0.64 },
          Blocker: { type: "rich_text", rich_text: text("No load-test env") },
          "Due Date": { type: "date", date: { start: "2026-10-25" } },
        },
      },
      {},
      new Date("2026-10-13T12:00:00Z"),
    )
    expect(task).toMatchObject({
      project: "API v3 Launch",
      owner: "James Park",
      status: "blocked",
      progress: 64,
      blocker: "No load-test env",
      blockerAgeDays: 3,
      dueDate: "2026-10-25",
    })
  })

  it("honours explicit property overrides", () => {
    const task = pageToTask(
      {
        id: "p",
        url: "",
        last_edited_time: "2026-10-13T00:00:00Z",
        properties: {
          Name: { type: "title", title: text("X") },
          Phase: { type: "select", select: { name: "Done" } },
        },
      },
      { status: "Phase" },
    )
    expect(task.status).toBe("done")
    expect(task.progress).toBe(100)
  })
})
