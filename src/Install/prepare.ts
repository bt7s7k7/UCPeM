import { CURRENT_PATH } from "../global"
import { Project } from "../Project/Project"

/** Loads the `DependencyTracker` with project data, to run prepare scripts. No need to run this after install. */
export async function preparePrepare() {
    const project = Project.fromDirectory(CURRENT_PATH)

    await project.loadAllPorts(false)
}
