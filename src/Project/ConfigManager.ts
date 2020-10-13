import chalk from "chalk"
import { dirname, join } from "path"
import { executeCommand } from "../runner"
import { DependencyTracker } from "./DependencyTracker"
import { link } from "./link"
import { ProjectBuilder } from "./ProjectBuilder"
import { ResourceBuilder } from "./ResourceBuilder"
import { makeResourceID } from "./util"

export const ConfigManager = new class ConfigManager {
    parseConfig(configText: string, path: string) {
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
            async run(command: string) {
                await executeCommand(command, dirPath)
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
}()


