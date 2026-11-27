import { appendFileSync, readdirSync, readFileSync } from "node:fs"

const cgroup = "/proc/1/root/sys/fs/cgroup"
const field = (text: string, key: string) => Number(text.match(new RegExp(`^${key} (\\d+)`, "m"))?.[1] ?? 0)

function sample() {
  const read = (path: string) => readFileSync(`${cgroup}/${path}`, "utf8")
  const memory = Number(read("memory.current"))
  const stat = read("memory.stat")
  let processes = 0
  let threads = 0
  let fds = 0
  for (const id of readdirSync("/proc")) {
    if (!/^\d+$/.test(id) || Number(id) === process.pid) continue
    try {
      const status = readFileSync(`/proc/${id}/status`, "utf8")
      if (!/^VmRSS:/m.test(status)) continue
      processes++
      threads += Number(status.match(/^Threads:\s*(\d+)/m)?.[1] ?? 0)
      fds += readdirSync(`/proc/${id}/fd`).length
    } catch {
      // Processes can exit between reading /proc entries.
    }
  }
  appendFileSync(
    "/bench/samples.jsonl",
    `${JSON.stringify({
      t: Date.now(),
      cpu: field(read("cpu.stat"), "usage_usec") / 1e6,
      memory,
      working: Math.max(0, memory - field(stat, "inactive_file")),
      anon: field(stat, "anon"),
      processes,
      threads,
      fds,
      pids: Number(read("pids.current")),
      oomKills: field(read("memory.events"), "oom_kill"),
    })}\n`,
  )
}

sample()
setInterval(sample, 250)
