import chalk from "chalk"
import { transformSync } from "esbuild"
import { existsSync, readFileSync } from "fs"
import { createRequire } from "module"
import { dirname, extname, join, relative, resolve } from "path"
import { CopyUtil } from "../CopyUtil"
import { UserError } from "../UserError"
import { CONFIG_FILE_NAME, PORT_FOLDER_NAME, SCRIPT_RES_PREFIX, TS_CONFIG_FILE_NAME } from "../global"
import { executeCommand } from "../runner"
import { ConfigAPI } from "./ConfigAPI"
import { DependencyTracker } from "./DependencyTracker"
import { Project } from "./Project"
import { ProjectBuilder } from "./ProjectBuilder"
import { ResourceBuilder } from "./ResourceBuilder"
import { RunScript } from "./RunScript"
import { link } from "./link"
import { makeResourceID, parseResourceID } from "./util"

let anonId = 0

const globalModules = new Map<string, any>()

class OrphanedConfigError extends Error { }

function findMainConfig(path: string) {
    while (path != dirname(path)) {
        path = dirname(path)

        const tsConfigFilePath = join(path, TS_CONFIG_FILE_NAME)
        if (existsSync(tsConfigFilePath)) {
            return ConfigLoader.parseConfig(tsConfigFilePath)
        }

        const configFilePath = join(path, CONFIG_FILE_NAME)
        if (existsSync(configFilePath)) {
            return ConfigLoader.parseConfig(configFilePath)
        }
    }

    throw new UserError("E061 Cannot find parent of orphaned config file")
}

export namespace ConfigLoader {
    export function parseConfig(path: string): Project {
        const dirPath = dirname(path)
        const projectBuilder = new ProjectBuilder(dirPath)

        const ret = loadConfigFile(path, dirPath, projectBuilder, "normal")
        if (ret == "orphaned") {
            return findMainConfig(dirPath)
        }

        return projectBuilder.build()
    }

    export function transformSource(path: string, text: string) {
        if (extname(path) == ".js") {
            return text
                .replace(/\/\*\s*@REWRITE\s*\*\//g, ", { rewrite: true }")
                + "\n//# sourceURL=file://" + path
        }

        const result = transformSync(text, {
            format: "cjs",
            sourcemap: "inline",
            platform: "node",
            sourcefile: path,
            loader: "ts",
            tsconfigRaw: {
                compilerOptions: {
                    target: "ESNext",
                    module: "ESNext",
                    moduleResolution: "node",
                    strict: true,
                    esModuleInterop: true,
                    lib: [
                        "ESNext",
                    ],
                    useDefineForClassFields: false,
                }
            }
        })

        return result.code + "\n//# sourceURL=file://" + path
    }

    export type ScriptRequire = (id: string, options?: { rewrite?: boolean }) => any

    export function loadModule(path: string, text: string) {
        return new Function("require", "__dirname", "module", transformSource(path, text) + "\n") as (require: ScriptRequire, __dirname: string, module: NodeJS.Module) => void
    }

    export function executeModule(path: string, text: string, api: ConfigAPI.API, moduleCache: Map<string, any>) {
        const scriptRequire = createScriptRequire(path, api, moduleCache)

        const module: NodeJS.Module = {
            id: path,
            children: [],
            exports: {},
            filename: path,
            isPreloading: false,
            loaded: false,
            path: dirname(path),
            paths: [],
            require: scriptRequire as any,
            parent: null!
        }

        const moduleFactory = loadModule(path, text)
        moduleFactory(scriptRequire, module.path, module)

        return module.exports
    }

    export function createScriptRequire(path: string, api: ConfigAPI.API, moduleCache: Map<string, any>) {
        const dirPath = dirname(path)

        const scriptRequireBase = createRequire(path)
        const scriptRequire: ScriptRequire = (id, options = {}) => {
            if (id == "ucpem") return api

            if (options.rewrite) {
                const src = id.lastIndexOf("/src/")
                if (src == -1) throw new Error(`Tried to do require rewrite, but module id does not contain "/src/"`)
                const target = join(dirPath, id) + ".ts"
                if (!existsSync(target)) throw new Error(`Tried to do require rewrite but target module does not exist (${target})`)
                const newID = id.slice(0, src) + "/build/" + id.slice(src + 5)
                const newTarget = join(dirPath, newID) + ".js"

                if (!existsSync(newTarget)) throw new Error(`Tried to do require rewrite but build file not found (${newTarget})`)

                return scriptRequireBase(newID)
            }

            if (id.startsWith(".") && extname(id) == "") {
                const tsFile = id + ".ts"
                let fullPath = resolve(dirPath, tsFile)

                if (existsSync(fullPath)) {
                    const cached = moduleCache.get(fullPath)
                    if (cached) return cached
                    const module = executeModule(fullPath, readFileSync(fullPath).toString(), api, moduleCache)
                    moduleCache.set(fullPath, module)
                    return module
                }

                const indexTs = id + "/index.ts"
                fullPath = resolve(dirPath, indexTs)

                if (existsSync(fullPath)) {
                    const cached = moduleCache.get(fullPath)
                    if (cached) return cached
                    const module = executeModule(fullPath, readFileSync(fullPath).toString(), api, moduleCache)
                    moduleCache.set(fullPath, module)
                    return module
                }
            }

            const globalModule = globalModules.get(id)
            if (globalModule) return globalModule

            return scriptRequireBase(id)
        }

        return scriptRequire
    }

    export function createApi(dirPath: string, projectBuilder: ProjectBuilder | null, createdResources: Record<string, ConfigAPI.Resource>, configType: "child" | "normal", moduleCache: Map<string, any>) {
        const offset = projectBuilder == null ? dirPath : relative(projectBuilder.path, dirPath)

        const constants: ConfigAPI.API["constants"] = {
            installName: "",
            installPath: "",
            isPort: false,
            projectName: "",
            projectPath: "",
            resourcePath: ""
        }

        function makeScriptRef(base: string | ConfigAPI.Dependency, path: string, name: string): ConfigAPI.ScriptRef {
            return {
                name, path,
                ...(typeof base == "string" ? { id: makeResourceID(base, SCRIPT_RES_PREFIX + name) } : base),
                async run(args = "", cwd) {
                    return api.ucpem(`run ${path}+${name} ${args}`, cwd)
                }
            }
        }

        const makePort = (portName: string): ConfigAPI.Port => {
            return {
                res(resourceName) {
                    return {
                        id: makeResourceID(portName, resourceName)
                    }
                },
                script(name) {
                    return makeScriptRef(portName, join(dirPath, PORT_FOLDER_NAME, portName), name)
                }
            }
        }

        const api: ConfigAPI.API = {
            constants,
            getProjectDetails() {
                return DependencyTracker.dump()
            },
            log(...msg) {
                console.log(`[${chalk.cyanBright("SCRIPT")}]`, ...msg)
            },
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
                return await executeCommand(command, cwd)
            },
            async ucpem(command: string, cwd: string = dirPath) {
                return await executeCommand("node " + (require.main?.filename ?? __filename) + " " + command, cwd)
            },
            include(path) {
                if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                const target = join(dirPath, path)

                const ret = loadConfigFile(target, dirname(target), projectBuilder, "child")
                if (ret == "orphaned") throw new Error("Child config file was orphaned, this should not be possible")
                return ret
            },
            massReplace(text, replacements) {
                return CopyUtil.massReplace(text, replacements)
            },
            find: (path, pattern) => CopyUtil.find(path, pattern),
            ensureDirectory(path) {
                CopyUtil.ensureDirectory(path)
            },
            async copy(source, target, replacements) {
                await CopyUtil.copy(source, target, replacements)
            },
            project: {
                path: dirPath,
                prefix(prefix) {
                    if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                    return { ...this, path: join(this.path, prefix) }
                },
                res(name, ...mods) {
                    if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                    const id = makeResourceID(projectBuilder.name, name)
                    const resourceBuilder = new ResourceBuilder(id, join(this.path, name), offset, constants)

                    for (const mod of mods) {
                        if ("id" in mod) {
                            resourceBuilder.addDependency(mod.id)
                        } else {
                            mod.callback(resourceBuilder)
                        }
                    }

                    const resource = resourceBuilder.build()
                    projectBuilder.addResource(resource)

                    const createdResource = { id }
                    createdResources[id] = createdResource
                    return createdResource
                },
                use(...dep: (ConfigAPI.Dependency | ConfigAPI.ScriptRef)[]) {
                    if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                    const name = `__${anonId++}`
                    this.res(name, ...dep, api.internal())
                    for (const dependency of dep) {
                        if ("run" in dependency) {
                            const { portName } = parseResourceID(dependency.id)
                            DependencyTracker.useRunScript(portName + "+" + dependency.name)
                        }
                    }
                },
                script(name, callback, options = { desc: "-no description provided-" }) {
                    if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                    const script = new RunScript(callback, constants, name, offset, options)
                    DependencyTracker.addRunScript(projectBuilder.name, name, script)
                    projectBuilder.addRunScript(script)
                    const resource = this.res(SCRIPT_RES_PREFIX + name, ...(options.dependencies ? options.dependencies : []))
                    return makeScriptRef(resource, dirPath, name)
                },
                ref(name) {
                    if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                    return makePort(projectBuilder.name).res(name)
                },
                isChild() {
                    if (projectBuilder == null) throw new Error("Cannot use Project API when directly executing files")

                    if (configType == "normal") throw new OrphanedConfigError()
                }
            },
            externalModule: {
                createGlobalModule(name, exports) {
                    globalModules.set(name, exports)
                },
                load(path) {
                    return loadCustomFile(path, dirname(path), null, "normal", moduleCache)
                },
                include(path) {
                    return executeModule(path, readFileSync(path).toString(), api, moduleCache)
                },
            }
        }

        Object.entries(api).filter(v => typeof v[1] == "function").forEach(([key, value]) => (api as any)[key] = (value as Function).bind(api))

        return api
    }

    export function loadConfigFile(path: string, dirPath: string, projectBuilder: ProjectBuilder | null, configType: "child" | "normal", moduleCache: Map<string, any> = new Map<string, any>) {
        let configText: string
        try {
            configText = readFileSync(path).toString()
        } catch (err: any) {
            if (err.code == "ENOENT") throw new UserError(`E064 Failed to find config file in ${dirname(path)}`)
            else throw err
        }

        const createdResources: Record<string, ConfigAPI.Resource> = {}

        try {
            prepareAndExecute(path, dirPath, createdResources, configText, projectBuilder, configType, moduleCache)
        } catch (err: any) {
            if (err instanceof OrphanedConfigError) return "orphaned"

            throw err
        }

        return createdResources
    }

    export function loadCustomFile(path: string, dirPath: string, projectBuilder: ProjectBuilder | null, configType: "child" | "normal", moduleCache: Map<string, any> = new Map<string, any>) {
        let configText: string
        configText = readFileSync(path).toString()

        return prepareAndExecute(path, dirPath, {}, configText, projectBuilder, configType, moduleCache)
    }

    export function prepareAndExecute(path: string, dirPath: string, createdResources: Record<string, ConfigAPI.Resource>, configText: string, projectBuilder: ProjectBuilder | null, configType: "child" | "normal", moduleCache: Map<string, any> = new Map<string, any>) {
        const api = createApi(dirPath, projectBuilder, createdResources, configType, moduleCache)

        return executeModule(path, configText, api, moduleCache)

    }
}
