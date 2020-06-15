#!/usr/bin/env node
import { UserError } from "./UserError"
import { getProject, runPrepare, getDependencies, getImportedProjects, getExports, getAllDependencies, getAllExports } from "./project"
import { inspect } from "util"
import { install, createResourceLinks } from "./install"

const args = process.argv.slice(2)

var commads = {
    install: {
        desc: "Downloads and prepares all ports",
        async callback() {
            install(process.cwd())
        }
    },
    update: {
        desc: "Updates all ports",
        async callback() {
            install(process.cwd(), true)
        }
    },
    prepare: {
        desc: "Runs the prepare script for this package",
        async callback() {
            let project = await getProject(".")
            await runPrepare(project, null)
            let imported = await getImportedProjects(project)
            for (let importedProject of imported) {
                await runPrepare(importedProject, project)
            }
        }
    },
    info: {
        desc: "Prints imports and config files of the current project",
        async callback() {
            let project = await getProject(".")
            console.log(`Project ${project.name} at ${project.path}`)
            console.log(`  Imports:`)
            Object.keys(getDependencies(project)).forEach(v => console.log(`    ${v}`))
            console.log(`  Exports:`)
            Object.keys(getExports(project)).forEach(v => console.log(`    ${v}`))
            console.log(`Implicit:`)
            let importedProjects = await getImportedProjects(project)
            console.log(`  Imports:`)
            Object.keys(getAllDependencies(importedProjects)).forEach(v => console.log(`    ${v}`))
            console.log(`  Exports:`)
            Object.keys(getAllExports(importedProjects)).forEach(v => console.log(`    ${v}`))

        }
    },
    _devinfo: {
        desc: "",
        async callback() {
            let project = await getProject(".")
            console.log(project)
            let importedProjects = await getImportedProjects(project)
            console.log("----------------------------")
            console.log(importedProjects)
            console.log("----------------------------")
            console.log(getAllExports(importedProjects))
            console.log("----------------------------")
            console.log(getAllDependencies(importedProjects))
        }
    },
    link: {
        desc: "Recreates links for imported resources",
        async callback() {
            let project = await getProject(".")
            let imported = await getImportedProjects(project)
            let imports = await getAllExports([project, ...imported])
            for (let importedProject of imported) {
                await createResourceLinks(project, new Set(Object.keys(imports)), importedProject)
            }
        }
    }
} as Record<string, { desc: string, callback: () => Promise<void> }>

if (args.length == 0 || !(args[0] in commads)) {
    let commandDefs = Object.entries(commads).filter(v => v[0][0] != "_")
    let maxNameLength = commandDefs.reduce((p, v) => Math.max(p, v[0].length), 0) + 1
    console.log("Usage:\n  ucpem <operation>\n\nOperations:")
    commandDefs.forEach(v => {
        console.log(`  ${v[0]}${" ".repeat(maxNameLength - v[0].length)}- ${v[1].desc}`)
    })

    process.exit(1)
} else {
    commads[args[0]].callback().catch(err => {
        if (err instanceof UserError) {
            console.error(`[ERR] ${err.message}`)
            process.exit(1)
        } else {
            console.error(err)
            process.exit(1)
        }
    })
}