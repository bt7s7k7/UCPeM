import { Project } from "./Project"
import { Resource } from "./Resource"
import { RunScript } from "./RunScript"
import { parseNameFromPath } from "./util"

export class ProjectBuilder {
    public readonly name = parseNameFromPath(this.path)
    protected resources = {} as Record<string, Resource>
    protected runScripts = [] as RunScript[]

    public addResource(resource: Resource) {
        if (resource.id in this.resources) throw new RangeError(`E131 Duplicate definition of resource "${resource.id}"`)
        this.resources[resource.id] = resource
    }

    public addRunScript(script: RunScript) {
        this.runScripts.push(script)
    }

    public build() {
        const project = new Project(this.name, this.path, this.resources)

        for (const script of this.runScripts) {
            script.project = project
        }

        return project
    }

    public constructor(public readonly path: string) { }
}