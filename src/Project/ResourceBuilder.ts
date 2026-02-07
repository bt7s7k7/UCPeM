import { existsSync } from "fs"
import { dirname, join } from "path"
import { Debug } from "../Debug"
import { ConfigAPI } from "./ConfigAPI"
import { PrepareScript } from "./PrepareScript"
import { Resource } from "./Resource"
import { parseResourceID } from "./util"

export class ResourceBuilder {
    protected dependencies = new Set<string>()
    protected prepare = null as PrepareScript | null
    protected internal = false

    public addDependency(id: string) {
        if (this.dependencies.has(id)) throw new RangeError(`E111 Duplicate import of dependency "${id}"`)
        this.dependencies.add(id)
    }

    public build() {
        let pathOffset: string | null = null

        // For resource names, we have to support both Java packages and compiled files (e.g.
        // `.dll`) files which may include the '.' character in their names, but it should be
        // interpreted in two separate ways: 1) as part of a filename and 2) as a directory
        // separator for Java packages. To determine which of these options to use, we simply check
        // the existence of the file in option (1) and if that file does not exists, we interpret it
        // as option (2).

        if (this.id.includes(".") && !existsSync(this.path)) {
            const { resourceName } = parseResourceID(this.id)
            const prefix = resourceName.split(".")

            if (prefix.length > 0) {
                pathOffset = "../" + prefix.join("/")
            }

            Debug.log("RES", "Parsing resource path offset: ", this.id, prefix, " = ", pathOffset)
        }

        return new Resource(this.id, this.path, pathOffset, [...this.dependencies], this.prepare, this.internal)
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
