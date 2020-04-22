import * as path from "path"
import { promisify } from "util"
import { readFile } from "fs"
import { UserError } from "./UserError"
import { spawn } from "child_process"
import { basename, join } from "path"

export interface IResource {
    name: string,
}

export interface IImportDeclaration {
    port: string,
    resources: IResource[]
}

export function parseConfigFile(content: string, folder: string) {
    const lines = content.split(/\n/g)
    let prepare = [] as string[]
    let ports = {} as Record<string, IImportDeclaration>
    let exports = [] as IResource[]

    var state = "normal" as "normal" | "import" | "prepare" | "export"
    var lastImport = null as IImportDeclaration | null

    for (let i = 0, len = lines.length; i < len; i++) {
        const getPos = () => `${folder}:${i + 1}`
        let line = lines[i].trim()
        let words = line.split(/\s/g).filter(v => v.length > 0)
        if (line[0] == "#" || line.length == 0) continue
        if (state == "normal") {
            if (line == "prepare") {
                state = "prepare"
            } else if (words[0] == "import") {
                if (words.length == 2) {
                    const portName = words[1]
                    if (!(portName in ports)) {
                        ports[portName] = {
                            port: portName,
                            resources: []
                        }
                    }

                    lastImport = ports[portName]
                    state = "import"
                } else {
                    throw new UserError(`Import keywork should have 1 argument ("import" <port>) but ${words.length - 1} found at ${getPos()}`)
                }
            } else if (line == "export") {
                state = "export"
            } else throw new UserError(`Invalid keyword "${line}" at ${getPos()}`)
        } else if (state == "prepare") {
            if (line == "end") {
                state = "normal"
            } else {
                prepare.push(line)
            }
        } else if (state == "import") {
            if (line == "end") {
                state = "normal"
            } else {
                if (words.length > 1) throw new UserError(`Resource name cannot contain whitespace at ${getPos()}`)
                if (!lastImport) throw new Error("Last import not set in import state")
                lastImport.resources.push({ name: words[0] })
            }
        } else if (state == "export") {
            if (line == "end") {
                state = "normal"
            } else {
                if (words.length > 1) throw new UserError(`Resource name cannot contain whitespace at ${getPos()}`)
                exports.push({ name: words[0] })
            }
        }
    }

    return {
        prepare,
        ports,
        exports
    }
}

export async function getFolderInfo(folder: string) {
    let configText = ""

    let tryRead = async () => {
        try {
            configText = (await promisify(readFile)(path.join(path.resolve(process.cwd(), folder), "~ucpem_config"))).toString()
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code != "ENOENT") {
                throw err
            } else {
                return false
            }
        }

        return true
    }

    if (!(await tryRead())) {
        folder = join(folder, "Assets/UCPeM")
        if (!(await tryRead())) {
            throw new UserError(`Failed to find config file in ${basename(path.resolve(process.cwd(), folder))}`)
        }
    }

    const absolutePath = path.resolve(process.cwd(), folder)
    return {
        path: absolutePath,
        name: basename(absolutePath),
        ...parseConfigFile(configText, absolutePath)
    }
}

export type Project = ReturnType<typeof getFolderInfo> extends PromiseLike<infer U> ? U : any

export function runPrepare(project: Project) {
    return new Promise<void>((resolve, reject) => {
        const command = project.prepare.join(" && ")

        console.log(`[PRE] Running prepare script for '${project.name}'`)

        const childProcess = spawn(command, [], {
            cwd: project.path,
            env: { ...process.env },
            stdio: "inherit",
            shell: true
        })

        childProcess.on("error", (err) => reject(err))
        childProcess.on("exit", (code) => {
            if (code == 0) {
                resolve()
            } else {
                reject(new UserError(`Prepare script failed with error code ${code} '${project.name}'`))
            }
        })
    })
}