import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { Debug } from "./Debug"
import { LOCAL_PORTS_PATH } from "./global"
import { UserError } from "./UserError"

export const ALIAS_FILE_PATH = join(LOCAL_PORTS_PATH, "alias.json")
type AliasMap = Record<string, string[]>

export namespace AliasManager {

    export function loadAliasMap(): AliasMap {
        try { // Create the ports folder
            mkdirSync(LOCAL_PORTS_PATH)
        } catch (err: any) {
            if (err.code != "EEXIST") throw err
        }

        let aliasFileContent: string | null = null

        try {
            aliasFileContent = readFileSync(ALIAS_FILE_PATH).toString()
        } catch (err: any) {
            if (err.code != "ENOENT") throw err
        }

        if (aliasFileContent) {
            return JSON.parse(aliasFileContent)
        } else {
            return {}
        }
    }

    export function saveAliasMap(map: AliasMap) {
        writeFileSync(ALIAS_FILE_PATH, JSON.stringify(map, null, 4))
    }

    export function setAlias(name: string, command: string[]) {
        const map = loadAliasMap()

        if (name in map) throw new UserError("E059 Alias named " + JSON.stringify(name) + " is already taken")
        map[name] = command

        saveAliasMap(map)
    }

    export function unsetAlias(name: string) {
        const map = loadAliasMap()

        if (!(name in map)) throw new UserError("E059 Alias named " + JSON.stringify(name) + " does not exist")
        delete map[name]

        saveAliasMap(map)
    }

    export function runAlias(name: string, args: string[]) {
        Debug.log("ALS", "Running alias", name)
        const map = loadAliasMap()
        Debug.log("ALS", "Loaded aliases", map)

        if (name == null || !(name in map)) return false
        const command = map[name]

        Debug.log("ALS", "Command", command)

        process.argv = [
            ...process.argv.slice(0, 2),
            ...command,
            ...args
        ]

        Debug.log("ALS", "Preparing to run", process.argv)

        const mainModule = require.main!
        delete require.cache[mainModule.filename]
        require(mainModule.filename)

        return true
    }

}
