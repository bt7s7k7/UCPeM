import { mkdir, readFile, symlink, writeFile } from "fs"
import { performance } from "perf_hooks"
import { promisify } from "util"
import { GITIGNORE_SECTION_BEGIN, MSG_NO_MISSING_DEPENDENCIES, PORT_FOLDER_NAME } from "./global"
import { getAllDependencies as getAllImports, getAllExports, getExports, getImportedProjects, getProject, IDependency, IPort, IProject, makeAllExportsWanted, runPrepare, WantedResources } from "./project"
import { executeCommand } from "./runner"
import path = require("path")


export async function install(folder: string, forceUpdate = false) {
    let startTime = performance.now()
    let project = await getProject(folder)
    let wantedResources = makeAllExportsWanted(project)

    let missing = await getMissingResources(project, wantedResources)

    if (!forceUpdate && missing.length == 0) {
        console.log(MSG_NO_MISSING_DEPENDENCIES)
        process.exit(0)
    }

    let createdLinks = new Set<string>()

    { // Updating all ports
        let imported = await getImportedProjects(project)
        let imports = await getAllImports([project, ...imported], wantedResources)
        for (let importedProject of imported) {
            let output = await executeCommand("git pull", importedProject.path)
            if (!output.includes("Already up to date.")) {
                await runPrepare(await getProject(importedProject.path), project)
                await createResourceLinks(project, new Set(Object.keys(imports)), importedProject, createdLinks)
            }
        }
    }

    missing = await getMissingResources(project, wantedResources)

    if (forceUpdate && missing.length == 0) {
        console.log(MSG_NO_MISSING_DEPENDENCIES)
        console.log("\n", `Done! Took ${performance.now() - startTime} ms`)
        await flushCreatedLinks(project, createdLinks)
        process.exit(0)
    }

    let lastMissing = new Set<string>(missing.map(v => v.id))

    let portsFolder = path.join(project.path, PORT_FOLDER_NAME)

    await promisify(mkdir)(portsFolder).catch(v => v)

    while (missing.length > 0) {
        let ports = {} as Record<string, IPort>
        missing.forEach(v => {
            ports[v.port.path] = v.port
        })

        let imported = await getImportedProjects(project)
        let imports = await getAllImports([project, ...imported], wantedResources)

        for (let port of Object.values(ports)) {
            console.log(`Preparing to install: ${"\n"}  ${port.name} : ${port.path}${"\n"}`)
            let folder = path.join(portsFolder, port.name)
            await executeCommand(`git clone "${port.path}" "${folder}"`, portsFolder)
            let importedProject = await getProject(folder)
            await runPrepare(importedProject, project)
            let imports = await getAllImports([project, ...imported], wantedResources)
            await createResourceLinks(project, new Set(Object.keys(imports)), importedProject, createdLinks)
            console.log("")
        }

        missing = await getMissingResources(project, wantedResources)

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
    await flushCreatedLinks(project, createdLinks)
    process.exit(0)
}

export async function getMissingResources(project: IProject, wantedResources: WantedResources) {
    let importedProjects = await getImportedProjects(project)

    let exports = getAllExports(importedProjects)
    let imports = getAllImports([project, ...importedProjects], wantedResources)

    let missing = [] as IDependency[]

    Object.values(imports).forEach(resource => {
        if (!(resource.id in exports)) {
            missing.push(resource)
        }
    })

    return missing
}

export async function createResourceLinks(project: IProject, imports: Set<string>, portProject: IProject, createdLinks: Set<string>) {
    let exports = getExports(portProject)

    let linksToCreate = Object.values(exports).filter(dependency => imports.has(dependency.id)).map(dependency => {
        let name = dependency.resource.name
        let link = path.join(project.path, name)
        let target = path.join(portProject.path, name)

        return {
            name,
            link,
            target
        }
    })

    await Promise.all(linksToCreate.map(async ({ link, target }) => {
        await promisify(symlink)(target, link, "junction").catch((err: NodeJS.ErrnoException) => {
            if (err.code == "EEXIST") {
                return
            } else {
                console.log("[ERR]", err.stack)
            }
        })
        console.log(`Linked ${link} → ${target}`)
    }))


    linksToCreate.map(v => v.name).forEach(v => createdLinks.add(v))
}

export async function flushCreatedLinks(project: IProject, createdLinks: Set<string>) {
    let ignoreFiles = [
        GITIGNORE_SECTION_BEGIN,
        PORT_FOLDER_NAME,
        ...createdLinks
    ]

    let gitignorePath = path.join(project.path, ".gitignore")

    let gitignoreText = (await promisify(readFile)(gitignorePath).catch(err => { if (err.code == "ENOENT") return ""; else throw err })).toString()
    let ourTextStart = gitignoreText.indexOf(GITIGNORE_SECTION_BEGIN) - 1
    let gitignorePre = ourTextStart == -2 ? gitignoreText : gitignoreText.slice(0, ourTextStart)
    let gitignoreOutput = gitignorePre + "\n" + ignoreFiles.join("\n") + "\n"

    await promisify(writeFile)(gitignorePath, gitignoreOutput)
}