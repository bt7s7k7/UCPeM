import { Project } from "./Project"
import { Resource } from "./Resource"
import { parseNameFromPath } from "./util"

export const DependencyTracker = new class DependencyTracker {
    protected portIndex = {} as Record<string, string>
    protected projectIndex = {} as Record<string, Project>
    protected resourceIndex = {} as Record<string, Resource>
    protected unresolvedDependencies = new Set<string>()
    protected unresolvedPorts = new Set<string>()

    public addPort(source: string) {
        const name = parseNameFromPath(source)

        if (name in this.portIndex && this.portIndex[name] != source) {
            throw new RangeError(`Duplicate import of port "${name}" with different source (new)"${source}" != (orig)"${this.portIndex[name]}"`)
        }

        this.portIndex[name] = source

        if (!(name in this.projectIndex)) this.unresolvedPorts.add(name)

        return name
    }

    public addGithubPort(source: string) {
        return this.addPort("https://github.com/" + source)
    }

    public addResource(resource: Resource) {
        if (resource.id in this.resourceIndex) throw new RangeError(`Duplicate registration of resource "${resource.id}"`)

        this.resourceIndex[resource.id] = resource
        resource.dependencies.forEach(v => !(v in this.resourceIndex) && this.unresolvedDependencies.add(v))

        if (this.unresolvedDependencies.has(resource.id)) {
            this.unresolvedDependencies.delete(resource.id)
        }
    }

    public resolveResource(id: string) {
        return this.resourceIndex[id]
    }

    public logPorts() {
        const ports = Object.entries(this.portIndex)
        if (ports.length > 0) {
            console.log("Referenced ports: ")
            ports.forEach(([key, value]) => console.log(`  ${key}: ${value}`))
            console.log()
        }
    }

    public logMissing() {
        if (this.unresolvedPorts.size > 0) {
            console.log("Missing ports")
            this.unresolvedPorts.forEach(v => console.log(`  ${v} :: ${this.portIndex[v]}`))
        }

        if (this.unresolvedDependencies.size > 0) {
            console.log("Missing resources")
            this.unresolvedDependencies.forEach(v => console.log(`  ${v}`))
        }
    }

    public addProject(project: Project) {
        if (project.name in this.projectIndex) throw new RangeError(`Duplicate registration of project "${project.name}"`)

        this.projectIndex[project.name] = project
        if (this.unresolvedPorts.has(project.name)) this.unresolvedPorts.delete(project.name)
    }
}()