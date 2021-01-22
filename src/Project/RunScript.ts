import { Script } from "./Script";

export class RunScript extends Script<ConfigAPI.RunScriptCallback> {
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