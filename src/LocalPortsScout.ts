import { lstatSync, readdirSync, statSync } from "fs"
import { join } from "path"
import { LOCAL_PORTS_PATH } from "./global"

export namespace LocalPortsScout {
    export function getPathFor(name: string) {
        return join(LOCAL_PORTS_PATH, name)
    }

    export function getAllAvailablePorts() {
        let files: string[]

        try {
            files = readdirSync(LOCAL_PORTS_PATH)
        } catch (err: any) {
            if (err.code != "ENOENT") throw err
            else return []
        }

        return files
            .map(v => ({ name: v, path: join(LOCAL_PORTS_PATH, v) }))
            .map(v => ({ ...v, isDirectory: statSync(v.path).isDirectory(), isLink: lstatSync(v.path).isSymbolicLink() }))
            .filter(v => v.isDirectory && v.isLink)
    }
}
