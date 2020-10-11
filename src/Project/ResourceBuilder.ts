import { Resource } from "./Resource"

export class ResourceBuilder {
    protected dependencies = new Set<string>()
    protected prepare = null as (() => void) | null

    public addDependency(id: string) {
        if (this.dependencies.has(id)) throw new RangeError(`Duplicate import of dependency "${id}"`)
        this.dependencies.add(id)
    }

    public build() {
        return new Resource(this.id, [...this.dependencies], this.prepare)
    }

    constructor(public readonly id: string) { }
}