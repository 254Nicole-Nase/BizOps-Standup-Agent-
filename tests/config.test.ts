import { describe, expect, it, vi } from "vitest"

describe("proxy-injected credentials", () => {
  it("treats injected services as configured without exposing a header", async () => {
    vi.resetModules()
    vi.stubEnv("PROXY_INJECTED_CREDENTIALS", "notion, Cerebras")
    const { authHeader, hasCredential } = await import("../server/config")
    expect(hasCredential("notion")).toBe(true)
    expect(hasCredential("cerebras")).toBe(true)
    expect(hasCredential("slack")).toBe(false)
    expect(hasCredential("slack", "xoxb-1")).toBe(true)
    expect(authHeader(undefined)).toEqual({})
    expect(authHeader("abc")).toEqual({ Authorization: "Bearer abc" })
    vi.unstubAllEnvs()
  })
})
