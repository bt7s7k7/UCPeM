import chalk from "chalk"
import { readFileSync } from "fs"
import { dirname, join } from "path"
import { CONFIG_FILE_NAME } from "../global"
import { executeCommand } from "../runner"
import { UserError } from "../UserError"
import { DependencyTracker } from "./DependencyTracker"
import { link } from "./link"
import { ProjectBuilder } from "./ProjectBuilder"
import { ResourceBuilder } from "./ResourceBuilder"
import { RunScript } from "./RunScript"
import { makeResourceID } from "./util"

let anonId = 0

export namespace ConfigManager {
    export function parseConfig(path: string) {
        let configText: string
        try {
            configText = readFileSync(path).toString()
        } catch (err) {
            if (err.code == "ENOENT") throw new UserError(`E064 Failed to find config file (${CONFIG_FILE_NAME}) in ${dirname(path)}`)
            else throw err
        }


        const dirPath = dirname(path)
        const script = `(__api) => {${configText.replace(`require("ucpem")`, "__api")}}`

        const constants: ConfigAPI.API["constants"] = {
            installName: "",
            installPath: "",
            isPort: false,
            projectName: "",
            projectPath: "",
            resourcePath: ""
        }

        const projectBuilder = new ProjectBuilder(dirPath)

        const makePort = (portName: string): ConfigAPI.Port => {
            return {
                res(resourceName) {
                    return {
                        id: makeResourceID(portName, resourceName)
                    }
                }
            }
        }

        const api: ConfigAPI.API = {
            constants,
            git(path) {
                const portName = DependencyTracker.addPort(path)
                return makePort(portName)
            },
            github(path) {
                const portName = DependencyTracker.addGithubPort(path)
                return makePort(portName)
            },
            join(...paths) {
                return join(...paths)
            },
            link(source, target) {
                const fullSourcePath = join(constants.resourcePath, source)
                const fullTargetPath = join(constants.resourcePath, target)
                link(fullSourcePath, fullTargetPath)
            },
            path(path) {
                return {
                    callback(builder: ResourceBuilder) {
                        builder.setPath(path)
                    }
                }
            },
            prepare(func) {
                return {
                    callback(builder: ResourceBuilder) {
                        builder.setPrepare(func)
                    }
                }
            },
            internal() {
                return {
                    callback(builder: ResourceBuilder) {
                        builder.setInternal()
                    }
                }
            },
            async run(command: string, cwd: string = dirPath) {
                await executeCommand(command, cwd)
            },
            async ucpem(command: string, cwd: string = dirPath) {
                await executeCommand("node " + require.main?.filename + " " + command, cwd)
            },
            project: {
                path: dirPath,
                prefix(prefix) {
                    return { ...this, path: join(this.path, prefix) }
                },
                res(name, ...mods) {
                    const id = makeResourceID(projectBuilder.name, name)
                    const resourceBuilder = new ResourceBuilder(id, join(this.path, name), constants)

                    for (const mod of mods) {
                        if ("id" in mod) {
                            resourceBuilder.addDependency(mod.id)
                        } else {
                            mod.callback(resourceBuilder)
                        }
                    }

                    const resource = resourceBuilder.build()
                    projectBuilder.addResource(resource)

                    return {
                        id
                    }
                },
                use(dep) {
                    const name = `__${anonId++}`
                    this.res(name, dep, api.internal())
                },
                script(name, callback, options) {
                    DependencyTracker.addRunScript(name, new RunScript(callback, constants, name, options))
                }
            }
        }

        try {
            eval(script)(api)
        } catch (err) {
            if ("stack" in err) {
                const prefix = `[${chalk.redBright("ERR")}] Error during running config script for "${projectBuilder.name}" :: ${path}` + "\n"
                err.stack = prefix + (err.stack as string)
                    .replace(/<anonymous>:/g, path + ":")
                    .replace(/eval at .*, /g, "")
                    .replace(/at eval \(eval at parseConfig.*\n/g, (s) => chalk.cyanBright(s))

                err.message = prefix + err.message
            }
            throw err
        }

        return projectBuilder.build()
    }
}


