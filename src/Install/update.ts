import chalk from "chalk"
import { lstatSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { performance } from "perf_hooks"
import { Debug } from "../Debug"
import { CURRENT_PATH } from "../global"
import { Project } from "../Project/Project"
import { executeCommand } from "../runner"
import { UserError } from "../UserError"

function* _enumerateInstalledPorts(project: Project) {
    const installedPorts = readdirSync(project.portFolderPath)

    for (const portFolder of installedPorts) {
        const fullPath = join(project.portFolderPath, portFolder)
        if (statSync(fullPath).isDirectory()) {
            yield portFolder
        }
    }
}

export async function update(updateLinkedPorts: false | "include local ports" = false) {
    const project = Project.fromDirectory(CURRENT_PATH)
    for (const portFolder of _enumerateInstalledPorts(project)) {
        const fullPath = join(project.portFolderPath, portFolder)
        if (statSync(fullPath).isDirectory()) {
            if (updateLinkedPorts || !lstatSync(fullPath).isSymbolicLink()) {
                await executeCommand(`git pull`, fullPath)
            } else {
                console.log(`Not updating "${portFolder}" because it's probably a local link port`)
            }
        }
    }
}

export async function checkChanges(project: Project) {
    const start = performance.now()
    let changeDetected = false
    const queue: Promise<void>[] = []
    for (const portFolder of _enumerateInstalledPorts(project)) {
        queue.push((async () => {
            const fullPath = join(project.portFolderPath, portFolder)
            if (statSync(fullPath).isDirectory()) {
                const result = await executeCommand(`git status --porcelain=v1`, fullPath, { quiet: true })
                if (result.trim() != "") {
                    changeDetected = true
                    console.log(`${portFolder}: ${"\n" + result}`)
                } else {
                    console.log(chalk.grey(`${portFolder}: No changes`))
                }
            }
        })())
    }
    await Promise.all(queue)
    const end = performance.now()
    Debug.log("TIME", `Update checking took: ${(end - start).toFixed(2)}ms`)
    if (changeDetected) throw new UserError("E079 There are ports with pending changes")
}
