import { describe, expect, it, vi } from "vitest"

describe("proxy-injected credentials", () => {
  it("treats injected services as configured without exposing a header", async () => {
    vi.resetModules()
    vi.stubEnv("PROXY_INJECTED_CREDENTIALS", " Notion ")
    const { authHeader, hasCredential } = await import("../server/config")
    expect(hasCredential("notion")).toBe(true)
    expect(hasCredential("slack")).toBe(false)
    expect(hasCredential("slack", "xoxb-1")).toBe(true)
    expect(authHeader(undefined)).toEqual({})
    expect(authHeader("abc")).toEqual({ Authorization: "Bearer abc" })
    vi.unstubAllEnvs()
  })
})

describe("resolveSettings", () => {
  it("uses the chosen provider's default model when no model is given", async () => {
    vi.resetModules()
    vi.stubEnv("GEMINI_API_KEY", "g")
    vi.stubEnv("GEMINI_MODEL", "")
    const { resolveSettings } = await import("../server/config")
    expect(resolveSettings({})).toMatchObject({ provider: "gemini", model: "gemini-flash-latest" })
    expect(resolveSettings({ provider: "gemini" })).toMatchObject({ provider: "gemini", model: "gemini-flash-latest" })
    expect(resolveSettings({ provider: "gemini", model: "gemini-2.5-pro" }).model).toBe("gemini-2.5-pro")
    expect(resolveSettings({ provider: "none" }).model).toBe("deterministic")
    vi.unstubAllEnvs()
  })
})
