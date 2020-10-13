/// <reference lib="es6" />
import chalk from "chalk"
import { join } from "path"
import { performance } from "perf_hooks"
import { executeCommand } from "../src/runner"
import { fail, includes, setupTestDirectory, TestFail, __setCurrentDir } from "./testAPI"
import { cases } from "./testCases"

if (require.main == module) {
    (async () => {

        const startTime = performance.now()
        __setCurrentDir("./.temp")

        for (const [should, { structure, callback, shouldFail }] of Object.entries(cases)) {
            console.log(`[${chalk.cyanBright("TEST")}] ${chalk.cyanBright(should)}`)
            await executeCommand("rm -rf .temp && mkdir .temp && cd .temp", join(__dirname), { stdio: "ignore" })
            await setupTestDirectory(structure, join(__dirname, "./.temp"))
            let error: Error | null = null
            try {
                await callback()
            } catch (err) {
                error = err
            }

            if (shouldFail != null) {
                if (error == null) fail(`This test was expected to fail, but didn't`)
                else {
                    console.log(chalk.yellowBright("  ERR = " + error.message))
                    includes(error.message, shouldFail)
                }
            } else {
                if (error != null) throw error
            }

            console.log("\n" + `[${chalk.greenBright("SUCCESS")}]` + "\n")
        }

        console.log(`[${chalk.greenBright("SUCCESS")}] ${chalk.greenBright(`All tests passed, took ${performance.now() - startTime}ms`)}`)

        process.exit(0)
    })().catch((err) => {
        if (err instanceof TestFail) {
            console.error(`[${chalk.redBright("FAIL")}] ${chalk.redBright(err.message)}`)
        } else {
            console.error(err)
        }
        process.exit(1)
    })
}