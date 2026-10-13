import cron, { type ScheduledTask } from "node-cron"
import { config, defaultSettings } from "./config"
import { executeRun, isRunning } from "./pipeline"

let task: ScheduledTask | null = null

/** Scheduled runs auto-publish, but only when every quality gate passes. */
export const startScheduler = () => {
  const { cron: expression, timezone } = config.schedule
  if (!expression) return
  if (!cron.validate(expression)) {
    console.warn(`SCHEDULE_CRON "${expression}" is invalid, so the scheduler is disabled.`)
    return
  }
  task = cron.schedule(
    expression,
    async () => {
      if (isRunning()) return console.warn("Scheduled run skipped because another run is in progress.")
      const run = await executeRun({ ...defaultSettings(), autoPublish: true }, "schedule")
      console.log(`Scheduled run #${run.number} finished: ${run.status}`)
    },
    { timezone, noOverlap: true },
  )
  console.log(`Scheduler armed: "${expression}" (${timezone})`)
}

export const scheduleStatus = () => ({
  enabled: Boolean(task),
  cron: config.schedule.cron,
  timezone: config.schedule.timezone,
  nextRun: task?.getNextRun()?.toISOString(),
})
