import { beforeEach, describe, expect, it, vi } from "vitest"
import { computeMetrics, fallbackBrief } from "../server/analysis"
import { config } from "../server/config"
import { composeBrief, extractJson, retryPolicy } from "../server/llm"
import { sampleTasks } from "../server/sampleData"

const tasks = sampleTasks()
const metrics = computeMetrics(tasks)
const validBrief = fallbackBrief(tasks, metrics)

const generateContent = vi.fn()
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent }
  },
}))

const reply = (text: string) => ({ text })
const apiError = (status: number, message = "busy") => Object.assign(new Error(message), { status })

beforeEach(() => {
  generateContent.mockReset()
})

describe("extractJson", () => {
  it("tolerates code fences and preamble", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Sure! Here it is: {"a":2} hope that helps')).toEqual({ a: 2 })
    expect(() => extractJson("no json here")).toThrow()
  })
})

describe("composeBrief (Gemini)", () => {
  config.gemini.apiKey = "test-key"

  it("returns a validated brief", async () => {
    generateContent.mockResolvedValue(reply(JSON.stringify(validBrief)))
    const result = await composeBrief("gemini-2.5-flash", tasks, metrics)
    expect(result.brief.headline).toBe(validBrief.headline)
    expect(result.attempts).toBe(1)
    const request = generateContent.mock.calls[0][0]
    expect(request.model).toBe("gemini-2.5-flash")
    expect(request.config.responseMimeType).toBe("application/json")
  })

  it("feeds validation errors back for one repair attempt", async () => {
    generateContent
      .mockResolvedValueOnce(reply('{"headline":"x"}'))
      .mockResolvedValueOnce(reply(JSON.stringify(validBrief)))
    const result = await composeBrief("m", tasks, metrics)
    expect(result.attempts).toBe(2)
    expect(generateContent.mock.calls[1][0].contents).toContain("rejected by the validator")
  })

  it("throws after two invalid replies", async () => {
    generateContent.mockResolvedValue(reply("not json"))
    await expect(composeBrief("m", tasks, metrics)).rejects.toThrow(/validation/)
  })

  it("surfaces API errors", async () => {
    generateContent.mockRejectedValue(apiError(401, "bad key"))
    await expect(composeBrief("m", tasks, metrics)).rejects.toThrow("bad key")
  })
})

describe("transient provider errors", () => {
  retryPolicy.delaysMs = [0, 0]

  it("retries a 503 and a 429, then succeeds", async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce(reply(JSON.stringify(validBrief)))
    const result = await composeBrief("m", tasks, metrics)
    expect(result.brief.headline).toBe(validBrief.headline)
    expect(generateContent).toHaveBeenCalledTimes(3)
  })

  it("gives up after the retries run out", async () => {
    generateContent.mockRejectedValue(apiError(503, "high demand"))
    await expect(composeBrief("m", tasks, metrics)).rejects.toThrow("high demand")
    expect(generateContent).toHaveBeenCalledTimes(3)
  })

  it("does not retry a non-transient error such as 403", async () => {
    generateContent.mockRejectedValue(apiError(403, "forbidden"))
    await expect(composeBrief("m", tasks, metrics)).rejects.toThrow("forbidden")
    expect(generateContent).toHaveBeenCalledTimes(1)
  })
})
