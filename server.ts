import "dotenv/config"
import express, { type NextFunction, type Request, type Response } from "express"
import path from "node:path"
import { z } from "zod"
import type { RunEvent, ServerStatus } from "./src/shared/types"
import { config, defaultModel, defaultSettings, providerConfigured } from "./server/config"
import { fetchDatabaseTitle, notionConfigured } from "./server/notion"
import { approveAndPublish, executeRun, isRunning, loadTasks } from "./server/pipeline"
import { scheduleStatus, startScheduler } from "./server/scheduler"
import { slackMode } from "./server/slack"
import { getRun, listRuns } from "./server/store"

const settingsSchema = z
  .object({
    slackChannel: z.string().trim().min(1).max(80),
    provider: z.enum(["cerebras", "gemini", "none"]),
    model: z.string().trim().min(1).max(80),
    minConfidence: z.number().int().min(0).max(100),
    highRiskLimit: z.number().int().min(0).max(20),
    autoPublish: z.boolean(),
  })
  .partial()

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    handler(req, res).catch(next)

/** If ADMIN_TOKEN is set, anything that runs the agent or posts to Slack needs it. */
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!config.adminToken || req.get("x-admin-token") === config.adminToken) return next()
  res.status(401).json({ error: "Admin token required" })
}

let databaseTitle: string | undefined

async function startServer() {
  const app = express()
  app.use(express.json({ limit: "100kb" }))

  app.get("/api/health", (_req, res) => res.json({ ok: true }))

  app.get(
    "/api/status",
    asyncRoute(async (_req, res) => {
      if (notionConfigured() && !databaseTitle) {
        databaseTitle = await fetchDatabaseTitle().catch(() => undefined)
      }
      const status: ServerStatus = {
        notion: { configured: notionConfigured(), database: databaseTitle },
        slack: {
          mode: slackMode() === "dry_run" ? "none" : (slackMode() as "bot" | "webhook"),
          defaultChannel: config.slack.defaultChannel,
        },
        providers: (["cerebras", "gemini", "none"] as const).map((id) => ({
          id,
          configured: providerConfigured(id),
          defaultModel: defaultModel(id),
        })),
        schedule: scheduleStatus(),
        defaults: defaultSettings(),
        authRequired: Boolean(config.adminToken),
      }
      res.json(status)
    }),
  )

  app.get(
    "/api/tasks",
    asyncRoute(async (_req, res) => res.json(await loadTasks())),
  )

  app.get(
    "/api/runs",
    asyncRoute(async (_req, res) => {
      // List view omits heavy fields; fetch a single run for full detail.
      const runs = (await listRuns()).map(({ tasks, logs, ...run }) => ({ ...run, taskCount: tasks.length }))
      res.json({ runs })
    }),
  )

  app.get(
    "/api/runs/:id",
    asyncRoute(async (req, res) => {
      const run = await getRun(String(req.params.id))
      if (!run) return res.status(404).json({ error: "Run not found" })
      res.json({ run })
    }),
  )

  // Start a run and stream progress as newline-delimited JSON events.
  app.post(
    "/api/runs",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const parsed = settingsSchema.safeParse(req.body?.settings ?? {})
      if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message })
      if (isRunning()) return res.status(409).json({ error: "A run is already in progress" })

      const settings = { ...defaultSettings(), ...parsed.data }
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache")
      res.setHeader("X-Accel-Buffering", "no")
      res.flushHeaders()

      const emit = (event: RunEvent) => {
        if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`)
      }
      try {
        await executeRun(settings, "manual", emit)
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : String(error) })
      }
      res.end()
    }),
  )

  app.post(
    "/api/runs/:id/publish",
    requireAdmin,
    asyncRoute(async (req, res) => {
      const run = await approveAndPublish(String(req.params.id), req.body?.override === true)
      res.json({ run })
    }),
  )

  app.use("/api", (_req: Request, res: Response) => res.status(404).json({ error: "Not found" }))
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error)
    res.status(error.status ?? 500).json({ error: error.message ?? "Internal error" })
  })

  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite")
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), "dist")
    app.use(express.static(distPath))
    app.get("*all", (_req, res) => res.sendFile(path.join(distPath, "index.html")))
  }

  app.listen(config.port, () => {
    console.log(`BizOps Standup Agent on http://localhost:${config.port}`)
    console.log(
      `Notion: ${notionConfigured() ? "connected" : "demo data"} · Slack: ${slackMode()} · LLM: ${defaultSettings().provider}`,
    )
  })
  startScheduler()
}

startServer()
