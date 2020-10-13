import chalk from "chalk";
import { Project } from "./Project";
import { Resource } from "./Resource";

export class PrepareScript {

    public async run(rootProject: Project, project: Project, resource: Resource) {
        Object.assign(this.constants, {
            installName: rootProject.name,
            installPath: rootProject.path,
            isPort: rootProject != project,
            projectName: project.name,
            projectPath: project.path,
            resourcePath: resource.path
        } as PrepareScript["constants"])

        console.log(`[${chalk.cyanBright("PREPARE")}] Running prepare script for "${resource.id}"`)
        await this.callback()
    }

    constructor(
        public readonly callback: () => Promise<void>,
        public readonly constants: ConfigAPI.API["constants"]
    ) { }
}