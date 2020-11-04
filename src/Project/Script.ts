import chalk from "chalk"
import { PrepareScript } from "./PrepareScript"
import { Project } from "./Project"

export class Script<T extends Function> {
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
            installPath: rootProject.path,
            isPort: rootProject != project,
            projectName: project.name,
            projectPath: project.path,
        }
    }

    constructor(
        public readonly callback: T,
        public readonly constants: ConfigAPI.API["constants"],
        public readonly name: string
    ) { }
}