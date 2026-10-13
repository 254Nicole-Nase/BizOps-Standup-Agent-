import { afterEach, describe, expect, it, vi } from "vitest"
import { computeMetrics, fallbackBrief } from "../server/analysis"
import { config } from "../server/config"
import { composeBrief, extractJson, retryPolicy } from "../server/llm"
import { sampleTasks } from "../server/sampleData"

const tasks = sampleTasks()
const metrics = computeMetrics(tasks)
const validBrief = fallbackBrief(tasks, metrics)

const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

afterEach(() => vi.unstubAllGlobals())

describe("extractJson", () => {
  it("tolerates code fences and preamble", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Sure! Here it is: {"a":2} hope that helps')).toEqual({ a: 2 })
    expect(() => extractJson("no json here")).toThrow()
  })
})

describe("composeBrief (Cerebras)", () => {
  config.cerebras.apiKey = "test-key"

  it("returns a validated brief", async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion(JSON.stringify(validBrief)))
    vi.stubGlobal("fetch", fetchMock)
    const result = await composeBrief("cerebras", "gpt-oss-120b", tasks, metrics)
    expect(result.brief.headline).toBe(validBrief.headline)
    expect(result.attempts).toBe(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe("gpt-oss-120b")
    expect(body.response_format).toEqual({ type: "json_object" })
  })

  it("feeds validation errors back for one repair attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion('{"headline":"x"}'))
      .mockResolvedValueOnce(completion(JSON.stringify(validBrief)))
    vi.stubGlobal("fetch", fetchMock)
    const result = await composeBrief("cerebras", "gpt-oss-120b", tasks, metrics)
    expect(result.attempts).toBe(2)
    const repairPrompt = JSON.parse(fetchMock.mock.calls[1][1].body).messages[1].content
    expect(repairPrompt).toContain("rejected by the validator")
  })

  it("throws after two invalid replies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => completion("not json")))
    await expect(composeBrief("cerebras", "m", tasks, metrics)).rejects.toThrow(/validation/)
  })

  it("surfaces API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "bad key" }), { status: 401 })),
    )
    await expect(composeBrief("cerebras", "m", tasks, metrics)).rejects.toThrow("Cerebras 401: bad key")
  })
})

describe("transient provider errors", () => {
  retryPolicy.delaysMs = [0, 0]
  const failure = (status: number) => new Response(JSON.stringify({ message: "busy" }), { status })

  it("retries a 503 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure(503))
      .mockResolvedValueOnce(failure(429))
      .mockResolvedValueOnce(completion(JSON.stringify(validBrief)))
    vi.stubGlobal("fetch", fetchMock)
    const result = await composeBrief("cerebras", "gpt-oss-120b", tasks, metrics)
    expect(result.brief.headline).toBe(validBrief.headline)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("gives up after the retries run out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failure(503))
    vi.stubGlobal("fetch", fetchMock)
    await expect(composeBrief("cerebras", "gpt-oss-120b", tasks, metrics)).rejects.toThrow("Cerebras 503")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("does not retry a non-transient error such as 402", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failure(402))
    vi.stubGlobal("fetch", fetchMock)
    await expect(composeBrief("cerebras", "gpt-oss-120b", tasks, metrics)).rejects.toThrow("Cerebras 402")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
