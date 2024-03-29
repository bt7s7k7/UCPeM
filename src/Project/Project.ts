import { mkdirSync, readdirSync, Stats, statSync, unlinkSync } from "fs"
import { basename, join } from "path"
import { CONFIG_FILE_NAME, PORT_FOLDER_NAME } from "../global"
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
        try {
            const installedPorts = readdirSync(this.portFolderPath)

            for (const portFolder of installedPorts) {
                const fullPath = join(this.portFolderPath, portFolder)
                let stats: Stats | null = null
                try {
                    stats = statSync(fullPath)
                } catch (err) {
                    if (err.code == "ENOENT") {
                        console.log(`Detected broken link for "${portFolder}", deleting...`)
                        unlinkSync(fullPath)
                    }
                }

                if (stats) {
                    if (stats.isDirectory()) {
                        Project.fromFile(join(fullPath, CONFIG_FILE_NAME))
                    }
                }
            }
        } catch (err) {
            if ("code" in err && err.code == "ENOENT" && err.path == this.portFolderPath) {
                if (createPortsFolder) {
                    console.log("Ports folder doesn't exist, creating...")
                    this.createPortsFolder()
                    await DependencyTracker.runPrepares(this.name)
                }
            } else throw err
        }
    }

    public createPortsFolder() {
        try {
            mkdirSync(this.portFolderPath)
        } catch (err) {
            if (err.code != "EEXIST") throw err
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

    static fromFile(path: string) {
        return ConfigLoader.parseConfig(path)
    }

    static createDummy(path: string) {
        return new Project(basename(path), path, {})
    }
}