import { SpawnOptions } from "child_process"
import { performance } from "perf_hooks"
import { executeCommand, RunnerError } from "./runner"
import path = require("path")

class TestFail extends Error { }

let shell = process.env.SHELL || process.env.COMSPEC

function run(command: string, cwd: string, options: SpawnOptions = {}) {
    return executeCommand(command, cwd, options).catch(err => {
        if (err instanceof RunnerError) {
            throw new TestFail(err.message)
        } else {
            throw err
        }
    })
}

(async () => {
    const startTime = performance.now()
    console.log(`[SETUP] Creating testing folder...`)
    await run("rm -rf test && mkdir test", ".")


    console.log()
    console.log(`[SUCCESS] All tests passed, took ${performance.now() - startTime}ms`)

    process.exit(0)
})().catch((err) => {
    if (err instanceof TestFail) {
        console.error(`[FAIL] ${err.message}`)
    } else {
        console.error(err)
    }
    process.exit(1)
})