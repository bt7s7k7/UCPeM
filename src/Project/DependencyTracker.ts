import { Debug } from "../Debug"
import { Project } from "./Project"
import { Resource } from "./Resource"
import { parseNameFromPath, parseResourceID } from "./util"

export const DependencyTracker = new class DependencyTracker {
    protected portIndex = {} as Record<string, string>
    protected projectIndex = {} as Record<string, Project>
    protected resourceIndex = {} as Record<string, Resource>
    protected unresolvedDependencies = new Set<string>()
    protected unresolvedPorts = new Set<string>()
    protected isInitProject = true
    protected rootProject = null as Project | null
    protected ignoredResources = {} as Record<string, Resource>

    public getRootProject() {
        if (!this.rootProject) throw new Error("E167 No root project created")
        return this.rootProject
    }

    public addPort(source: string) {
        const name = parseNameFromPath(source)

        if (name in this.portIndex && this.portIndex[name] != source) {
            throw new RangeError(`E096 Duplicate import of port "${name}" with different source (new)"${source}" != (orig)"${this.portIndex[name]}"`)
        }

        this.portIndex[name] = source

        if (!(name in this.projectIndex)) this.unresolvedPorts.add(name)

        Debug.log("DEP", "Created port", source, name)

        return name
    }

    public addGithubPort(source: string) {
        return this.addPort("https://github.com/" + source)
    }

    public addResource(resource: Resource) {
        if (resource.id in this.resourceIndex) throw new RangeError(`E214 Duplicate registration of resource "${resource.id}"`)

        if (this.unresolvedDependencies.delete(resource.id) || this.isInitProject) {
            this.resourceIndex[resource.id] = resource
            Debug.log("DEP", "Added resource", resource.id)
            resource.dependencies.forEach(dependency => {
                if (!(dependency in this.resourceIndex)) {
                    Debug.log("DEP", "  Unresolved dependency, trying previously ignored resources...", dependency)

                    this.unresolvedDependencies.add(dependency)
                    if (dependency in this.ignoredResources) {
                        Debug.log("DEP", "    Found!")
                        this.addResource(this.ignoredResources[dependency])
                        delete this.ignoredResources[dependency]
                    } else {
                        Debug.log("DEP", "    Failed!")
                    }

                } else {
                    Debug.log("DEP", "  Resolved dependency", dependency)
                }
            })
        } else {
            Debug.log("DEP", "Ignoring resource", resource.id)
            this.ignoredResources[resource.id] = resource
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

        this.isInitProject && (this.rootProject = project)
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

    public async runPrepares(forPortName: string | null = null) {
        if (!this.rootProject) throw new Error("E092 Trying to run prepare scripts but no root project registered")
        const resources = Object.values(this.resourceIndex)
        for (const resource of resources) {
            const portName = parseResourceID(resource.id).portName
            if (forPortName && portName != forPortName) continue
            await resource.runPrepare(this.rootProject!, this.projectIndex[portName])
        }
    }
}()