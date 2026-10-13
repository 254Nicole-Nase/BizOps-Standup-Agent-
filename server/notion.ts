import type { Task, TaskStatus } from "../src/shared/types"
import { authHeader, config, hasCredential } from "./config"

const NOTION_VERSION = "2022-06-28"
const DAY_MS = 86_400_000

type Field =
  | "project"
  | "owner"
  | "status"
  | "progress"
  | "blocker"
  | "blockedSince"
  | "dueDate"
  | "update"

/** Property names we look for (case-insensitive) when no override is given. */
const CANDIDATES: Record<Field, string[]> = {
  project: ["Project", "Name", "Task", "Title"],
  owner: ["Owner", "Assignee", "Assigned To", "DRI", "Lead"],
  status: ["Status", "State", "Stage"],
  progress: ["Progress", "% Complete", "Percent Complete", "Completion"],
  blocker: ["Blocker", "Blockers", "Blocked By", "Risk"],
  blockedSince: ["Blocked Since", "Flagged On", "Risk Since"],
  dueDate: ["Due", "Due Date", "Deadline", "Target Date"],
  update: ["Update", "Latest Update", "Notes", "Status Update"],
}

type NotionProperty = { type: string; [key: string]: any }
type NotionPage = {
  id: string
  url: string
  last_edited_time: string
  properties: Record<string, NotionProperty>
}

const plainText = (items: any[] | undefined) =>
  (items ?? []).map((item) => item.plain_text ?? "").join("").trim()

/** Flatten any Notion property value to a string, number or date. */
export const readProperty = (
  property: NotionProperty | undefined,
): string | number | undefined => {
  if (!property) return undefined
  switch (property.type) {
    case "title":
    case "rich_text":
      return plainText(property[property.type]) || undefined
    case "select":
    case "status":
      return property[property.type]?.name
    case "multi_select":
      return property.multi_select.map((item: any) => item.name).join(", ") || undefined
    case "people":
      return property.people.map((person: any) => person.name).filter(Boolean).join(", ") || undefined
    case "number":
      return property.number ?? undefined
    case "date":
      return property.date?.start
    case "formula": {
      const formula = property.formula
      return formula?.[formula.type] ?? undefined
    }
    case "rollup": {
      const rollup = property.rollup
      if (rollup?.type === "number") return rollup.number ?? undefined
      if (rollup?.type === "date") return rollup.date?.start
      return undefined
    }
    case "checkbox":
      return property.checkbox ? "true" : undefined
    default:
      return undefined
  }
}

export const normalizeStatus = (raw: string | undefined): TaskStatus => {
  const value = (raw ?? "").toLowerCase()
  if (/(done|complete|shipped|launched|closed|resolved)/.test(value)) return "done"
  if (/block|stuck|on hold/.test(value)) return "blocked"
  if (/risk|delay|slipping|behind|off.?track/.test(value)) return "at_risk"
  if (/(not started|todo|to do|backlog|planned|queued)/.test(value)) return "not_started"
  return "in_progress"
}

/** Accepts 0-1 fractions (Notion percent format) or 0-100 values. */
export const normalizeProgress = (raw: unknown, status: TaskStatus) => {
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""))
  if (!Number.isFinite(value)) return status === "done" ? 100 : 0
  const percent = value <= 1 ? value * 100 : value
  return Math.round(Math.min(100, Math.max(0, percent)))
}

const resolvePropertyNames = (
  properties: Record<string, NotionProperty>,
  overrides: Partial<Record<Field, string>>,
): Partial<Record<Field, string>> => {
  const byLower = new Map(Object.keys(properties).map((name) => [name.toLowerCase(), name]))
  const resolved: Partial<Record<Field, string>> = {}

  for (const field of Object.keys(CANDIDATES) as Field[]) {
    const names = overrides[field] ? [overrides[field]!] : CANDIDATES[field]
    resolved[field] = names
      .map((name) => byLower.get(name.toLowerCase()))
      .find(Boolean)
  }

  // Every database has exactly one title property; use it if no name matched.
  resolved.project ??= Object.keys(properties).find(
    (name) => properties[name].type === "title",
  )
  return resolved
}

const parseOverrides = (): Partial<Record<Field, string>> => {
  if (!config.notion.propertyMap) return {}
  try {
    return JSON.parse(config.notion.propertyMap)
  } catch {
    console.warn("NOTION_PROPERTY_MAP is not valid JSON; ignoring it.")
    return {}
  }
}

export const pageToTask = (
  page: NotionPage,
  overrides: Partial<Record<Field, string>> = {},
  now = new Date(),
): Task => {
  const names = resolvePropertyNames(page.properties, overrides)
  const read = (field: Field) =>
    names[field] ? readProperty(page.properties[names[field]!]) : undefined

  const status = normalizeStatus(read("status") as string | undefined)
  const blocker = read("blocker")
  const blockedSince = read("blockedSince") as string | undefined

  // Age a blocker from an explicit "Blocked Since" date, otherwise from the
  // last edit (the closest proxy Notion gives us for when the status changed).
  const flagged = status === "blocked" || status === "at_risk" || Boolean(blocker)
  const ageFrom = blockedSince ?? (flagged ? page.last_edited_time : undefined)
  const blockerAgeDays = ageFrom
    ? Math.max(0, Math.floor((now.getTime() - new Date(ageFrom).getTime()) / DAY_MS))
    : undefined

  return {
    id: page.id,
    project: String(read("project") ?? "Untitled"),
    owner: String(read("owner") ?? "Unassigned"),
    status,
    progress: normalizeProgress(read("progress"), status),
    blocker: blocker ? String(blocker) : undefined,
    blockerAgeDays: flagged ? blockerAgeDays : undefined,
    dueDate: (read("dueDate") as string | undefined)?.slice(0, 10),
    latestUpdate: read("update") ? String(read("update")) : undefined,
    url: page.url,
    lastEditedAt: page.last_edited_time,
  }
}

const notionFetch = async (path: string, body?: unknown) => {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...authHeader(config.notion.token),
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json: any = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Notion API ${response.status}: ${json.message ?? response.statusText}`)
  }
  return json
}

export const notionConfigured = () =>
  hasCredential("notion", config.notion.token) && Boolean(config.notion.databaseId)

export const fetchDatabaseTitle = async () => {
  const database = await notionFetch(`/databases/${config.notion.databaseId}`)
  return plainText(database.title) || "Untitled database"
}

/** Query every page in the tracker database (handles pagination). */
export const fetchNotionTasks = async (): Promise<Task[]> => {
  const overrides = parseOverrides()
  const pages: NotionPage[] = []
  let cursor: string | undefined

  do {
    const result = await notionFetch(`/databases/${config.notion.databaseId}/query`, {
      page_size: 100,
      start_cursor: cursor,
    })
    pages.push(...result.results.filter((page: any) => page.object === "page"))
    cursor = result.has_more ? result.next_cursor : undefined
  } while (cursor && pages.length < 1000)

  return pages.map((page) => pageToTask(page, overrides))
}
