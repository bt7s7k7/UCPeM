import { mkdirSync, readdirSync, rmdirSync } from "fs"
import { join } from "path"
import { CLI, Command } from "./CLI"
import { Debug } from "./Debug"
import { CONFIG_FILE_NAME, CURRENT_PATH, GITHUB_PREFIX, LOCAL_PORTS_PATH, RUN_SCRIPT_CACHE } from "./global"
import { DependencyTracker } from "./Project/DependencyTracker"
import { Project } from "./Project/Project"
import { parseNameFromPath, processClonePath } from "./Project/util"
import { executeCommand, RunnerError } from "./runner"
import { UserError } from "./UserError"

export async function runScript(args: string[]) {
    const rootProject = (() => {
        try {
            return Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
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
            const fragments = args[0].split("!")
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
                            return Project.fromFile(join(found, CONFIG_FILE_NAME))
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
                        return Project.fromFile(join(clonePath, CONFIG_FILE_NAME))
                    }

                    throw new UserError(`E67 Cannot find script source "${source}"`)
                }
            }
        }
    })()

    Debug.log("RUN", "Running from:", project.path)

    const runCli = new CLI("ucpem run <name>", Object.assign({}, ...Object.values(DependencyTracker.getRunScripts()).map(v => ({
        [v.name]: {
            desc: v.options.desc,
            async callback(args) {
                await v.prepareRun(rootProject, project)(args);
            },
            argc: v.options.argc
        } as Command
    }))))

    await runCli.run(args)

    if (isProjectCreated) {
        console.log("\nCleaning up cloned project...")
        rmdirSync(project.path, { recursive: true })
    }
}
