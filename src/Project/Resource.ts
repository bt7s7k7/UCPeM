import chalk from "chalk";
import { statSync } from "fs";
import { basename, join } from "path";
import { DependencyTracker } from "./DependencyTracker";
import { link } from "./link";
import { PrepareScript } from "./PrepareScript";
import { Project } from "./Project";

export class Resource {

    logTree(prefix = "", postPrefix = "") {
        console.log(prefix + this.id + (this.internal ? " !!INT" : ""))
        this.dependencies.forEach((dependency, index, { length }) => {
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
        await this.prepare?.run(rootProject, project, this)
    }

    public link(linkLog: Set<string>, resource: Resource = this) {
        if (resource != this) {
            const linkName = basename(this.path);
            link(this.path, join(resource.path, linkName))
            linkLog.add(linkName)
        }
        this.dependencies.forEach(dependency => {
            const dependResource = DependencyTracker.resolveResource(dependency)
            if (!dependResource) throw new Error(`Failed to link resource "${this.id}", because dependency "${dependency}" was not resolved`)
            dependResource.link(linkLog, resource)
        })
    }

    constructor(
        public readonly id: string,
        public readonly path: string,
        public readonly dependencies: Readonly<string[]>,
        public readonly prepare: PrepareScript | null,
        public readonly internal: boolean,
    ) {
        try {
            if (!statSync(path).isDirectory()) {
                throw new TypeError(`E185 Resource path ${this.path} does not point to a directory`)
            }
        } catch (err) {
            if ("code" in err && err.code == "ENOENT") {
                throw new TypeError(`E218 Resource path ${this.path} does not point to a directory, in fact the file does not exist`)
            } else {
                throw err
            }
        }

        DependencyTracker.addResource(this)
    }
}