import chalk from "chalk";
import { ConfigAPI } from "./ConfigAPI";
import { Project } from "./Project";
import { Script } from "./Script";

export class PrepareScript extends Script<() => Promise<void>> {

    protected getConstantsValues(rootProject: Project, project: Project): Partial<PrepareScript["constants"]> {
        return {
            ...super.getConstantsValues(rootProject, project),
            resourcePath: this.path
        }
    }

    protected printRun() {
        console.log(`[${chalk.cyanBright("PREPARE")}] Running prepare script for "${this.name}"`)
    }

    constructor(
        callback: () => Promise<void>,
        constants: ConfigAPI.API["constants"],
        name: string,
        offset: string,
        public readonly path: string
    ) {
        super(callback, constants, name, offset)
    }
}