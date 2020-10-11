import { Resource } from "./Resource"
import { parseNameFromPath } from "./util"

export const DependencyTracker = new class DependencyTracker {
    protected portIndex = {} as Record<string, string>
    protected resourceIndex = {} as Record<string, Resource>

    public addPort(source: string) {
        const name = parseNameFromPath(source)

        if (name in this.portIndex && this.portIndex[name] != source) {
            throw new RangeError(`Duplicate import of port "${name}" with different source (new)"${source}" != (orig)"${this.portIndex[name]}"`)
        }

        this.portIndex[name] = source

        return name
    }

    public addGithubPort(source: string) {
        return this.addPort("https://github.com/" + source)
    }

    public addResource(resource: Resource) {
        if (resource.id in this.resourceIndex) throw new RangeError(`Duplicate registration of resource "${resource.id}"`)
        else this.resourceIndex[resource.id] = resource
    }

    public resolveResource(id: string) {
        return this.resourceIndex[id]
    }

    public logPorts() {
        Object.entries(this.portIndex).forEach(([key, value]) => console.log(`${key}: ${value}`))
    }
}()