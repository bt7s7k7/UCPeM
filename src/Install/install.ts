import chalk from "chalk";
import { join } from "path";
import { performance } from "perf_hooks";
import { CONFIG_FILE_NAME, CURRENT_PATH } from "../global";
import { DependencyTracker } from "../Project/DependencyTracker";
import { Project } from "../Project/Project";
import { executeCommand } from "../runner";
import { UserError } from "../UserError";

export async function install() {
    const start = performance.now()

    const iter = async (first = false) => {
        DependencyTracker.reset()

        const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
        const portFolderPath = project.portFolderPath

        project.loadAllPorts(true)

        const missingPorts = DependencyTracker.getMissingPorts()
        if (missingPorts.length > 0) {
            for (const { name, path } of missingPorts) {
                await executeCommand(`git clone "${path}" "${join(portFolderPath, name)}"`, project.path)
            }
            await iter()
        } else {
            if (first) {
                console.log("No missing dependencies")
            } else {
                console.log(chalk.greenBright(`Done! Took ${performance.now() - start}ms`))
            }
        }
    }

    await iter(true)

    const missingDependencies = DependencyTracker.getMissingDependencies()
    if (missingDependencies.length > 0) {
        console.log(`[${chalk.redBright("ERR")}] Still missing the following dependencies: `)
        console.log(chalk.green(`  // Make sure you are importing them from the right port and they aren't private`))
        missingDependencies.forEach(v => console.log("  " + v))
        throw new UserError("^Not all dependencies were resolved")
    }
}
