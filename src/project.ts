import { spawn } from "child_process"
import * as fs from "fs"
import { readdir, readFile, stat } from "fs"
import * as path from "path"
import { basename, join } from "path"
import { promisify } from "util"
import { CONFIG_FILE_NAME, PORT_FOLDER_NAME, state } from "./global"
import { UserError } from "./UserError"

export interface IResource {
    name: string,
    imports: Record<string, IPort>
}

export interface IPort {
    path: string
    name: string
    exported: Record<string, IResource>
}

export interface IDependency {
    port: IPort
    resource: IResource,
    id: string
}

export interface IConfig extends IPort {
    prepare: string[]
    prepareType: PrepareType
}

export interface IProject extends IConfig { }

export const PREPARE_TYPES = ["shell", "node"] as const
export type PrepareType = (typeof PREPARE_TYPES)[number]

export type WantedResources = Record<string, string[]>

const DEFAULT_RESOURCE_NAME = "$"

export function parseConfigFile(content: string, folder: string, initFolder: string) {
    const lines = content.split(/\n/g)
    let prepare = [] as string[]
    let prepareType: PrepareType = "shell"
    let exported = {} as Record<string, IResource>

    var state = "normal" as "normal" | "prepare" | "resource" | "resourceImport"
    var resource = null as IResource | null
    var resourceImport = null as IPort | null

    for (let i = 0, len = lines.length; i < len; i++) {
        const getPos = () => `${folder}:${i + 1}`
        let line = lines[i].trim()
        let words = line.split(/\s/g).filter(v => v.length > 0)
        if (line[0] == "#" || line.length == 0) continue
        if (state == "normal") {
            if (line == "prepare") {
                state = "prepare"
            } else if (words[0] == "prepare") {
                if (words[1] == "using") {
                    let type = words[2] as PrepareType
                    if (PREPARE_TYPES.includes(type)) {
                        prepareType = type
                        state = "prepare"
                    } else {
                        throw new UserError(`Invalid prepare type "${words[2] ?? ""}" at ${getPos()}`)
                    }
                } else {
                    throw new UserError(`Prepare keyword should have 1 or 0 arguments ("prepare" ["using" <type>]) at ${getPos()}`)
                }
            } else if (words[0] == "res") {
                if (words.length == 2) {
                    const resName = words[1]
                    if (resName in exported) {
                        throw new UserError(`Duplicate resource definition at ${getPos()}`)
                    }

                    exported[resName] = resource = {
                        imports: {},
                        name: resName
                    }

                    state = "resource"
                } else {
                    throw new UserError(`Resource keyword should have 1 argument ("res" <name>) but ${words.length - 1} found at ${getPos()}`)
                }
            } else if (line == "default") {
                const resName = DEFAULT_RESOURCE_NAME
                if (resName in exported) {
                    throw new UserError(`Duplicate default resource definition at ${getPos()}`)
                }

                exported[resName] = resource = {
                    imports: {},
                    name: resName
                }

                state = "resource"
            } else if (words[0] == "raw") {
                if (words.length == 2) {
                    const resName = words[1]
                    if (resName in exported) {
                        throw new UserError(`Duplicate resource definition at ${getPos()}`)
                    }

                    exported[resName] = resource = {
                        imports: {},
                        name: resName
                    }
                } else {
                    throw new UserError(`Raw resource keyword should have 1 argument ("raw" <name>) but ${words.length - 1} found at ${getPos()}`)
                }
            } else throw new UserError(`Invalid keyword "${line}" at ${getPos()}`)
        } else if (state == "prepare") {
            if (line == "end") {
                state = "normal"
            } else {
                prepare.push(line)
            }
        } else if (state == "resource") {
            if (line == "end") {
                state = "normal"
            } else {
                let portName = words.join(" ")

                if (portName == "self") {
                    portName = initFolder
                }

                if (!resource) throw new Error("`resource` is null in resource state")

                if (portName in resource.imports) {
                    throw new UserError(`Duplicate port ${portName} in resource ${resource.name} at ${getPos()}`)
                }

                resourceImport = resource.imports[portName] = {
                    path: portName,
                    name: path.basename(portName, path.extname(portName)),
                    exported: {}
                }

                state = "resourceImport"
            }
        } else if (state == "resourceImport") {
            if (line == "end") {
                state = "resource"
                resourceImport = null
            } else {
                if (!resourceImport) throw new Error("`resourceImport` is null in resourceImport state")
                if (words.length > 1) throw new UserError(`Resource name cannot contain whitespace at ${getPos()}`)
                resourceImport.exported[words[0]] = { name: words[0], imports: {} }
            }
        }
    }

    return {
        prepare,
        prepareType,
        exported
    } as IConfig
}

export async function getProject(folder: string) {
    let configText = ""
    const initFolder = path.resolve(process.cwd(), folder)

    let tryRead = async () => {
        try {
            configText = (await promisify(readFile)(path.join(path.resolve(process.cwd(), folder), CONFIG_FILE_NAME))).toString()
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code != "ENOENT") {
                throw err
            } else {
                return false
            }
        }

        return true
    }

    let tryFolder = async (name: string) => {
        let stats = await promisify(stat)(path.resolve(process.cwd(), folder, name)).catch(() => { })
        if (stats) return stats.isDirectory()
        else return false
    }

    let config = null as IConfig | null

    if (!(await tryRead())) {
        folder = join(folder, "Assets/UCPeM")
        if (!(await tryRead())) {
            folder = path.resolve(folder, "../..")

            if (await tryFolder("src")) {
                folder = path.join(folder, "src")
            }

            if (await tryFolder("Assets")) {
                folder = path.resolve(folder, "./Assets")
            }

            if (!(await tryRead())) {
                let dirEntries = await promisify(readdir)(folder)
                let directories = (await Promise.all(dirEntries.map(v => promisify(stat)(path.resolve(folder, v))))).map((v, i) => [dirEntries[i], v.isDirectory()] as const).filter(v => v[1]).map(v => v[0])

                config = {
                    exported: Object.assign({}, ...directories.map(v => ({ [v]: { name: v, imports: {} } }))),
                    prepare: [],
                    path: folder,
                    name: path.basename(folder),
                    prepareType: "node"
                }
            }
        }
    }

    const absolutePath = path.resolve(process.cwd(), folder)

    if (config == null) config = parseConfigFile(configText, absolutePath, initFolder)

    return {
        ...config,
        path: absolutePath,
        name: basename(path.resolve(process.cwd(), initFolder))
    } as IProject
}

export async function getImportedProjects(project: IProject) {
    let portsFolder = path.join(project.path, PORT_FOLDER_NAME)
    let folders = await promisify(readdir)(portsFolder).catch(v => [] as string[])

    let projectsArray = (await Promise.all(folders.map(async portName => {
        let portFolder = path.join(portsFolder, portName)
        let stats = await promisify(stat)(portFolder).catch(v => null)

        if (stats != null && stats.isDirectory()) {
            let project = getProject(portFolder)
            return project
        } else return null
    }))).filter(v => v != null) as IProject[]

    return projectsArray
}

export function runPrepare(project: IProject, parentProject: IProject | null) {
    return new Promise<void>((resolve, reject) => {
        if (project.prepare.length == 0) return resolve()

        console.log(`[PRE] Running prepare script for '${project.name}'`)

        let prepareRunners = {
            shell: () => {
                const command = project.prepare.join(" && ")
                const childProcess = spawn(command, [], {
                    cwd: project.path,
                    env: {
                        ...process.env,
                        UCPEM_OWN_NAME: project.name,
                        UCPEM_OWN_PATH: project.path,
                        UCPEM_IS_PORT: (parentProject == null).toString(),
                        UCPEM_PROJECT_PATH: parentProject?.path ?? project.path,
                        UCPEM_PROJECT_NAME: parentProject?.name ?? project.name
                    },
                    stdio: "inherit",
                    shell: true
                })

                childProcess.on("error", (err) => reject(err))
                childProcess.on("exit", (code) => {
                    if (code == 0) {
                        resolve()
                    } else {
                        reject(new UserError(`Prepare script failed with error code ${code} '${project.name}'`))
                    }
                })
            },
            node: () => {
                let code = project.prepare.join("\n")
                let compiled = new Function("OWN_NAME", "OWN_PATH", "IS_PORT", "PROJECT_PATH", "PROJECT_NAME", "path", "fs", code)

                compiled(
                    project.name,
                    project.path,
                    parentProject == null,
                    parentProject?.path ?? project.path,
                    parentProject?.name ?? project.name,
                    path,
                    fs
                )
            }
        } as Record<PrepareType, () => void>

        let runner = prepareRunners[project.prepareType]

        if (runner == null) throw new Error(`Project has specified unknown runner ${project.prepareType}`)
        runner()
    })
}

export function getResourceId(port: IPort, resource: IResource) {
    return port.name + "!" + resource.name
}

export function getDependencies(project: IProject, wantedResources: WantedResources) {
    let dependencies = {} as Record<string, IDependency>

    let includeExported = (exported: IDependency) => {
        Object.values(exported.resource.imports).forEach(port => {
            Object.values(port.exported).forEach(resource => {
                let id = getResourceId(port, resource)
                dependencies[id] = {
                    id,
                    port,
                    resource
                }
            })
        })
    }

    let exports = getExports(project)

    if (project.name in wantedResources) { // Get if we even want anything from this project
        let wanted = wantedResources[project.name]
        wanted.forEach(v => { // For each wanted resource
            if (v in exports) { // Test if we have it, then add all dependencies of that resource to the dependencies
                includeExported(exports[v])
            } else {
                throw new Error(`Failed to resolve ${v}, resource not exported`)
            }
        })
    }

    // If we have default imports include them
    if (DEFAULT_RESOURCE_NAME in exports) includeExported(exports[DEFAULT_RESOURCE_NAME])

    if (state.debug) {
        console.log("[lDEP]", project.name, dependencies)
        console.log("     |", wantedResources)
    }

    Object.values(dependencies).forEach(dependency => {
        let portName = dependency.port.name
        if (!(portName in wantedResources)) {
            wantedResources[portName] = []
        }
        if (!wantedResources[portName].includes(dependency.id)) wantedResources[portName].push(dependency.id)
    })

    if (state.debug) {
        console.log("     |", wantedResources)
    }

    return dependencies
}

export function makeAllExportsWanted(project: IProject) {
    return { [project.name]: Object.values(project.exported).map(v => getResourceId(project, v)) }
}

export function getExports(project: IProject) {
    let exports = {} as Record<string, IDependency>

    Object.values(project.exported).forEach(resource => {
        let id = getResourceId(project, resource)
        exports[id] = { port: project, resource, id }
    })

    return exports
}

export function getAllDependencies(projects: IProject[], wantedResources: WantedResources) {
    let ret = {} as ReturnType<typeof getDependencies>

    let newWantedResourcesLength = 0
    let wantedResourcesLength = 0

    let calcWantedResourcesLength = () => {
        newWantedResourcesLength = 0

        Object.values(wantedResources).forEach(v => newWantedResourcesLength += v.length)

        if (state.debug) {
            console.log(`[aDEP] Wanted resources:`, wantedResources)
        }
    }

    calcWantedResourcesLength()

    do {
        wantedResourcesLength = newWantedResourcesLength
        projects.forEach(project => {
            let dependencies = getDependencies(project, wantedResources)
            Object.assign(ret, dependencies)
        })

        calcWantedResourcesLength()
        if (state.debug) console.log("[aDEP]", newWantedResourcesLength, ">", wantedResourcesLength)
    } while (newWantedResourcesLength > wantedResourcesLength)

    return ret
}

export function getAllExports(projects: IProject[]) {
    let ret = {} as ReturnType<typeof getExports>

    projects.forEach(v => {
        Object.assign(ret, getExports(v))
    })

    return ret
}