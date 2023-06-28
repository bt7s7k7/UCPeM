#!/usr/bin/env node
import chalk from "chalk"
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs"
import { join, relative } from "path"
import "source-map-support/register"
import { inspect } from "util"
import { ALIAS_FILE_PATH, AliasManager } from "./AliasManager"
import { CLI } from "./CLI"
import { CopyUtil } from "./CopyUtil"
import { CONFIG_FILE_NAME, CURRENT_PATH, LOCAL_PORTS_PATH, PORT_FOLDER_NAME, state } from "./global"
import { install } from "./Install/install"
import { linkResources } from "./Install/link"
import { preparePrepare } from "./Install/prepare"
import { update } from "./Install/update"
import { LocalLinker } from "./LocalLinker"
import { DependencyTracker } from "./Project/DependencyTracker"
import { LinkHistory } from "./Project/link"
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
        }
    },
    "info brief": {
        desc: "Displays all project resources",
        async callback() {
            const project = Project.fromFile(join(CURRENT_PATH, CONFIG_FILE_NAME))
            project.logTree("shallow")
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
            await install("remote")
            await linkResources()
        }
    },
    "install local": {
        desc: "Install all missing ports without using local ports",
        async callback() {
            await install("local")
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
    "update all": {
        desc: "Updates all installed ports, including local linked",
        async callback() {
            await update("include local ports")
            await install()
            await DependencyTracker.runPrepares()
            await linkResources()
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
    "link resolve": {
        desc: "Changes links into real folders",
        async callback() {
            state.compact = true
            await linkResources()

            for (const { source, target } of LinkHistory.history) {
                if (relative(process.cwd(), target).startsWith("..")) continue

                try {
                    unlinkSync(target)
                    await CopyUtil.copy(source, target)
                } catch (err) {
                    if (err.code == "EISDIR") {
                        // Real folder already, skipping
                    } else {
                        throw err
                    }
                }
            }
        }
    },
    "link clean": {
        desc: "Deletes all created links",
        async callback() {
            state.compact = true
            await linkResources()

            for (const { source, target } of LinkHistory.history) {
                if (relative(process.cwd(), target).startsWith("..")) continue
                try {
                    unlinkSync(target)
                } catch (err) {
                    if (err.code == "ENOENT") {
                        // We already did this one, skip
                    } else throw err
                }
            }
        },
    },
    "link unresolve": {
        desc: "Reverts changes made by `link resolve`",
        async callback() {
            state.compact = true
            await linkResources()

            for (const { source, target } of LinkHistory.history) {
                if (relative(process.cwd(), target).startsWith("..")) continue

                try {
                    rmSync(target, { recursive: true })
                } catch (err) {
                    if (err.code == "ENOENT") {
                        // Already deleted skipping
                    } else throw err
                }
            }

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
    },
    "add to bin": {
        desc: `Copies self to "node_modules/.bin" so it can be used with yarn, use thins when doing a curl install, only use with single file builds`,
        async callback() {
            const self = process.argv[1]
            copyFileSync(self, "node_modules/.bin/ucpem")
            console.log("Done!")
        }
    },
    alias: {
        desc: "Create shorthand alias for a command :: Arguments: <name> <command...>",
        argc: NaN,
        async callback(args) {
            const name = args.splice(0, 1)[0]
            AliasManager.setAlias(name, args)
            console.log(`Added alias ${name} => ${args.join(" ")}`)
        }
    },
    unalias: {
        desc: "Remove alias :: Arguments: <name>",
        argc: 1,
        async callback([name]) {
            AliasManager.unsetAlias(name)
            console.log(`Removed alias ${name}`)
        }
    },
    paths: {
        desc: "Prints all system paths used by SMWA",
        async callback(args) {
            console.log("Local ports: " + LOCAL_PORTS_PATH)
            console.log("Alias config: " + ALIAS_FILE_PATH)
        },
    }
})

cli.setFallback({
    fallback: async (args) => {
        const name = args.splice(0, 1)[0]
        return AliasManager.runAlias(name, args)
    },
    fallbackInfo: () => {
        const aliasMap = AliasManager.loadAliasMap()
        const aliases = Object.entries(aliasMap)
        if (aliases.length == 0) return

        console.log("")
        console.log("Aliases:")
        for (const [alias, command] of aliases) {
            console.log(`  ${alias} => ${command.join(" ")}`)
        }
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

