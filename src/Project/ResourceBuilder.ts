import { dirname, join } from "path"
import { Resource } from "./Resource"

export class ResourceBuilder {
    protected dependencies = new Set<string>()
    protected prepare = null as (() => void) | null
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

    public setPrepare(func: () => void) {
        if (this.prepare) throw new Error("E057 Duplicate prepare script definition")
        else this.prepare = func
    }

    constructor(public readonly id: string, protected path: string) { }
}