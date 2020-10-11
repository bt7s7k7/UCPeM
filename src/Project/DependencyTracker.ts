import { parseNameFromPath } from "./util"

export const DependencyTracker = new class DependencyTracker {
    protected portIndex = {} as Record<string, string>

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
}()