import { dirname, join } from "path"
import { ConfigAPI } from "./ConfigAPI"
import { PrepareScript } from "./PrepareScript"
import { Resource } from "./Resource"

export class ResourceBuilder {
    protected dependencies = new Set<string>()
    protected prepare = null as PrepareScript | null
    protected internal = false

    public addDependency(id: string) {
        if (this.dependencies.has(id)) throw new RangeError(`E111 Duplicate import of dependency "${id}"`)
        this.dependencies.add(id)
    }

    public build() {
        return new Resource(this.id, this.path, [...this.dependencies], this.prepare, this.internal)
    }

    public setPath(newPath: string) {
        this.path = join(dirname(this.path), newPath)
    }

    public setInternal() {
        if (!this.internal) this.internal = true
        else throw new Error("E058 Duplicate private declaration")
    }

    public setPrepare(func: PrepareScript["callback"]) {
        if (this.prepare) throw new Error("E057 Duplicate prepare script definition")
        else this.prepare = new PrepareScript(func, this.constants, this.id, this.offset, this.path)
    }

    constructor(
        public readonly id: string,
        protected path: string,
        protected offset: string,
        protected constants: ConfigAPI.API["constants"]
    ) { }
}
