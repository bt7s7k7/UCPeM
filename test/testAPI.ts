import { SpawnOptions } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { executeCommand, RunnerError } from "../src/runner";

export class TestFail extends Error { }

export function run(command: string, cwd: string = "", options: SpawnOptions = {}) {
    cwd = join(__dirname, dir(), cwd)

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
    currentDir = dir
}

export function dir() {
    return currentDir
}

export function fail(reason: string) { throw new TestFail(reason) }
export function includes(text: string, substr: string) {
    if (!text.includes(substr)) {
        fail(`Text does not include "${substr}"`)
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