import { mkdirSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { CONFIG_FILE_NAME, PORT_FOLDER_NAME } from "../global";
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
                if (statSync(fullPath).isDirectory()) {
                    Project.fromFile(join(fullPath, CONFIG_FILE_NAME))
                }
            }
        } catch (err) {
            if ("code" in err && err.code == "ENOENT" && err.path == this.portFolderPath) {
                if (createPortsFolder) {
                    console.log("Ports folder doesn't exist, creating...")
                    mkdirSync(this.portFolderPath)
                    await DependencyTracker.runPrepares(this.name)
                }
            } else throw err
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
        const fileContent = readFileSync(path).toString()

        return ConfigManager.parseConfig(fileContent, path)
    }
}