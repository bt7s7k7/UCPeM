import { existsSync, mkdirSync, readdirSync, Stats, statSync, unlinkSync, writeFileSync } from "fs"
import { basename, dirname, join } from "path"
import { performance } from "perf_hooks"
import { Debug } from "../Debug"
import { CONFIG_FILE_NAME, PORT_FOLDER_NAME, TS_CONFIG_FILE_NAME } from "../global"
import { ConfigLoader } from "./ConfigManager"
import { DependencyTracker } from "./DependencyTracker"
import { Resource } from "./Resource"

export class Project {
    public readonly resourceList = [] as Resource[]
    public readonly portFolderPath = join(this.path, PORT_FOLDER_NAME);

    public logTree(shallow: boolean | "shallow" = false) {
        this.resourceList.forEach(resource => {
            resource.logTree(undefined, undefined, shallow)
            if (!shallow) console.log()
        })
    }

    public async loadAllPorts(createPortsFolder = false) {
        const start = performance.now()
        try {
            const installedPorts = readdirSync(this.portFolderPath)

            for (const portFolder of installedPorts) {
                const fullPath = join(this.portFolderPath, portFolder)
                let stats: Stats | null = null
                try {
                    stats = statSync(fullPath)
                } catch (err: any) {
                    if (err.code == "ENOENT") {
                        console.log(`Detected broken link for "${portFolder}", deleting...`)
                        unlinkSync(fullPath)
                    }
                }

                if (stats) {
                    if (stats.isDirectory()) {
                        Project.fromDirectory(fullPath)
                    }
                }
            }
        } catch (err: any) {
            if ("code" in err && err.code == "ENOENT" && err.path == this.portFolderPath) {
                if (createPortsFolder) {
                    console.log("Ports folder doesn't exist, creating...")
                    this.createPortsFolder()
                    await DependencyTracker.runPrepares(this.name)
                }
            } else throw err
        }
        const end = performance.now()
        Debug.log("TIME", `Loading ports took: ${(end - start).toFixed(2)}ms`)
    }

    public createPortsFolder() {
        try {
            mkdirSync(this.portFolderPath)
        } catch (err: any) {
            if (err.code != "EEXIST") throw err
        }

        if (existsSync(join(dirname(this.portFolderPath), "project.godot"))) {
            writeFileSync(join(this.portFolderPath, ".gdignore"), "")
        }
    }

    public linkResources() {
        this.resourceList.forEach(v => v.link())
    }

    constructor(
        public readonly name: string,
        public readonly path: string,
        public readonly resources = {} as Readonly<Record<string, Resource>>
    ) {
        this.resourceList = Object.values(resources)
        DependencyTracker.addProject(this)
    }

    static fromDirectory(path: string) {
        const start = performance.now()
        const tsConfigFilePath = join(path, TS_CONFIG_FILE_NAME)
        Debug.log("PRO", "Trying to get typescript config", tsConfigFilePath)
        if (existsSync(tsConfigFilePath)) {
            return ConfigLoader.parseConfig(tsConfigFilePath)
        }

        const configFilePath = join(path, CONFIG_FILE_NAME)
        Debug.log("PRO", "Trying to get javascript config", configFilePath)
        const config = ConfigLoader.parseConfig(configFilePath)
        const end = performance.now()
        Debug.log("TIME", `Loading project from directory took: ${(end - start).toFixed(2)}ms`)
        return config
    }

    static fromFile(path: string) {
        return ConfigLoader.parseConfig(path)
    }

    static createDummy(path: string) {
        return new Project(basename(path), path, {})
    }
}
