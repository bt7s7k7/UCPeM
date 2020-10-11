#!/usr/bin/env node
import chalk from "chalk"
import { createHash } from "crypto"
import { join } from "path"
import { inspect } from "util"
import { CONFIG_FILE_NAME, CURRENT_PATH } from "./global"
import { install } from "./Install/install"
import { DependencyTracker } from "./Project/DependencyTracker"
import { Project } from "./Project/Project"
import { UserError } from "./UserError"

const commands = {
    _devinfo: {
        desc: "Displays information about the current project",
        async callback() {
            const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
            project.loadAllPorts()

            console.log(inspect(project, true, 50, true))
        }
    },
    info: {
        desc: "Displays information about the current project",
        async callback() {
            const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
            project.loadAllPorts()

            project.logTree()
            DependencyTracker.logPorts()
            DependencyTracker.logMissing()

            //console.log(inspect(project, true, 50, true))
        }
    },
    install: {
        desc: "Installs all missing ports",
        async callback() {
            await install()
        }
    }
} as Record<string, { desc: string, callback: () => Promise<void> }>

const args = process.argv.slice(2)

if (args.length == 0 || !(args[0] in commands)) {
    /** All command definitions, excluding the development ones (defined by "_" prefix) */
    const commandDefs = Object.entries(commands).filter(v => v[0][0] != "_")
    /** The length of the longest command (+1 for padding), so we can put all command descs at the same x pos */
    const maxNameLength = commandDefs.reduce((p, v) => Math.max(p, v[0].length), 0) + 1

    console.log("Usage:\n  ucpem <operation>\n\nCommands:")
    commandDefs.forEach(v => {
        console.log(`  ${v[0]}${" ".repeat(maxNameLength - v[0].length)}- ${v[1].desc}`)
    })

    process.exit(1)
} else {
    // Call the callback of the specified command and handle errors
    commands[args[0]].callback().catch(err => {
        if (err instanceof UserError) {
            err.message[0] != "^" && console.error(`[${chalk.redBright("ERR")}] ${err.message}`)
        } else {
            console.error(err)
        }
        const hash = createHash("md5")
        hash.update(err.message)
        process.exit(parseInt(hash.digest("hex"), 16) % 255)
    })
}