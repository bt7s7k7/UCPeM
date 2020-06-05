import { getProject, IProject, getAllExports, getImportedProjects, getAllDependencies as getAllImports, IDependency, IPort, runPrepare, getDependencies as getImports, getExports } from "./project";
import { exec } from "child_process";
import { promisify } from "util";
import { executeCommand } from "./runner";
import { MSG_NO_MISSING_DEPENDENCIES, PORT_FOLDER_NAME } from "./constants";
import path = require("path");
import { mkdir, symlink } from "fs";
import { performance } from "perf_hooks";


export async function install(folder: string, forceUpdate = false) {
    let startTime = performance.now()
    let project = await getProject(folder)

    let missing = await getMissingResources(project)

    if (!forceUpdate && missing.length == 0) {
        console.log(MSG_NO_MISSING_DEPENDENCIES)
        process.exit(0)
    }

    { // Updating all ports
        let imported = await getImportedProjects(project)
        let imports = await getAllImports([project, ...imported])
        for (let importedProject of imported) {
            let output = await executeCommand("git pull", importedProject.path)
            if (!output.includes("Already up to date.")) {
                await runPrepare(await getProject(importedProject.path), project)
                await createResourceLinks(project, new Set(Object.keys(imports)), importedProject)
            }
        }
    }

    missing = await getMissingResources(project)

    if (forceUpdate && missing.length == 0) {
        console.log(MSG_NO_MISSING_DEPENDENCIES)
        console.log("\n", `Done! Took ${performance.now() - startTime} ms`)
        process.exit(0)
    }

    let lastMissing = new Set<string>(missing.map(v => v.id))

    let portsFolder = path.join(folder, PORT_FOLDER_NAME)

    await promisify(mkdir)(portsFolder).catch(v => v)

    while (missing.length > 0) {
        let ports = {} as Record<string, IPort>
        missing.forEach(v => {
            ports[v.port.path] = v.port
        })

        let imported = await getImportedProjects(project)
        let imports = await getAllImports([project, ...imported])

        for (let port of Object.values(ports)) {
            console.log(`Preparing to install: ${"\n"}  ${port.name} : ${port.path}${"\n"}`)
            let folder = path.join(portsFolder, port.name)
            await executeCommand(`git clone ${port.path} ${folder}`, portsFolder)
            let importedProject = await getProject(folder)
            await runPrepare(importedProject, project)
            let imports = await getAllImports([project, ...imported])
            await createResourceLinks(project, new Set(Object.keys(imports)), importedProject)
            console.log("")
        }

        missing = await getMissingResources(project)

        if (missing.length > 0) {
            let newMissing = new Set<string>(missing.map(v => v.id))
            lastMissing.forEach(v => newMissing.delete(v))
            if (newMissing.size == 0) {
                console.error("Failed to resolve following dependencies: ", lastMissing)
                process.exit(1)
            }
        }

        lastMissing = new Set<string>(missing.map(v => v.id))
    }

    console.log("\n", `Done! Took ${performance.now() - startTime} ms`)
    process.exit(0)
}

export async function getMissingResources(project: IProject) {
    let importedProjects = await getImportedProjects(project)

    let exports = getAllExports(importedProjects)
    let imports = getAllImports([project, ...importedProjects])

    let missing = [] as IDependency[]

    Object.values(imports).forEach(resource => {
        if (!(resource.id in exports)) {
            missing.push(resource)
        }
    })

    return missing
}

export async function createResourceLinks(project: IProject, imports: Set<string>, portProject: IProject) {
    let exports = getExports(portProject)

    await Promise.all(Object.values(exports).map(async dependency => {
        if (imports.has(dependency.id)) {
            let link = path.join(project.path, dependency.resource.name) + ".ucpem"
            let target = path.join(portProject.path, dependency.resource.name)
            console.log(`Linking ${link} to ${target}...`)
            await promisify(symlink)(target, link, "junction").catch((err: NodeJS.ErrnoException) => {
                if (err.code == "EEXIST") {
                    return
                } else {
                    throw err
                }
            })
        }
    }))
}   