import { lstatSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { CURRENT_PATH } from "../global"
import { Project } from "../Project/Project"
import { executeCommand } from "../runner"

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

export async function checkChanges() {
    const project = Project.fromDirectory(CURRENT_PATH)
    for (const portFolder of _enumerateInstalledPorts(project)) {
        const fullPath = join(project.portFolderPath, portFolder)
        if (statSync(fullPath).isDirectory()) {
            await executeCommand(`git status --porcelain=v1`, fullPath)
        }
    }
}
