#!/usr/bin/env node
import { inspect } from "util"
import { state } from "./global"
import { createResourceLinks, flushCreatedLinks, install } from "./install"
import { getAllDependencies, getAllExports, getDependencies, getExports, getImportedProjects, getProject, makeAllExportsWanted, runPrepare } from "./project"
import { UserError } from "./UserError"

const args = process.argv.slice(2)

var commads = {
    install: {
        desc: "Downloads and prepares all ports",
        async callback() {
            install(process.cwd())
        }
    },
    _devinstall: {
        desc: "Downloads and prepares all ports",
        async callback() {
            state.debug = true
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
            let wantedResources = makeAllExportsWanted(project)
            console.log(`Project ${project.name} at ${project.path}`)
            console.log(`  Imports:`)
            Object.keys(getDependencies(project, wantedResources)).forEach(v => console.log(`    ${v}`))
            console.log(`  Exports:`)
            Object.keys(getExports(project)).filter(v => !v.includes("$")).forEach(v => console.log(`    ${v}`))
            console.log(`Implicit:`)
            let importedProjects = await getImportedProjects(project)
            console.log(`  Imports:`)
            Object.keys(getAllDependencies(importedProjects, wantedResources)).forEach(v => console.log(`    ${v}`))
            console.log(`  Exports:`)
            Object.keys(getAllExports(importedProjects)).filter(v => !v.includes("$")).forEach(v => console.log(`    ${v}`))

        }
    },
    _devinfo: {
        desc: "",
        async callback() {
            state.debug = true

            let project = await getProject(".")
            let wantedResources = makeAllExportsWanted(project)
            let importedProjects = await getImportedProjects(project)

            let projectDependencies = getDependencies(project, wantedResources)
            let allExports = getAllExports(importedProjects)
            let allDependencies = getAllDependencies(importedProjects, wantedResources)

            console.log("----------------------------")
            console.log("|         Project          |")
            console.log("----------------------------")
            console.log(inspect(project, { colors: true, depth: 10 }))
            console.log("----------------------------")
            console.log("|    Imported projects     |")
            console.log("----------------------------")
            console.log(inspect(importedProjects, { colors: true, depth: 10 }))
            console.log("----------------------------")
            console.log("|        All Exports       |")
            console.log("----------------------------")
            console.log(inspect(allExports, { colors: true, depth: 10 }))
            console.log("----------------------------")
            console.log("|     All dependencies     |")
            console.log("----------------------------")
            console.log(inspect(allDependencies, { colors: true, depth: 10 }))
        }
    },
    link: {
        desc: "Recreates links for imported resources",
        async callback() {
            let project = await getProject(".")
            let imported = await getImportedProjects(project)
            let imports = getAllExports([project, ...imported])
            let createdLinks = new Set<string>()
            for (let importedProject of imported) {
                await createResourceLinks(project, new Set(Object.keys(imports)), importedProject, createdLinks)
            }

            await flushCreatedLinks(project, createdLinks)
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