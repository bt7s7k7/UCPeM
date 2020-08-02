import { mkdir, readFile, symlink, writeFile } from "fs"
import { performance } from "perf_hooks"
import { inspect, promisify } from "util"
import { GITIGNORE_SECTION_BEGIN, LOCAL, PORT_FOLDER_NAME, state } from "./global"
import { getAllExports, getAllImports as getAllImports, getClonedImports, getExports, getProject, IDependency, IPort, IProject, makeAllExportsWanted, runPrepare, WantedResources } from "./project"
import { executeCommand } from "./runner"
import path = require("path")

/**
 * Clones and links all imports
 * @param folder Path to the project
 * @param forceUpdate If we should pull all imports event if there are no missing resources
 */
export async function install(folder: string, forceUpdate = false) {
    const startTime = performance.now()
    const project = await getProject(folder)
    const wantedResources = makeAllExportsWanted(project)

    let missing = await getMissingResources(project, wantedResources)

    if (!forceUpdate && missing.length == 0) { // If we aren't missing anything, exit
        console.log(LOCAL.install_noMissingResources)
        process.exit(0)
    }

    /** Links created, to be put in .gitignore */
    const createdLinks = new Set<string>()

    { // Updating all ports
        /** All cloned ports */
        let imported = await getClonedImports(project)
        /** All imported resources */
        let imports = await getAllImports([project, ...imported], wantedResources)
        /** If any imports changed */
        let anyChanged = false
        for (let importedProject of imported) { // For each project
            // Pull from remote
            let output = await executeCommand("git pull", importedProject.path)
            // Refresh
            imported = await getClonedImports(project)
            imports = await getAllImports([project, ...imported], wantedResources)

            if (!output.includes("Already up to date.")) { // If there were any updates
                anyChanged = true // Mark that
                await runPrepare(await getProject(importedProject.path), project) // Rerun the prepare
            }
        }

        if (anyChanged) { // If any imports changed
            for (let importedProject of imported) {
                // Redo the links, so if any projects that updated have new dependencies, they will be linked
                await createResourceLinks(project, new Set(Object.keys(imports)), importedProject, createdLinks)
            }
        }
    }

    // Update missing resources
    missing = await getMissingResources(project, wantedResources)

    if (missing.length == 0) { // If we don't miss anything → done!
        console.log(LOCAL.install_noMissingResources)
        console.log(LOCAL.install_done(performance.now() - startTime))
        await writeGitignore(project, createdLinks)
        process.exit(0)
    }

    /** Missing resources last cycle */
    let lastMissing = new Set<string>(missing.map(v => v.id))
    /** Path to folder with imports */
    let portsFolder = path.join(project.path, PORT_FOLDER_NAME)
    /** Create the import folder, incase it doesn't exist */
    await promisify(mkdir)(portsFolder).catch(v => v)

    while (missing.length > 0) { // While we are missing resources
        /** Ports we need to get the required resources */
        const ports = Object.assign({}, ...missing.map(v => ({ [v.port.path]: v.port }))) as Record<string, IPort>

        /** Imports already cloned */
        let imported = await getClonedImports(project)

        for (let port of Object.values(ports)) {  // For all needed ports, clone them
            if (port.path == folder) throw new Error(`Tried to clone self, missing: ${inspect(missing, { colors: true })}`)
            console.log(LOCAL.install_preparingInstall(port.name, port.path))

            let clonePath = path.join(portsFolder, port.name)
            await executeCommand(`git clone "${port.path}" "${clonePath}"`, portsFolder)

            /** The newly cloned project */
            let importedProject = await getProject(clonePath)

            // Prepare it
            await runPrepare(importedProject, project)

            if (state.debug == true) console.log("Wanted resources:", wantedResources)
            /** All imports in the entire project, needed to create new links */
            let imports = await getAllImports([project, importedProject, ...imported], wantedResources)
            if (state.debug == true) console.log("Wanted resources:", wantedResources)

            // Create new links
            await createResourceLinks(project, new Set(Object.keys(imports)), importedProject, createdLinks)

            console.log("")
        }

        // Refresh missing resources
        missing = await getMissingResources(project, wantedResources)

        if (missing.length > 0) { // If any missing
            /** Missing resources that were not missing previously */
            let newMissing = new Set<string>(missing.map(v => v.id))
            // Remove all new missing resources from last missing resources
            lastMissing.forEach(v => newMissing.delete(v))
            if (lastMissing.size == 0) { // If there are any left even after we cloned all the ports, there is nothing we can do, so quit
                console.error(LOCAL.install_failedToResolve(lastMissing))
                process.exit(1)
            }
        }

        // Update the last missing resources
        lastMissing = new Set<string>(missing.map(v => v.id))
    }

    console.log(LOCAL.install_done(performance.now() - startTime))
    await writeGitignore(project, createdLinks)
    process.exit(0)
}

export async function getMissingResources(project: IProject, wantedResources: WantedResources) {
    let importedProjects = await getClonedImports(project)

    let exports = getAllExports([...importedProjects, project])
    let imports = getAllImports([project, ...importedProjects], wantedResources)

    let missing = [] as IDependency[]

    Object.values(imports).forEach(resource => {
        if (!(resource.id in exports)) {
            missing.push(resource)
        }
    })

    return missing
}

/**
 * @param project The root project
 * @param imports All imported resources
 * @param portProject The project to create the links from
 * @param createdLinks Set to save all created links
 */
export async function createResourceLinks(project: IProject, imports: Set<string>, portProject: IProject, createdLinks: Set<string>) {
    /** Exports of the project we are creating links from */
    const exports = Object.values(getExports(portProject))

    if (state.debug == true) {
        console.log(`Creating links for ${portProject.name}, imports:`, imports, "exports: ", exports.map(v => v.id))
    }

    /** Links we need to create */
    const linksToCreate = exports // Take all exports
        .filter(dependency => imports.has(dependency.id)) // Keep only the ones needed
        .map(dependency => {
            const name = dependency.resource.name
            const link = path.join(project.path, name)
            const target = path.join(portProject.path, name)

            return {
                name,
                link,
                target
            }
        })

    await Promise.all(linksToCreate.map(async ({ link, target }) => { // Create the links
        await promisify(symlink)(target, link, "junction").catch((err: NodeJS.ErrnoException) => {
            if (err.code == "EEXIST") {
                // If the link exists already no need to do anything
            } else {
                throw err
            }
        })
        console.log(`Linked ${link} → ${target}`)
    }))

    // Save the created links
    linksToCreate.map(v => v.name).forEach(v => createdLinks.add(v))
}

export async function writeGitignore(project: IProject, createdLinks: Set<string>) {
    const ignoreFiles = [
        GITIGNORE_SECTION_BEGIN,
        PORT_FOLDER_NAME,
        ...createdLinks
    ]

    const gitignorePath = path.join(project.path, ".gitignore")

    /** Text of the current gitignore */
    const gitignoreText = (await promisify(readFile)(gitignorePath).catch(err => { if (err.code == "ENOENT") return ""; else throw err })).toString()
    /** Index of the start of our generated text */
    //                                                                  ↓ Subtract one to include the newline we put before our text 
    const ourTextStart = gitignoreText.indexOf(GITIGNORE_SECTION_BEGIN) - 1
    /** Text of the gitignore we didn't generate (user set), save it to put it in the new gitignore */
    //                   ↓ Test if we even found our text, because if not we don't need to slice it out
    const gitignorePre = ourTextStart == -2 ? gitignoreText : gitignoreText.slice(0, ourTextStart)
    /** New gitignore text */
    const gitignoreOutput = gitignorePre + "\n" + ignoreFiles.join("\n") + "\n"
    // Write the new text to the gitignore
    await promisify(writeFile)(gitignorePath, gitignoreOutput)
}