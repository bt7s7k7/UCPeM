import { CURRENT_PATH } from "../global"
import { DependencyTracker } from "../Project/DependencyTracker"
import { Project } from "../Project/Project"
import { GitIgnoreGenerator } from "./GitIgnoreGenerator"

export async function linkResources() {
    DependencyTracker.reset()
    const project = Project.fromDirectory(CURRENT_PATH)

    await project.loadAllPorts(true)

    project.linkResources()

    GitIgnoreGenerator.generateIgnores()
}
