import { join } from "path"
import { CONFIG_FILE_NAME, CURRENT_PATH } from "../global"
import { DependencyTracker } from "../Project/DependencyTracker"
import { Project } from "../Project/Project"

export async function link() {
    DependencyTracker.reset()
    DependencyTracker.setInitProject()
    const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))

    await project.loadAllPorts(true)

    project.linkResources()
}