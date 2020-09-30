import { spawn } from "child_process"
import * as fs from "fs"
import { readdir, readFile, stat } from "fs"
import * as path from "path"
import { basename, join } from "path"
import { promisify } from "util"
import { CONFIG_FILE_NAME, LOCAL, PORT_FOLDER_NAME, state } from "./global"
import { UserError } from "./UserError"

export interface IResource {
    name: string,
    imports: Record<string, IPort>
}

export interface IPort {
    path: string
    name: string
    resources: Record<string, IResource>
}

/** Dependency of a project, NOT of a resource (`IPort` is used for that) */
export interface IDependency {
    port: IPort
    resource: IResource,
    id: string
}

export interface IProject extends IPort {
    prepare: string[]
    prepareType: PrepareType
    basePath: string
}

export const PREPARE_TYPES = ["shell", "node"] as const
export type PrepareType = (typeof PREPARE_TYPES)[number]

export type WantedResources = Record<string, string[]>

const DEFAULT_RESOURCE_NAME = "$"

export function parseConfigFile(content: string, folder: string, initFolder: string) {
    /** Lines in the config file */
    const lines = content.split(/\n/g)
    /** All resources we export */
    const resources = {} as Record<string, IResource>
    /** The lines of the prepare script */
    const prepare = [] as string[]
    let prepareType: PrepareType = "shell"

    /** Current state of the parser */
    let state = "normal" as "normal" | "prepare" | "resource" | "resourceImport"
    /** Current resource being defined */
    let resource = null as IResource | null
    /** Current import in a resource being defined */
    let resourceImport = null as IPort | null

    let prefixedFolder = folder

    for (let i = 0, len = lines.length; i < len; i++) { // For every line

        const getPos = () => `${folder}:${i + 1}`

        const setResource = (resName: string) => {
            if (resName in resources) { // Check if it's not a duplicate
                throw new UserError(LOCAL.config_res_duplicate(getPos()))
            }

            resources[resName] = resource = {
                imports: {},
                name: resName
            }

            state = "resource"
        }

        /** Current line */
        let line = lines[i].trim()
        /** Words of the current line */
        let words = line.split(/\s/g).filter(v => v.length > 0)
        // Ignore comments and empty lines
        if (line[0] == "#" || line.length == 0) continue
        if (state == "normal") {
            if (line == "prepare") { // Specifying the prepare script
                state = "prepare"
            } else if (words[0] == "prepare") { // Specifying the prepare script with the runner type
                if (words[1] == "using") {
                    let type = words[2] as PrepareType
                    if (PREPARE_TYPES.includes(type)) { // Test if the prepare type is even real
                        prepareType = type // If real then set it
                        state = "prepare"
                    } else {
                        throw new UserError(LOCAL.config_prepare_invalidType(words[2] ?? "", getPos()))
                    }
                } else {
                    throw new UserError(LOCAL.config_prepare_argErr(getPos()))
                }
            } else if (words[0] == "res") { // Specifying a resource
                if (words.length == 2) {
                    const resName = words[1]
                    setResource(resName)
                } else {
                    throw new UserError(LOCAL.config_res_argErr(getPos()))
                }
            } else if (line == "default") { // Defining the default resource
                setResource(DEFAULT_RESOURCE_NAME)
            } else if (words[0] == "raw") { // Defining a resource w/out imports
                if (words.length == 2) {
                    const resName = words[1]
                    if (resName in resources) {
                        throw new UserError(LOCAL.config_res_duplicate(getPos()))
                    }

                    resources[resName] = resource = {
                        imports: {},
                        name: resName
                    }
                } else {
                    throw new UserError(LOCAL.config_raw_argErr(getPos()))
                }
            } else if (words[0] == "prefix") { // Parse folder prefix
                const prefix = words.slice(1).join(" ")

                prefixedFolder = path.join(prefixedFolder, prefix)
            } else throw new UserError(LOCAL.config_invalidKeyword(getPos()))
        } else if (state == "prepare") {
            if (line == "end") { // If end then end
                state = "normal"
            } else { // Else we save that line into the prepare script
                prepare.push(line)
            }
        } else if (state == "resource") {
            if (line == "end") { // If end then end
                state = "normal"
            } else { // Else it's a port to import from
                let portName = line

                if (portName == "self") { // If it's self, substitute the folder of the project
                    portName = initFolder
                }

                // Assert we are editing a resource
                if (!resource) throw new Error("`resource` is null in resource state")

                if (portName in resource.imports) { // Check if it's a duplicate
                    throw new UserError(LOCAL.config_port_duplicate(portName, resource.name, getPos()))
                }

                resourceImport = resource.imports[portName] = {
                    path: portName,
                    name: path.basename(portName, path.extname(portName)),
                    resources: {}
                }

                state = "resourceImport"
            }
        } else if (state == "resourceImport") {
            if (line == "end") { // If end then end
                state = "resource"
                resourceImport = null
            } else { // Else add the resource to the port
                // Assert we are editing an import
                if (!resourceImport) throw new Error("`resourceImport` is null in resourceImport state")
                // Make sure there is no whitespace
                if (words.length > 1) throw new UserError(LOCAL.config_import_whitespace(getPos()))

                resourceImport.resources[words[0]] = { name: words[0], imports: {} }
            }
        }
    }

    return {
        prepare,
        prepareType,
        resources,
        path: prefixedFolder
    } as IProject
}

/** Gets the project at the path */
export async function getProject(folder: string) {
    /** Text in the config file */
    let configText = ""
    /** The folder we started searching in */
    const initFolder = path.resolve(folder)

    /** Try to find a config file at the current path */
    const tryRead = async () => {
        try {
            configText = (await promisify(readFile)(path.join(folder, CONFIG_FILE_NAME))).toString()
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code != "ENOENT") {
                throw err
            } else {
                return false
            }
        }

        return true
    }

    /** Check if the folder exists */
    const tryFolder = async (name: string) => {
        let stats = await promisify(stat)(path.join(folder, name)).catch(() => { })
        if (stats) return stats.isDirectory()
        else return false
    }

    let config = null as IProject | null

    if (!(await tryRead())) { // First try the root
        folder = join(folder, "Assets/UCPeM")
        if (!(await tryRead())) { // Then try ↑ that
            folder = path.resolve(folder, "../..") // If not return to root

            if (await tryFolder("src")) { // Try src folder
                folder = path.join(folder, "src")
            } else if (await tryFolder("Assets")) { // Else try assets folder
                folder = path.resolve(folder, "./Assets")
            }

            if (!(await tryRead())) { // If we still didn't find a config file
                const dirEntries = await promisify(readdir)(folder)
                const directories = (await Promise.all(dirEntries.map(v => promisify(stat)(path.resolve(folder, v))))).map((v, i) => [dirEntries[i], v.isDirectory()] as const).filter(v => v[1]).map(v => v[0])

                // Make a project exporting all folders we can find
                config = {
                    resources: Object.assign({}, ...directories.map(v => ({ [v]: { name: v, imports: {} } }))),
                    prepare: [],
                    path: folder,
                    basePath: folder,
                    name: path.basename(folder),
                    prepareType: "node"
                }
            }
        }
    }

    const absolutePath = path.resolve(folder)

    if (config == null) config = parseConfigFile(configText, absolutePath, initFolder)

    return {
        ...config,
        basePath: absolutePath,
        name: basename(path.resolve(initFolder))
    } as IProject
}

export async function getClonedImports(project: IProject) {
    const portsFolder = path.join(project.basePath, PORT_FOLDER_NAME)
    /** All files found in the portsFolder */
    const files = await promisify(readdir)(portsFolder).catch(v => [] as string[])

    const projectsArray = (await Promise.all(files.map(async portName => { // For every file in the ports folder
        const portFolder = path.join(portsFolder, portName)
        const stats = await promisify(stat)(portFolder).catch(v => null)
        // Check if it's real and a directory
        if (stats != null && stats.isDirectory()) return getProject(portFolder)
        else return null
    }))).filter(v => v != null) as IProject[]

    return projectsArray
}

export function runPrepare(project: IProject, parentProject: IProject | null) {
    return new Promise<void>((resolve, reject) => {
        // If the prepare script is empty just return
        if (project.prepare.length == 0) return resolve()

        console.log(LOCAL.prepare_running(project.name))

        const prepareRunners = {
            shell: () => { // Shell runner
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
                        reject(new UserError(LOCAL.prepare_fail(code ?? -1)))
                    }
                })
            },
            node: () => { // Node runner
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

        // Assert the runner exists
        if (runner == null) throw new Error(`Project has specified unknown runner ${project.prepareType}`)
        // Run it
        runner()
    })
}

export function getResourceId(port: IPort, resource: IResource) {
    return port.name + "!" + resource.name
}

export function getImports(project: IProject, wantedResources: WantedResources) {
    const dependencies = {} as Record<string, IDependency>

    /** Adds the import of the provided dependency to the return value */
    const includeExported = (exported: IDependency) => {
        Object.values(exported.resource.imports).forEach(port => {
            Object.values(port.resources).forEach(resource => {
                let id = getResourceId(port, resource)
                dependencies[id] = {
                    id,
                    port,
                    resource
                }
            })
        })
    }

    /** All exports from the project */
    const exports = getExports(project)

    if (project.name in wantedResources) { // Get if we even want anything from this project
        let wanted = wantedResources[project.name]
        wanted.forEach(v => { // For each wanted resource
            if (v in exports) { // Test if we have it, then add all dependencies of that resource to the dependencies
                includeExported(exports[v])
            } else {
                throw new UserError(LOCAL.import_resolveFail(v))
            }
        })
    }

    // If we have default imports include them
    if (DEFAULT_RESOURCE_NAME in exports) includeExported(exports[DEFAULT_RESOURCE_NAME])

    if (state.debug) {
        console.log("[lDEP]", project.name, dependencies)
        console.log("-----→", wantedResources)
    }

    Object.values(dependencies).forEach(dependency => { // For each dependency add it to the wanted resources
        let portName = dependency.port.name
        if (!(portName in wantedResources)) {
            wantedResources[portName] = []
        }
        if (!wantedResources[portName].includes(dependency.id)) wantedResources[portName].push(dependency.id)
    })

    if (state.debug) {
        console.log("-----→", wantedResources)
    }

    return dependencies
}

/**
 * Returns wanted resources that contain all exported resources from the provided project
 */
export function makeAllExportsWanted(project: IProject) {
    return { [project.name]: Object.values(project.resources).map(v => getResourceId(project, v)) }
}

export function getExports(project: IProject) {
    let exports = {} as Record<string, IDependency>

    Object.values(project.resources).forEach(resource => {
        let id = getResourceId(project, resource)
        exports[id] = { port: project, resource, id }
    })

    return exports
}

/** 
 * Return all the imports for all the projects. Don't forget to include the root project.
 */
export function getAllImports(projects: IProject[], wantedResources: WantedResources) {
    const imports = {} as ReturnType<typeof getImports>

    let newWantedResourcesLength = 0
    let wantedResourcesLength = 0

    const updateWantedResourcesLength = () => {
        newWantedResourcesLength = 0

        Object.values(wantedResources).forEach(v => newWantedResourcesLength += v.length)

        if (state.debug) {
            console.log(`[aDEP] Wanted resources:`, wantedResources)
        }
    }

    updateWantedResourcesLength()

    do { // Add imports from projects based on wanted resources, if we start to want more resources do it again, so we satisfy all wanted resources
        wantedResourcesLength = newWantedResourcesLength
        projects.forEach(project => {
            let dependencies = getImports(project, wantedResources)
            Object.assign(imports, dependencies)
        })

        updateWantedResourcesLength()
        if (state.debug) console.log("[aDEP]", newWantedResourcesLength, ">", wantedResourcesLength)
    } while (newWantedResourcesLength > wantedResourcesLength)

    return imports
}

/** 
 * Return all the exports for all the projects. Don't forget to include the root project.
 */
export function getAllExports(projects: IProject[]) {
    let ret = {} as ReturnType<typeof getExports>

    projects.forEach(v => {
        Object.assign(ret, getExports(v))
    })

    return ret
}