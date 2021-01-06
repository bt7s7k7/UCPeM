#!/usr/bin/env node
import chalk from "chalk"
import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { join } from "path"
import { inspect } from "util"
import { CLI } from "./CLI"
import { CONFIG_FILE_NAME, CURRENT_PATH, PORT_FOLDER_NAME } from "./global"
import { install } from "./Install/install"
import { linkResources } from "./Install/link"
import { preparePrepare } from "./Install/prepare"
import { update } from "./Install/update"
import { LocalLinker } from "./LocalLinker"
import { DependencyTracker } from "./Project/DependencyTracker"
import { Project } from "./Project/Project"
import { runScript } from "./runScript"
import { UserError } from "./UserError"

const cli = new CLI("ucpem <operation>", {
    _devinfo: {
        desc: "Displays information about the current project",
        async callback() {
            const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
            await project.loadAllPorts()

            console.log(inspect(project, true, 50, true))
        }
    },
    info: {
        desc: "Displays information about the current project",
        async callback() {
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
            await linkResources()
        }
    },
    "install remote": {
        desc: "Install all missing ports without using local ports",
        async callback() {
            await install(true)
            await linkResources()
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
            await linkResources()
        }
    },
    link: {
        desc: "Links dependencies to resources",
        async callback() {
            await linkResources()
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
    },
    sync: {
        desc: "Publishes this project for local linking",
        async callback() {
            new LocalLinker().syncThis()
        }
    },
    unsync: {
        desc: "Removes this project from local linking",
        async callback() {
            new LocalLinker().unsyncThis()
        }
    },
    "sync with": {
        desc: "Syncs with a port that was published for local linking :: Arguments: <name>",
        async callback(commandArgs) {
            new LocalLinker().syncWith(commandArgs[0], true)
        },
        argc: 1
    },
    "unsync with": {
        desc: "Removes a local linked port that was synced with :: Arguments: <name>",
        async callback(commandArgs) {
            new LocalLinker().unsyncWith(commandArgs[0])
            console.log(`Done! Don't forget to run "ucpem install" to install the port for real`)
        },
        argc: 1
    },
    run: {
        desc: "Runs a run script :: Arguments: <name> (...)",
        async callback(args) {
            await runScript(args)
        },
        argc: NaN
    }
})

cli.run(process.argv.slice(2)).catch(err => {
    if (err instanceof UserError) {
        err.message[0] != "^" && console.error(`[${chalk.redBright("ERR")}] ${err.message}`)
    } else {
        console.error(err)
    }
    let exitCode = parseInt((err.message as string)?.match(/E\d\d\d/)?.[0]?.substr(1) ?? "1")
    process.exit(exitCode)
})

