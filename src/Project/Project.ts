import { readFileSync } from "fs";
import { ConfigManager } from "./ConfigManager";
import { Resource } from "./Resource";

export class Project {
    public readonly resourceList = [] as Resource[]

    public logTree(prefix = "") {
        this.resourceList.forEach(resource => {
            resource.logTree()
            console.log()
        })
    }

    constructor(
        public readonly name: string,
        public readonly path: string,
        public readonly resources = {} as Readonly<Record<string, Resource>>
    ) {
        this.resourceList = Object.values(resources)
    }

    static fromFile(path: string) {
        const fileContent = readFileSync(path).toString()

        return ConfigManager.parseConfig(fileContent, path)
    }
}