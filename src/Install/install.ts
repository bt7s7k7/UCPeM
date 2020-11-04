import chalk from "chalk";
import { join } from "path";
import { performance } from "perf_hooks";
import { URL } from "url";
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

        await project.loadAllPorts(true)

        const missingPorts = DependencyTracker.getMissingPorts()
        if (missingPorts.length > 0) {
            for (let { name, path } of missingPorts) {
                const clonePath = join(portFolderPath, name)
                if (process.env.UCPEM_TOKEN) {
                    try {
                        const url = new URL(path)
                        url.username = process.env.UCPEM_TOKEN
                        path = url.href
                    } catch (err) {
                        if (err.code != "ERR_INVALID_URL") throw err
                    }
                }
                await executeCommand(`git clone "${path}" "${clonePath}"`, project.path)
                Project.fromFile(join(clonePath, CONFIG_FILE_NAME))
                await DependencyTracker.runPrepares(name)
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
