import { readFileSync } from "fs";
import { ConfigManager } from "./ConfigManager";
import { Resource } from "./Resource";

export class Project {
    constructor(
        public readonly name: string,
        public readonly path: string,
        public readonly resources = {} as Readonly<Record<string, Resource>>
    ) { }

    static fromFile(path: string) {
        const fileContent = readFileSync(path).toString()

        return ConfigManager.parseConfig(fileContent, path)
    }
}