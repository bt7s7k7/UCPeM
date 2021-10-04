import chalk from "chalk"
import { join } from "path"
import { performance } from "perf_hooks"
import { CONFIG_FILE_NAME, CURRENT_PATH } from "../global"
import { LocalLinker } from "../LocalLinker"
import { LocalPortsScout } from "../LocalPortsScout"
import { DependencyTracker } from "../Project/DependencyTracker"
import { Project } from "../Project/Project"
import { processClonePath } from "../Project/util"
import { executeCommand } from "../runner"
import { UserError } from "../UserError"

export async function install(type: "default" | "remote" | "local" = "default") {
    const start = performance.now()
    const availablePorts = LocalPortsScout.getAllAvailablePorts()

    const iter = async (first = false) => {
        DependencyTracker.reset()
        const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
        const localLinker = new LocalLinker(project)
        const portFolderPath = project.portFolderPath

        await project.loadAllPorts(true)

        const missingPorts = DependencyTracker.getMissingPorts()
        if (missingPorts.length > 0) {
            for (let { name, path } of missingPorts) {
                if (type != "remote" && availablePorts.find(v => v.name == name)) {
                    console.log(chalk.yellow(`Using local copy of port "${name}"...`))
                    localLinker.syncWith(name, false)
                } else {
                    const clonePath = join(portFolderPath, name)
                    path = processClonePath(path)
                    if (type == "local") {
                        throw new UserError(`E176 Cannot find local copy of port ${name} (${path})`)
                    }
                    await executeCommand(`git clone "${path}" "${clonePath}"`, project.path)
                    Project.fromFile(join(clonePath, CONFIG_FILE_NAME))
                    await DependencyTracker.runPrepares(name)
                }
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
        throw new UserError("^E177 Not all dependencies were resolved")
    }
}
