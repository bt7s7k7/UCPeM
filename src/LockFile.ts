import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { performance } from "perf_hooks"
import { Debug } from "./Debug"
import { DependencyTracker } from "./Project/DependencyTracker"
import { Project } from "./Project/Project"
import { executeCommand } from "./runner"
import { UserError } from "./UserError"

export class LockFile {
    public readonly entries = new Map<string, string>()

    public save() {
        const data: Record<string, string> = Object.create(null)
        for (const [name, ref] of [...this.entries].sort((a, b) => a[0] > b[0] ? 1 : -1)) {
            data[name] = ref
        }
        writeFileSync(this.path, JSON.stringify(data, null, 4) + "\n")
    }

    public async compare(newer: LockFile, callback?: (port: string, change: "added" | "removed" | "changed") => (Promise<void> | void)) {
        let mismatch = false

        const ports = new Set([...this.entries.keys(), ...newer.entries.keys()])
        for (const port of ports) {
            const oldRef = this.entries.get(port)
            const newRef = newer.entries.get(port)

            if (oldRef == null) {
                await callback?.(port, "added")
                mismatch = true
                continue
            }

            if (newRef == null) {
                await callback?.(port, "removed")
                mismatch = true
                continue
            }

            if (newRef != oldRef) {
                Debug.log("LOCK", `${JSON.stringify(newRef)} != ${JSON.stringify(oldRef)}`)
                await callback?.(port, "changed")
                mismatch = true
                continue
            }
        }

        return mismatch
    }

    constructor(
        public readonly path: string
    ) { }

    public static async makeForProject(project: Project) {
        const start = performance.now()
        const lock = new LockFile(join(project.path, "ucpem.lock"))
        const ports = DependencyTracker.dump().ports
        const queue: Promise<void>[] = []
        for (const port of Object.values(ports)) {
            queue.push((async () => {
                const path = join(project.portFolderPath, port.id)
                let attemptCount = 0
                while (true) {
                    try {
                        const result = await executeCommand("git rev-parse HEAD", path, { quiet: true })
                        const ref = result.trim()
                        if (ref == "") {
                            if (attemptCount > 10) {
                                throw new Error(`Git ref is empty??? at ${path}`)
                            } else {
                                attemptCount++
                                await new Promise(resolve => setTimeout(resolve, 100))
                                continue
                            }
                        }
                        lock.entries.set(port.id, ref)
                    } catch (err: any) {
                        if (err.code == "ENOENT") {
                            throw new UserError(`E075 Project references port "${port.id}", but it is not installed`)
                        }
                        throw err
                    }

                    break
                }
            })())
        }
        await Promise.all(queue)
        const end = performance.now()
        Debug.log("TIME", `Making lockfile from current ports took: ${(end - start).toFixed(2)}ms`)
        return lock
    }

    public static async getForProject(project: Project) {
        return this.loadFromProject(project) ?? this.makeForProject(project)
    }

    public static loadFromProject(project: Project) {
        const folder = project.path
        const path = join(folder, "ucpem.lock")
        return this.loadFromFile(path)
    }

    public static loadFromFile(path: string) {
        const start = performance.now()
        try {
            const content = readFileSync(path, { encoding: "utf-8" })
            const lock = new LockFile(path)
            if (content.trim() == "") return lock
            const data = JSON.parse(content)
            if (typeof data != "object" || data instanceof Array) throw new UserError(`E071 Expected object in lock file "${path}"`)
            for (const [name, ref] of Object.entries(data)) {
                if (typeof ref != "string") throw new UserError(`E070 Invalid value for "${name}" in lock file "${path}"`)
                lock.entries.set(name, ref)
            }
            const end = performance.now()
            Debug.log("TIME", `Loading lockfile took: ${(end - start).toFixed(2)}ms`)
            return lock
        } catch (err: any) {
            if (err.code == "ENOENT") {
                return null
            } else if (err instanceof SyntaxError) {
                throw new UserError(`E071 Cannot parse JSON in lock file "${path}": ${err.message}`)
            } else {
                throw err
            }
        }
    }
}
