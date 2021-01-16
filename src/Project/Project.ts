import { mkdirSync, readdirSync, readFileSync, Stats, statSync, unlinkSync } from "fs";
import { basename, dirname, join } from "path";
import { CONFIG_FILE_NAME, PORT_FOLDER_NAME } from "../global";
import { UserError } from "../UserError";
import { ConfigManager } from "./ConfigManager";
import { DependencyTracker } from "./DependencyTracker";
import { Resource } from "./Resource";

export class Project {
    public readonly resourceList = [] as Resource[]
    public readonly portFolderPath = join(this.path, PORT_FOLDER_NAME);

    public logTree(prefix = "") {
        this.resourceList.forEach(resource => {
            resource.logTree()
            console.log()
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
        let fileContent: string
        try {
            fileContent = readFileSync(path).toString()
        } catch (err) {
            if (err.code == "ENOENT") throw new UserError(`E064 Failed to find config file (ucpem.js) in ${dirname(path)}`)
            else throw err
        }

        return ConfigManager.parseConfig(fileContent, path)
    }

    static createDummy(path: string) {
        return new Project(basename(path), path, {})
    }
}