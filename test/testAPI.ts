import { SpawnOptions } from "child_process"
import { mkdirSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import { executeCommand, RunnerError } from "../src/runner"

export const testFolder = join(__dirname, "test")

let ucpemExec = "ucpem"
if (process.argv.length > 2) ucpemExec = join(testFolder, "..", process.argv[2])

export class TestFail extends Error { }

export function run(command: string, cwd: string = "", options: SpawnOptions = {}) {
    cwd = dir(cwd)

    command = command.replace(/^ucpem/, ucpemExec)

    return executeCommand(command, cwd, options).catch(err => {
        if (err instanceof RunnerError) {
            throw new TestFail(err.message)
        } else {
            throw err
        }
    })
}

export const shell = process.env.SHELL || process.env.COMSPEC

let currentDir = ""

export function __setCurrentDir(dir: string) {
    currentDir = resolve(testFolder, dir)
}

export function dir(post = "") {
    return join(currentDir, post)
}

export function fail(reason: string) { throw new TestFail(reason) }

export function removeANSI(text: string) {
    return text.replace(/\x1b\[\d*\w/g, "")
}

export function includes(text: string, substr: string) {
    if (!text.includes(substr)) {
        fail(`Text does not include "${substr}"`)
    }
}

export function notIncludes(text: string, substr: string) {
    if (text.includes(substr)) {
        fail(`Text does include "${substr}"`)
    }
}

export interface DirectoryStructure extends Record<string, DirectoryStructure | string | typeof git> { }

export interface TestCase {
    structure: DirectoryStructure,
    callback: () => Promise<void>,
    shouldFail?: string
}

export async function setupTestDirectory(structure: DirectoryStructure, cwd: string) {
    for (const [key, value] of Object.entries(structure)) {
        if (value == git) {
            await executeCommand("git init", cwd, { stdio: "ignore" })
        } else if (typeof value == "string") {
            writeFileSync(join(cwd, key), value)
        } else {
            mkdirSync(join(cwd, key))
            await setupTestDirectory(value, join(cwd, key))
        }
    }
}

export const git = Symbol("git")
