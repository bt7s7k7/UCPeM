#!/usr/bin/env node
import { inspect } from "util"
import { LOCAL, state } from "./global"
import { createResourceLinks, install, writeGitignore } from "./install"
import { getAllExports, getAllImports, getClonedImports, getExports, getImports, getProject, makeAllExportsWanted, runPrepare } from "./project"
import { UserError } from "./UserError"

const commands = {
    install: {
        desc: LOCAL.help_desc_install,
        async callback() {
            await install(process.cwd())
        }
    },
    _devinstall: {
        desc: "",
        async callback() {
            state.debug = true
            await install(process.cwd())
        }
    },
    update: {
        desc: LOCAL.help_desc_update,
        async callback() {
            await install(process.cwd(), true)
        }
    },
    prepare: {
        desc: LOCAL.help_desc_prepare,
        async callback() {
            let project = await getProject(".")
            await runPrepare(project, null)
            let imported = await getClonedImports(project)
            for (let importedProject of imported) {
                await runPrepare(importedProject, project)
            }
        }
    },
    info: {
        desc: LOCAL.help_desc_info,
        async callback() {
            let project = await getProject(".")
            let wantedResources = makeAllExportsWanted(project)
            console.log(`Project ${project.name} at ${project.path}`)
            console.log(`  Imports:`)
            Object.keys(getImports(project, wantedResources)).forEach(v => console.log(`    ${v}`))
            console.log(`  Exports:`)
            Object.keys(getExports(project)).filter(v => !v.includes("$")).forEach(v => console.log(`    ${v}`))
            console.log(`Implicit:`)
            let importedProjects = await getClonedImports(project)
            console.log(`  Imports:`)
            Object.keys(getAllImports(importedProjects, wantedResources)).forEach(v => console.log(`    ${v}`))
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
            let importedProjects = await getClonedImports(project)

            let projectDependencies = getImports(project, wantedResources)
            let allExports = getAllExports(importedProjects)
            let allDependencies = getAllImports(importedProjects, wantedResources)

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
        desc: LOCAL.help_desc_link,
        async callback() {
            let project = await getProject(".")
            let imported = await getClonedImports(project)
            let imports = getAllExports([project, ...imported])
            let createdLinks = new Set<string>()
            for (let importedProject of imported) {
                await createResourceLinks(project, new Set(Object.keys(imports)), importedProject, createdLinks)
            }

            await writeGitignore(project, createdLinks)
        }
    }
} as Record<string, { desc: string, callback: () => Promise<void> }>

const args = process.argv.slice(2)

if (args.length == 0 || !(args[0] in commands)) {
    /** All command definitions, excluding the development ones (defined by "_" prefix) */
    const commandDefs = Object.entries(commands).filter(v => v[0][0] != "_")
    /** The length of the longest command (+1 for padding), so we can put all command descs at the same x pos */
    const maxNameLength = commandDefs.reduce((p, v) => Math.max(p, v[0].length), 0) + 1

    console.log(LOCAL.help_usage)
    commandDefs.forEach(v => {
        console.log(`  ${v[0]}${" ".repeat(maxNameLength - v[0].length)}- ${v[1].desc}`)
    })

    process.exit(1)
} else {
    // Call the callback of the specified command and handle errors
    commands[args[0]].callback().catch(err => {
        if (err instanceof UserError) {
            console.error(`[ERR] ${err.message}`)
            process.exit(1)
        } else {
            console.error(err)
            process.exit(1)
        }
    })
}