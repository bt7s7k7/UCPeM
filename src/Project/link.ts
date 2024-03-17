import chalk from "chalk"
import { symlinkSync } from "fs"
import { relative } from "path"
import { state } from "../global"
import { DependencyTracker } from "./DependencyTracker"

export function link(source: string, target: string, sourceGlobal = false, targetGlobal = false) {
    const projectRoot = DependencyTracker.getRootProject().path
    const sourcePath = sourceGlobal ? source : "./" + relative(projectRoot, source)
    const targetPath = targetGlobal ? target : "./" + relative(projectRoot, target)

    const message = `[${chalk.cyanBright("LINK")}] Linking ${sourcePath} → ${targetPath}`
    if (!state.quiet) {
        if (state.compact) {
            process.stdout.write("\r\u001b[A\u001b[K" + message + "\r\n")
        } else {
            console.log(message)
        }
    }

    LinkHistory.push({ source, target })

    try {
        symlinkSync(source, target, "junction")
    } catch (err) {
        if (err.code == "EEXIST") {
            if (!state.compact && !state.quiet) console.log(`    └─ File already exists`)
        } else {
            throw err
        }
    }
}

export namespace LinkHistory {
    export interface Entry {
        source: string
        target: string
    }

    export let history: Entry[] = []

    export function push(entry: Entry) {
        history.push(entry)
    }
}
