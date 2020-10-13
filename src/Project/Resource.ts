import chalk from "chalk";
import { readFileSync, statSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { GITIGNORE_SECTION_BEGIN } from "../global";
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

    public link(linkLog: Set<string> = new Set(), resource: Resource = this) {
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

        if (resource == this) {
            const ignoreFiles = [
                GITIGNORE_SECTION_BEGIN,
                ...linkLog
            ]

            const gitignorePath = join(this.path, ".gitignore")

            /** Text of the current gitignore */
            let gitignoreText = ""
            try {
                gitignoreText = readFileSync(gitignorePath).toString()
            } catch (err) {
                if (err.code != "ENOENT") throw err
            }
            /** Index of the start of our generated text */
            //                                                                  ↓ Subtract one to include the newline we put before our text 
            const ourTextStart = gitignoreText.indexOf(GITIGNORE_SECTION_BEGIN) - 1
            /** Text of the gitignore we didn't generate (user set), save it to put it in the new gitignore */
            //                   ↓ Test if we even found our text, because if not we don't need to slice it out
            const gitignorePre = ourTextStart == -2 ? gitignoreText : gitignoreText.slice(0, ourTextStart)
            /** New gitignore text */
            const gitignoreOutput = gitignorePre + "\n" + ignoreFiles.join("\n") + "\n"
            // Write the new text to the gitignore
            writeFileSync(gitignorePath, gitignoreOutput)
        }
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