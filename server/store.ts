import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type { RunRecord } from "../src/shared/types"
import { config } from "./config"

const MAX_RUNS = 100
const file = () => path.resolve(config.dataDir, "runs.json")

let cache: RunRecord[] | null = null
let writing: Promise<void> = Promise.resolve()

const load = async (): Promise<RunRecord[]> => {
  if (cache) return cache
  try {
    cache = JSON.parse(await readFile(file(), "utf8"))
  } catch {
    cache = []
  }
  return cache!
}

/** Serialised atomic write (tmp file + rename) so concurrent saves can't corrupt history. */
const persist = () => {
  writing = writing.then(async () => {
    await mkdir(path.dirname(file()), { recursive: true })
    const tmp = `${file()}.tmp`
    await writeFile(tmp, JSON.stringify(cache, null, 2))
    await rename(tmp, file())
  })
  return writing
}

export const listRuns = async () => load()

export const getRun = async (id: string) => (await load()).find((run) => run.id === id)

export const nextRunNumber = async () => ((await load())[0]?.number ?? 0) + 1

export const saveRun = async (run: RunRecord) => {
  const runs = await load()
  const index = runs.findIndex((item) => item.id === run.id)
  if (index === -1) runs.unshift(run)
  else runs[index] = run
  cache = runs.slice(0, MAX_RUNS)
  await persist()
}
