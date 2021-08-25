import chalk from "chalk"
import { statSync } from "fs"
import { basename, join } from "path"
import { SCRIPT_RES_PREFIX } from "../global"
import { GitIgnoreGenerator } from "../Install/GitIgnoreGenerator"
import { DependencyTracker } from "./DependencyTracker"
import { link } from "./link"
import { PrepareScript } from "./PrepareScript"
import { Project } from "./Project"
import { parseResourceID } from "./util"

export class Resource {
    public readonly isScript = parseResourceID(this.id).resourceName.startsWith(SCRIPT_RES_PREFIX)

    logTree(prefix = "", postPrefix = "", shallow: boolean | "shallow" = false) {
        console.log(prefix + this.id + (this.internal ? " !!INT" : ""))
        if (!shallow) this.dependencies.forEach((dependency, index, { length }) => {
            const depResource = DependencyTracker.resolveResource(dependency)
            const last = index == length - 1
            const lPrefix = postPrefix + (last ? "└─" : "├─") + " "
            if (depResource) {
                depResource.logTree(lPrefix, postPrefix + (last ? "   " : "│  "))
            } else {
                console.log(lPrefix + chalk.grey(dependency) + " ??")
            }
        })
    }

    public async runPrepare(rootProject: Project, project: Project) {
        await this.prepare?.prepareRun(rootProject, project)()
    }

    public link(resource: Resource = this) {
        if (this.isScript) return

        if (resource != this) {
            const linkName = basename(this.path)
            const linkDir = join(resource.path, "..")
            const linkPath = join(linkDir, linkName)
            if (linkPath != this.path) {
                link(this.path, linkPath)
                GitIgnoreGenerator.addIgnore(linkDir, linkName)
            }
        }

        this.dependencies.forEach(dependency => {
            const dependResource = DependencyTracker.resolveResource(dependency)
            if (!dependResource) throw new Error(`Failed to link resource "${this.id}", because dependency "${dependency}" was not resolved`)
            dependResource.link(resource)
        })
    }

    constructor(
        public readonly id: string,
        public readonly path: string,
        public readonly dependencies: Readonly<string[]>,
        public readonly prepare: PrepareScript | null,
        public readonly internal: boolean,
    ) {
        if (!internal && !this.isScript) {
            try {
                if (!statSync(path).isDirectory()) {
                    throw new TypeError(`E185 Resource path ${this.path} for resource ${this.id} does not point to a directory`)
                }
            } catch (err) {
                if ("code" in err && err.code == "ENOENT") {
                    throw new TypeError(`E218 Resource path ${this.path} for resource ${this.id} does not point to a directory, in fact the file does not exist`)
                } else {
                    throw err
                }
            }
        }

        DependencyTracker.addResource(this)
    }
}