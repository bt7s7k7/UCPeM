import { join } from "path";
import { CONFIG_FILE_NAME, CURRENT_PATH } from "../global";
import { Project } from "../Project/Project";

/** Loads the `DependencyTracker` with project data, to run prepare scripts. No need to run this after install. */
export async function preparePrepare() {
    const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))

    await project.loadAllPorts(false)
}