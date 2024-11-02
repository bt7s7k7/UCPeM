import { mkdirSync, readdirSync, rmSync } from "fs"
import { join } from "path"
import { CLI, Command } from "./CLI"
import { Debug } from "./Debug"
import { CURRENT_PATH, GITHUB_PREFIX, LOCAL_PORTS_PATH, RUN_SCRIPT_CACHE } from "./global"
import { DependencyTracker } from "./Project/DependencyTracker"
import { Project } from "./Project/Project"
import { parseNameFromPath, processClonePath } from "./Project/util"
import { executeCommand, RunnerError } from "./runner"
import { UserError } from "./UserError"

export async function runScript(args: string[]) {
    const rootProject = (() => {
        try {
            return Project.fromDirectory(CURRENT_PATH)
        } catch (err) {
            if (err.message.includes("E064")) {
                return Project.createDummy(CURRENT_PATH)
            } else throw err
        }
    })()
    const scriptCacheDir = join(rootProject.portFolderPath, RUN_SCRIPT_CACHE)

    Debug.log("RUN", "Preparing to start...", rootProject.path)

    let isProjectCreated = false
    const project = await (async () => {
        if (args.length == 0) {
            Debug.log("RUN", "There is no command name provided")
            return rootProject
        } else {
            const fragments = args[0].split("+")
            Debug.log("RUN", "Parsing command name...", fragments)

            if (fragments.length == 1) {
                Debug.log("RUN", "Used shorthand local script")
                return rootProject
            } else {
                let [source, name] = fragments
                Debug.log("RUN", "Used source and name", source, name)
                args[0] = name

                if (source == "") {
                    Debug.log("RUN", "Source is empty, running from this")
                    return rootProject
                } else {
                    if (source[0] == "@") {
                        source = GITHUB_PREFIX + source.substr(1)
                    }

                    if (source == rootProject.path) return rootProject

                    const sourceName = parseNameFromPath(source)
                    Debug.log("RUN", "Starting search for", sourceName)

                    const find = (path: string) => {
                        try {
                            const files = readdirSync(path)
                            Debug.log("RUN", "Files:", files)
                            if (files.includes(sourceName)) {
                                return join(path, sourceName)
                            } else {
                                return null
                            }
                        } catch (err) {
                            if (err.code == "ENOENT") {
                                return null
                            } else throw err
                        }
                    }

                    for (const { path, name } of [
                        {
                            name: "ports folder",
                            path: rootProject.portFolderPath,
                        },
                        {
                            name: "local link ports",
                            path: LOCAL_PORTS_PATH,
                        }
                    ]) {
                        Debug.log("RUN", "Searching in " + name, path)
                        const found = find(path)

                        if (found) {
                            Debug.log("RUN", "Found!", found)
                            DependencyTracker.reset()
                            return Project.fromDirectory(found)
                        }
                    }

                    console.log("Source not installed, cloning...")

                    isProjectCreated = true
                    rootProject.createPortsFolder()
                    try {
                        mkdirSync(scriptCacheDir)
                    } catch (err) {
                        if (err.code != "EEXIST") throw err
                    }

                    let createSuccessful = false

                    const clonePath = join(scriptCacheDir, sourceName)
                    source = processClonePath(source)
                    try {
                        await executeCommand(`git clone "${source}" "${clonePath}"`, rootProject.path)
                        createSuccessful = true
                    } catch (err) {
                        if (!(err instanceof RunnerError)) {
                            throw err
                        } else {
                            console.log(err.message)
                        }
                    }

                    if (createSuccessful) {
                        DependencyTracker.reset()
                        return Project.fromDirectory(clonePath)
                    }

                    throw new UserError(`E67 Cannot find script source "${source}"`)
                }
            }
        }
    })()

    if (!isProjectCreated) project.loadAllPorts()

    Debug.log("RUN", "Running from:", project.path)

    const runScripts = Object.entries(DependencyTracker.getRunScripts())
    runScripts.sort(([a], [b]) => {
        if (b.includes("+") && !a.includes("+")) {
            return -1
        }

        if (a.includes("+") && !b.includes("+")) {
            return 1
        }

        if (a < b) return -1
        if (a > b) return 1

        return 0
    })

    const runCli = new CLI("ucpem run <name>", Object.assign({}, ...runScripts.map(([name, script]) => ({
        [name]: {
            desc: script.options.desc,
            async callback(args) {
                await script.prepareRun(rootProject, script.project)(args)
            },
            argc: script.options.argc
        } as Command
    }))))

    let own = true
    const oldPrintHelp = runCli.printCommandHelpMessage
    runCli.printCommandHelpMessage = (command, maxNameLength) => {
        const name = command.name!
        if (own && name.includes("+")) {
            own = false
            console.log("\x1b[90m")
            console.log("Inherited commands:")
        }

        oldPrintHelp.call(runCli, command, maxNameLength)
    }

    if (!own) {
        process.stdout.write("\x1b[0m")
    }

    await runCli.run(args)

    if (isProjectCreated) {
        console.log("\nCleaning up cloned project...")
        rmSync(project.path, { recursive: true })
    }
}
