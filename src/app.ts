#!/usr/bin/env node
import chalk from "chalk"
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { join } from "path"
import { inspect } from "util"
import { CONFIG_FILE_NAME, CURRENT_PATH, PORT_FOLDER_NAME } from "./global"
import { install } from "./Install/install"
import { link } from "./Install/link"
import { preparePrepare } from "./Install/prepare"
import { update } from "./Install/update"
import { DependencyTracker } from "./Project/DependencyTracker"
import { Project } from "./Project/Project"
import { UserError } from "./UserError"

interface Command {
    desc: string
    callback: () => Promise<void>
    name?: string
}

const commands = {
    _devinfo: {
        desc: "Displays information about the current project",
        async callback() {
            DependencyTracker.setInitProject()
            const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
            await project.loadAllPorts()

            console.log(inspect(project, true, 50, true))
        }
    },
    info: {
        desc: "Displays information about the current project",
        async callback() {
            DependencyTracker.setInitProject()
            const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
            await project.loadAllPorts()

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
            await link()
        }
    },
    prepare: {
        desc: "Runs prepare scripts for all resources",
        async callback() {
            await preparePrepare()
            await DependencyTracker.runPrepares()
        }
    },
    update: {
        desc: "Updates all installed ports",
        async callback() {
            await update()
            await install()
            await DependencyTracker.runPrepares()
            await link()
        }
    },
    link: {
        desc: "Links dependencies to resources",
        async callback() {
            await link()
        }
    },
    init: {
        desc: "Creates a ucpem project",
        async callback() {
            const typedefText = require("./config.json")

            try {
                writeFileSync(".vscode/config.d.ts", typedefText)
            } catch (err) {
                if (err.code != "ENOENT") throw err
                else {
                    mkdirSync(".vscode")
                    writeFileSync(".vscode/config.d.ts", typedefText)
                }
            }

            try {
                statSync(CONFIG_FILE_NAME)
            } catch (err) {
                if (err.code == "ENOENT") {
                    writeFileSync(CONFIG_FILE_NAME, `/// <reference path="./.vscode/config.d.ts" />` + "\n")
                } else throw err
            }

            try {
                const text = readFileSync(".gitignore")

                if (!text.includes(PORT_FOLDER_NAME)) {
                    appendFileSync(".gitignore", "\n# UCPEM\n" + PORT_FOLDER_NAME + "\n")
                }
                if (!text.includes(".vscode")) {
                    appendFileSync(".gitignore", "\n/.vscode\n")
                }
            } catch (err) {
                if (err.code != "ENOENT") throw err
            }
        }
    }
} as Record<string, Command>

const args = process.argv.slice(2)

let command: Command | null = null
let commandArgs = [] as string[]

if (args.length == 0) {
    // Keep null
} else {
    for (let i = args.length; i > 0; i--) {
        const name = args.slice(0, i).join(" ")
        if (name in commands) {
            command = commands[name]
            commandArgs = args.slice(i)
            break
        }
    }
}

if (command == null) {
    /** All command definitions, excluding the development ones (defined by "_" prefix) */
    const commandDefs = Object.entries(commands).map(v => (v[1].name = v[1].name ?? v[0], v[1])).filter(v => v.name![0] != "_")
    /** The length of the longest command (+1 for padding), so we can put all command descs at the same x pos */
    const maxNameLength = commandDefs.reduce((p, v) => Math.max(p, v.name!.length), 0) + 1

    console.log("Usage:\n  ucpem <operation>\n\nCommands:")
    commandDefs.forEach(v => {
        console.log(`  ${v.name}${" ".repeat(maxNameLength - v.name!.length)}- ${v.desc}`)
    })

    process.exit(1)
} else {
    // Call the callback of the specified command and handle errors
    command.callback().catch(err => {
        if (err instanceof UserError) {
            err.message[0] != "^" && console.error(`[${chalk.redBright("ERR")}] ${err.message}`)
        } else {
            console.error(err)
        }
        let exitCode = parseInt((err.message as string)?.match(/E\d\d\d/)?.[0]?.substr(1) ?? "1")
        process.exit(exitCode)
    })
}