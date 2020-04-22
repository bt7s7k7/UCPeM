import { UserError } from "./UserError"
import { getFolderInfo } from "./project"
import { inspect } from "util"

const args = process.argv.slice(2)

var commads = {
    install: {
        desc: "Downloads and prepares all ports",
        async callback() {

        }
    },
    prepare: {
        desc: "Runs the prepare script for this package",
        async callback() {

        }
    },
    info: {
        desc: "Prints imports and config files of the current project",
        async callback() {
            let info = await getFolderInfo(".")
            console.log(inspect(info, { colors: true, depth: Infinity }))
        }
    }
} as Record<string, { desc: string, callback: () => Promise<void> }>

if (args.length == 0 || !(args[0] in commads)) {
    let commandDefs = Object.entries(commads)
    let maxNameLength = commandDefs.reduce((p, v) => Math.max(p, v[0].length), 0) + 1
    console.log("Usage:\n  ucpem <operation>\n\nOperations:")
    commandDefs.forEach(v => {
        console.log(`  ${v[0]}${" ".repeat(maxNameLength - v[0].length)}- ${v[1].desc}`)
    })
} else {
    commads[args[0]].callback().catch(err => {
        if (err instanceof UserError) {
            console.error(`[ERR] ${err.message}`)
        } else {
            console.error(err)
        }
    })
}