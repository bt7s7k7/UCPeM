import chalk from "chalk"
import { join } from "path"
import { ConfigAPI } from "./ConfigAPI"
import { PrepareScript } from "./PrepareScript"
import { Project } from "./Project"

export class Script<T extends Function> {
    public readonly rawName = this.name

    public prepareRun(rootProject: Project, project: Project) {
        Object.assign(this.constants, this.getConstantsValues(rootProject, project))

        this.printRun()
        return this.callback
    }

    protected printRun() {
        console.log(`[${chalk.cyanBright("SCRIPT")}] Running script "${this.name}"`)
    }

    protected getConstantsValues(rootProject: Project, project: Project): Partial<PrepareScript["constants"]> {
        return {
            installName: rootProject.name,
            installPath: process.cwd(),
            isPort: rootProject != project,
            projectName: join(project.name, this.offset),
            projectPath: join(project.path, this.offset)
        }
    }

    constructor(
        public readonly callback: T,
        public readonly constants: ConfigAPI.API["constants"],
        public name: string,
        public readonly offset: string
    ) { }
}