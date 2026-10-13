import type { RunEvent, RunRecord, RunSettings, ServerStatus, Task } from "@/shared/types"

export type RunSummary = Omit<RunRecord, "tasks" | "logs"> & { taskCount: number }

const TOKEN_KEY = "bizops-admin-token"

export const getAdminToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ""
  } catch {
    return ""
  }
}

export const setAdminToken = (token: string) => {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage unavailable (private mode); the token just won't persist.
  }
}

const headers = () => ({
  "Content-Type": "application/json",
  ...(getAdminToken() ? { "x-admin-token": getAdminToken() } : {}),
})

const request = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, headers: headers() })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(json.error ?? `Request failed (${response.status})`), { status: response.status })
  return json as T
}

export const api = {
  status: () => request<ServerStatus>("/api/status"),
  tasks: () => request<{ source: string; tasks: Task[] }>("/api/tasks"),
  runs: () => request<{ runs: RunSummary[] }>("/api/runs").then((r) => r.runs),
  run: (id: string) => request<{ run: RunRecord }>(`/api/runs/${id}`).then((r) => r.run),
  publish: (id: string, override: boolean) =>
    request<{ run: RunRecord }>(`/api/runs/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ override }),
    }).then((r) => r.run),

  /** Start a run and invoke onEvent for every streamed NDJSON event. */
  startRun: async (settings: Partial<RunSettings>, onEvent: (event: RunEvent) => void) => {
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ settings }),
    })
    if (!response.ok || !response.body) {
      const json = await response.json().catch(() => ({}))
      throw new Error(json.error ?? `Run failed to start (${response.status})`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    for (;;) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) if (line.trim()) onEvent(JSON.parse(line))
      if (done) break
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer))
  },
}
