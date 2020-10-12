import { Project } from "./Project"
import { Resource } from "./Resource"
import { parseNameFromPath, parseResourceID } from "./util"

export const DependencyTracker = new class DependencyTracker {
    protected portIndex = {} as Record<string, string>
    protected projectIndex = {} as Record<string, Project>
    protected resourceIndex = {} as Record<string, Resource>
    protected unresolvedDependencies = new Set<string>()
    protected unresolvedPorts = new Set<string>()
    protected isInitProject = false

    public addPort(source: string) {
        const name = parseNameFromPath(source)

        if (name in this.portIndex && this.portIndex[name] != source) {
            throw new RangeError(`E096 Duplicate import of port "${name}" with different source (new)"${source}" != (orig)"${this.portIndex[name]}"`)
        }

        this.portIndex[name] = source

        if (!(name in this.projectIndex)) this.unresolvedPorts.add(name)

        return name
    }

    public addGithubPort(source: string) {
        return this.addPort("https://github.com/" + source)
    }

    public addResource(resource: Resource) {
        if (resource.id in this.resourceIndex) throw new RangeError(`E214 Duplicate registration of resource "${resource.id}"`)

        if (this.unresolvedDependencies.delete(resource.id) || this.isInitProject) {
            this.resourceIndex[resource.id] = resource
            resource.dependencies.forEach(v => !(v in this.resourceIndex) && this.unresolvedDependencies.add(v))
        }
    }

    public resolveResource(id: string) {
        return this.resourceIndex[id]
    }

    public logPorts() {
        this.filterPorts()
        const ports = Object.entries(this.portIndex)
        if (ports.length > 0) {
            console.log("Referenced ports: ")
            ports.forEach(([key, value]) => console.log(`  ${key}: ${value}`))
            console.log()
        }
    }

    public logMissing() {
        const missingPorts = this.getMissingPorts()
        if (missingPorts.length > 0) {
            console.log("Missing ports")
            missingPorts.forEach(({ name }) => console.log(`  ${name} :: ${this.portIndex[name]}`))
        }

        if (this.unresolvedDependencies.size > 0) {
            console.log("Missing resources")
            this.unresolvedDependencies.forEach(v => console.log(`  ${v}`))
        }
    }

    public addProject(project: Project) {
        if (project.name in this.projectIndex) throw new RangeError(`E021 Duplicate registration of project "${project.name}"`)

        this.projectIndex[project.name] = project
        if (this.unresolvedPorts.has(project.name)) this.unresolvedPorts.delete(project.name)

        this.isInitProject = false
    }

    public reset() {
        Object.assign(this, new DependencyTracker())
    }

    public filterPorts() {
        const referencedResources = [...this.unresolvedDependencies, ...Object.keys(this.resourceIndex)]
        Object.keys(this.portIndex).forEach(port => {
            let confirmed = false

            for (const resourceId of referencedResources) {
                const { portName } = parseResourceID(resourceId)
                if (portName == port) {
                    confirmed = true
                    break
                }
            }

            if (confirmed == false) {
                delete this.portIndex[port]
            }
        })

        this.unresolvedPorts = new Set([...this.unresolvedPorts].filter(port => port in this.portIndex))
    }

    public getMissingPorts() {
        this.filterPorts()

        return [...this.unresolvedPorts].map(v => ({ name: v, path: this.portIndex[v] }))
    }

    public getMissingDependencies() {
        return [...this.unresolvedDependencies]
    }

    public setInitProject() {
        this.isInitProject = true
    }
}()