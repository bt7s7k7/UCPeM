import { Project } from "./Project"
import { Resource } from "./Resource"
import { parseNameFromPath } from "./util"

export class ProjectBuilder {
    public readonly name = parseNameFromPath(this.path)
    protected resources = {} as Record<string, Resource>

    public addResource(resource: Resource) {
        if (resource.id in this.resources) throw new RangeError(`Duplicate definition of resource "${resource.id}"`)
        this.resources[resource.id] = resource
    }

    public build() {
        return new Project(this.name, this.path, this.resources)
    }

    public constructor(protected path: string) { }
}