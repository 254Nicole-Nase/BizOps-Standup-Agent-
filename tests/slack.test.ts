import { describe, expect, it } from "vitest"
import { computeMetrics, fallbackBrief } from "../server/analysis"
import { briefToBlocks, briefToText, escapeMrkdwn, weekOf } from "../server/slack"
import { sampleTasks } from "../server/sampleData"

const tasks = sampleTasks()
const metrics = computeMetrics(tasks)
const brief = fallbackBrief(tasks, metrics)

describe("Slack formatting", () => {
  it("escapes mrkdwn control characters", () => {
    expect(escapeMrkdwn("R&D <ops> team")).toBe("R&amp;D &lt;ops&gt; team")
  })

  it("computes the Monday of the week", () => {
    expect(weekOf(new Date("2026-10-15T10:00:00Z"))).toBe("Oct 12")
    expect(weekOf(new Date("2026-10-12T10:00:00Z"))).toBe("Oct 12")
  })

  it("builds valid Block Kit within Slack limits", () => {
    const blocks = briefToBlocks(brief, metrics)
    expect(blocks[0].type).toBe("header")
    expect(blocks.length).toBeLessThanOrEqual(50)
    for (const block of blocks) {
      if (block.text?.type === "mrkdwn") expect(block.text.text.length).toBeLessThanOrEqual(3000)
    }
  })

  it("includes every risk in the text fallback", () => {
    const text = briefToText(brief, metrics)
    for (const risk of brief.risks) expect(text).toContain(risk.project)
  })
})
