import type { LlmProvider, RunSettings } from "../src/shared/types"

const env = (key: string) => process.env[key]?.trim() || undefined

const num = (key: string, fallback: number) => {
  const parsed = Number(env(key))
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Services whose credentials are injected by an outbound proxy (e.g. Claude Code
 * cloud "network secrets"). The app treats them as configured and sends no
 * Authorization header, so the key never exists in this process.
 */
const injected = new Set(
  (env("PROXY_INJECTED_CREDENTIALS") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
)

export const hasCredential = (service: "notion" | "slack" | "cerebras", token?: string) =>
  Boolean(token) || injected.has(service)

/** Authorization header for a service, omitted when the proxy injects it. */
export const authHeader = (token?: string): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {}

export const config = {
  port: num("PORT", 3000),
  adminToken: env("ADMIN_TOKEN"),
  dataDir: env("DATA_DIR") ?? "data",

  notion: {
    token: env("NOTION_TOKEN"),
    databaseId: env("NOTION_DATABASE_ID"),
    /** Optional JSON map overriding property names, e.g. {"owner":"Assignee"} */
    propertyMap: env("NOTION_PROPERTY_MAP"),
  },

  slack: {
    botToken: env("SLACK_BOT_TOKEN"),
    webhookUrl: env("SLACK_WEBHOOK_URL"),
    defaultChannel: env("SLACK_CHANNEL") ?? "#executive-updates",
  },

  cerebras: {
    apiKey: env("CEREBRAS_API_KEY"),
    model: env("CEREBRAS_MODEL") ?? "gpt-oss-120b",
    baseUrl: env("CEREBRAS_BASE_URL") ?? "https://api.cerebras.ai/v1",
  },

  gemini: {
    apiKey: env("GEMINI_API_KEY"),
    model: env("GEMINI_MODEL") ?? "gemini-flash-latest",
  },

  schedule: {
    cron: env("SCHEDULE_CRON"),
    timezone: env("SCHEDULE_TZ") ?? "UTC",
  },

  gates: {
    minConfidence: num("MIN_CONFIDENCE", 70),
    highRiskLimit: num("HIGH_RISK_LIMIT", 2),
  },
}

export const providerConfigured = (provider: LlmProvider) =>
  provider === "cerebras"
    ? hasCredential("cerebras", config.cerebras.apiKey)
    : provider === "gemini"
      ? Boolean(config.gemini.apiKey)
      : true

export const defaultModel = (provider: LlmProvider) =>
  provider === "cerebras"
    ? config.cerebras.model
    : provider === "gemini"
      ? config.gemini.model
      : "deterministic"

/** Cerebras first (fastest), then Gemini, then the deterministic writer. */
export const defaultProvider = (): LlmProvider =>
  providerConfigured("cerebras") ? "cerebras" : providerConfigured("gemini") ? "gemini" : "none"

export const defaultSettings = (): RunSettings => {
  const provider = defaultProvider()
  return {
    slackChannel: config.slack.defaultChannel,
    provider,
    model: defaultModel(provider),
    minConfidence: config.gates.minConfidence,
    highRiskLimit: config.gates.highRiskLimit,
    autoPublish: false,
  }
}
