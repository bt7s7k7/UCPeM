import { promisify } from "util"
import { writeFile } from "fs"
import { spawn, SpawnOptions } from "child_process"
import { CONFIG_FILE_NAME, MSG_NO_MISSING_DEPENDENCIES } from "./constants"
import path = require("path")
import { executeCommand, RunnerError } from "./runner"

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
    console.log(`[SETUP] Creating testing folder...`)
    await run("rm -rf test && mkdir test", ".")

    console.log(`[SETUP] Creating project...`)
    await run("mkdir project", "./test")
    await run("git init", "./test/project")
    await promisify(writeFile)(path.join("./test/project", CONFIG_FILE_NAME), `
        prepare
            echo __FIRST
            echo __SECOND
        end
    `)

    console.log(`[TEST] Run prepare script...`)
    {
        let out = await run("ucpem prepare", "./test/project")
        if (!out.includes("__FIRST") || !out.includes("__SECOND")) throw new TestFail("Prepare script executed wrong, expected output missing")
        console.log("[SUCCESS]")
    }

    console.log(`[SETUP] Creating port...`)
    await run("mkdir unity", "./test")
    await run("git init", "./test/unity")

    console.log(`[TEST] Default exports`)
    await run("mkdir Dummy", "./test/unity")
    {
        let out = await run("ucpem info", "./test/unity")
        if (!out.includes("Dummy")) throw new TestFail("Default export in root not found")
        console.log("[SUCCESS]")
    }

    console.log(`[TEST] Default exports in Asset folder`)
    await run("mkdir Assets", "./test/unity")
    await run("mkdir Eummy2", "./test/unity/Assets")
    {
        let out = await run("ucpem info", "./test/unity")
        if (!out.includes("Eummy")) throw new TestFail("Default export in Assets not found")
        if (out.includes("Dummy")) throw new TestFail("Default export in root was found inspite Assets folder existing")
        console.log("[SUCCESS]")
    }

    await run("mkdir UCPeM", "./test/unity/Assets")
    await promisify(writeFile)(path.join("./test/unity/Assets/UCPeM/", CONFIG_FILE_NAME), `
        prepare
            echo __THIRD
            echo __FOURTH
        end
    `)

    console.log(`[TEST] Run prepare script...`)
    {
        let out = await run("ucpem prepare", "./test/unity")
        if (!out.includes("__THIRD") || !out.includes("__FOURTH")) throw new TestFail("Prepare script executed wrong, expected output missing")
        console.log("[SUCCESS]")
    }

    console.log(`[TEST] No default exports with config`)
    {
        let out = await run("ucpem info", "./test/unity")
        if (out.includes("Eummy2")) throw new TestFail("Default export in Assets was found inspite config existing")
        if (out.includes("Dummy")) throw new TestFail("Default export in root was found inspite config existing")
        console.log("[SUCCESS]")
    }

    console.log(`[TEST] Installing ports`)
    {
        await run("mkdir portAlpha", "./test")
        await run("mkdir alphaResource", "./test/portAlpha")
        await run("git init", "./test/portAlpha")
        await promisify(writeFile)(path.join("./test/portAlpha", CONFIG_FILE_NAME), `
        export
            alphaResource
        end

        prepare
            echo __PREPARE_ALPHA
        end
        `)
        await promisify(writeFile)(path.join("./test/portAlpha/alphaResource", "alpha.js"), `
        console.log("__ALPHA")
        `)
        await run("git add .", "./test/portAlpha")
        await run(`git commit -m "Added resources"`, "./test/portAlpha")
        await promisify(writeFile)(path.join("./test/project", CONFIG_FILE_NAME), `
        import ${path.join(process.cwd(), "./test/portAlpha")}
            alphaResource
        end
        `)
        let installOutput = await run("ucpem install", "./test/project")
        if (!installOutput.includes("__PREPARE_ALPHA")) throw new TestFail("Prepare script in cloned port not run")
        console.log("[SUCCESS]")
    }

    console.log("[TEST] Stop the install when no missing dependencies")
    {
        let output = await run("ucpem install", "./test/project")
        if (!output.includes(MSG_NO_MISSING_DEPENDENCIES)) throw new TestFail("Expected no missing depencencies message")
        console.log("[SUCCESS]")
    }

    console.log("[TEST] More dependencies")
    {
        await run("mkdir portBeta", "./test")
        await run("mkdir betaResource", "./test/portBeta")
        await run("git init", "./test/portBeta")
        await promisify(writeFile)(path.join("./test/portBeta", CONFIG_FILE_NAME), `
        export
            betaResource
        end

        prepare
            echo __PREPARE_BETA
        end
        `)
        await promisify(writeFile)(path.join("./test/portBeta/betaResource", "beta.js"), `
        console.log("__BETA")
        `)
        await run("git add .", "./test/portBeta")
        await run(`git commit -m "Added resources"`, "./test/portBeta")
        await promisify(writeFile)(path.join("./test/portAlpha", CONFIG_FILE_NAME), `
        export
            alphaResource
        end

        prepare
            echo __PREPARE_ALPHA
        end

        import ${path.join(process.cwd(), "./test/portBeta")}
            betaResource
        end
        `)
        await run("git add .", "./test/portAlpha")
        await run(`git commit -m "Added dependency"`, "./test/portAlpha")
        let installOutput = await run("ucpem update", "./test/project")
        if (!installOutput.includes("__PREPARE_ALPHA")) throw new TestFail("Prepare script in cloned port not run")
        if (!installOutput.includes("__PREPARE_BETA")) throw new TestFail("Prepare script in implicitly cloned port not run")
    }

    console.log("[TEST] Running script in imported resources")
    {
        let alphaResourceRunOut = await run("node alpha.js", "./test/project/alphaResource").catch(() => { throw new TestFail("Failed to run imported resource") })
        if (!alphaResourceRunOut.includes("__ALPHA")) throw new TestFail("Running imported resource didn't result in expected output")
        let betaResourceRunOut = await run("node beta.js", "./test/project/betaResource").catch(() => { throw new TestFail("Failed to run implicitly imported resource") })
        if (!betaResourceRunOut.includes("__BETA")) throw new TestFail("Running implicitly imported resource didn't result in expected output")
    }

    process.exit(0)
})().catch((err) => {
    if (err instanceof TestFail) {
        console.error(`[FAIL] ${err.message}`)
    } else {
        console.error(err)
    }
    process.exit(1)
})