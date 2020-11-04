import { lstatSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { CONFIG_FILE_NAME, CURRENT_PATH } from "../global"
import { Project } from "../Project/Project"
import { executeCommand } from "../runner"

export async function update() {
    const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
    const installedPorts = readdirSync(project.portFolderPath)

    for (const portFolder of installedPorts) {
        const fullPath = join(project.portFolderPath, portFolder)
        if (statSync(fullPath).isDirectory()) {
            if (!lstatSync(fullPath).isSymbolicLink()) {
                await executeCommand(`git pull`, fullPath)
            } else {
                console.log(`Not updating "${portFolder}" because it's probably a local link port`)
            }
        }
    }
}