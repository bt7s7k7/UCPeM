import { lstatSync, mkdirSync, readdirSync, rmdirSync, statSync, unlinkSync } from "fs"
import { join } from "path"
import { CONFIG_FILE_NAME, CURRENT_PATH, LOCAL_PORTS_PATH } from "./global"
import { DependencyTracker } from "./Project/DependencyTracker"
import { link } from "./Project/link"
import { Project } from "./Project/Project"
import { UserError } from "./UserError"

export class LocalLinker {
    public syncThis() {
        const linkTarget = this.getPathFor(this.project.name)

        try { // Create the ports folder
            mkdirSync(LOCAL_PORTS_PATH)
        } catch (err) {
            if (err.code != "EEXIST") throw err
        }

        try { // Delete the previous link if it exists
            unlinkSync(linkTarget)
            console.log(`Port with the same name is already synced, replacing...`)
        } catch (err) {
            if (err.code != "ENOENT") throw err
        }

        link(this.project.path, linkTarget, false, true)
    }

    public unsyncThis() {
        const linkTarget = this.getPathFor(this.project.name)

        try { // Delete the previous link if it exists
            console.log(`Deleting...`)
            unlinkSync(linkTarget)
            console.log(`Done!`)
        } catch (err) {
            if (err.code != "ENOENT") throw err
            else throw new UserError("E052 Project was not published")
        }
    }

    public syncWith(name: string) {
        if (name == "all") {
            const allAvailablePorts = new Set(this.getAllAvailablePorts().map(v => v.name))
            const allImportedPorts = [...this.getAllLinkedPorts(), ...this.getAllRealPorts()].map(v => v.name)

            allImportedPorts.filter(v => allAvailablePorts.has(v)).forEach(name => {
                console.log(`Syncing with "${name}"...`)
                this.syncWith(name)
            })

            return
        }

        this.project.createPortsFolder()
        const linkSource = this.getPathFor(name)
        const linkTarget = this.getLocalPathFor(name)

        try {
            rmdirSync(linkTarget, { recursive: true })
            console.log(`A project with name "${name}" was already imported, deleting...`)
        } catch (err) {
            if (err.code != "ENOENT") throw err
        }

        link(linkSource, linkTarget, true, false)
    }

    public unsyncWith(name: string) {
        if (name == "all") {
            const allPorts = this.getAllLinkedPorts().map(v => v.name)

            allPorts.forEach(name => {
                console.log(`Unsync with "${name}"...`)
                this.unsyncWith(name)
            })

            return
        }

        const linkTarget = this.getLocalPathFor(name)

        try {
            unlinkSync(linkTarget)
        } catch (err) {
            if (err.code != "ENOENT") throw err
            else throw new UserError(`E053 Project named "${name}" was not linked`)
        }
    }

    protected readonly project: Project

    protected getPathFor(name: string) {
        return join(LOCAL_PORTS_PATH, name)
    }

    protected getLocalPathFor(name: string) {
        return join(this.project.portFolderPath, name)
    }

    protected getAllAvailablePorts() {
        let files: string[]

        try {
            files = readdirSync(LOCAL_PORTS_PATH)
        } catch (err) {
            if (err.code != "ENOENT") throw err
            else return []
        }

        return files
            .map(v => ({ name: v, path: join(LOCAL_PORTS_PATH, v) }))
            .map(v => ({ ...v, isDirectory: statSync(v.path).isDirectory(), isLink: lstatSync(v.path).isSymbolicLink() }))
            .filter(v => v.isDirectory && v.isLink)
    }

    protected getAllRealPorts() {
        let files: string[]

        try {
            files = readdirSync(this.project.portFolderPath)
        } catch (err) {
            if (err.code != "ENOENT") throw err
            else throw new UserError(`E056 There is no ports folder, run "ucpem install"`)
        }

        return files
            .map(v => ({ name: v, path: join(this.project.portFolderPath, v) }))
            .map(v => ({ ...v, isDirectory: statSync(v.path).isDirectory(), isLink: lstatSync(v.path).isSymbolicLink() }))
            .filter(v => v.isDirectory && !v.isLink)
    }

    protected getAllLinkedPorts() {
        let files: string[]

        try {
            files = readdirSync(this.project.portFolderPath)
        } catch (err) {
            if (err.code != "ENOENT") throw err
            else return []
        }

        return files
            .map(v => ({ name: v, path: join(this.project.portFolderPath, v) }))
            .map(v => ({ ...v, isDirectory: statSync(v.path).isDirectory(), isLink: lstatSync(v.path).isSymbolicLink() }))
            .filter(v => v.isDirectory && v.isLink)
    }

    constructor() {
        DependencyTracker.setInitProject()
        this.project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
    }
}