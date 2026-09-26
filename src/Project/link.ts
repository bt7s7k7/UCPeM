import chalk from "chalk"
import { existsSync, symlinkSync } from "fs"
import { relative } from "path"
import { state } from "../global"
import { DependencyTracker } from "./DependencyTracker"
import { GitIgnoreGenerator } from "../Install/GitIgnoreGenerator"

function _link(source: string, target: string, sourcePath: string, targetPath: string, gitignore: string | null) {
    const message = `[${chalk.cyanBright("LINK")}] Linking ${sourcePath} → ${targetPath}`
    if (!state.quiet) {
        if (state.compact) {
            process.stdout.write("\r\u001b[A\u001b[K" + message + "\r\n")
        } else {
            console.log(message)
        }
    }

    LinkHistory.push({ source, target })
    if (gitignore != null) {
        GitIgnoreGenerator.addIgnore(gitignore, relative(gitignore, target))
    }

    try {
        symlinkSync(source, target, "junction")
    } catch (err: any) {
        if (err.code == "EEXIST") {
            if (!state.compact && !state.quiet) console.log(`    └─ File already exists`)
        } else {
            throw err
        }
    }
}

export function link(source: string, target: string, { sourceGlobal = false, targetGlobal = false, gitignore = null as string | null } = {}) {
    const projectRoot = DependencyTracker.getRootProject().path
    const sourcePath = sourceGlobal ? source : "./" + relative(projectRoot, source)
    const targetPath = targetGlobal ? target : "./" + relative(projectRoot, target)

    _link(source, target, sourcePath, targetPath, gitignore)

    // Also link .dll debugging symbols if extant
    if (source.endsWith(".dll")) {
        const pdbSourcePath = sourcePath.slice(0, -4) + ".pdb"
        if (existsSync(pdbSourcePath)) {
            const pdbTargetPath = targetPath.slice(0, -4) + ".pdb"
            const pdbTarget = target.slice(0, -4) + ".pdb"
            const pdbSource = source.slice(0, -4) + ".pdb"
            _link(pdbSource, pdbTarget, pdbSourcePath, pdbTargetPath, gitignore)
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
