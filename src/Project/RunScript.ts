import { ConfigAPI } from "./ConfigAPI"
import { Project } from "./Project"
import { Script } from "./Script"

export class RunScript extends Script<ConfigAPI.RunScriptCallback> {
    public project: Project = null!

    constructor(
        callback: ConfigAPI.RunScriptCallback,
        constants: ConfigAPI.API["constants"],
        name: string,
        offset: string,
        public readonly options: ConfigAPI.RunScriptOptions
    ) {
        super(callback, constants, name, offset)
    }
}