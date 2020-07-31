import { SpawnOptions } from "child_process"
import { writeFile } from "fs"
import { promisify } from "util"
import { CONFIG_FILE_NAME, MSG_NO_MISSING_DEPENDENCIES } from "./global"
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
    await run("mkdir Other", "./test/unity/Assets")
    {
        let out = await run("ucpem info", "./test/unity")
        if (!out.includes("Other")) throw new TestFail("Default export in Assets not found")
        if (out.includes("Dummy")) throw new TestFail("Default export in root was found in spite Assets folder existing")
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
        if (out.includes("Other")) throw new TestFail("Default export in Assets was found in spite config existing")
        if (out.includes("Dummy")) throw new TestFail("Default export in root was found in spite config existing")
        console.log("[SUCCESS]")
    }

    console.log(`[TEST] Installing ports`)
    {
        await run("mkdir portAlpha", "./test")
        await run("mkdir alphaResource", "./test/portAlpha")
        await run("git init", "./test/portAlpha")
        await promisify(writeFile)(path.join("./test/portAlpha", CONFIG_FILE_NAME), `
        raw alphaResource 

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
        default 
            ${path.join(process.cwd(), "./test/portAlpha")}
                alphaResource
            end
        end
        `)
        let installOutput = await run("ucpem install", "./test/project")
        if (!installOutput.includes("__PREPARE_ALPHA")) throw new TestFail("Prepare script in cloned port not run")
        console.log("[SUCCESS]")
    }

    console.log("[TEST] Stop the install when no missing dependencies")
    {
        let output = await run("ucpem install", "./test/project")
        if (!output.includes(MSG_NO_MISSING_DEPENDENCIES)) throw new TestFail("Expected no missing dependencies message")
        console.log("[SUCCESS]")
    }

    console.log("[TEST] More dependencies")
    {
        await run("mkdir portBeta", "./test")
        await run("mkdir betaResource", "./test/portBeta")
        await run("git init", "./test/portBeta")
        await promisify(writeFile)(path.join("./test/portBeta", CONFIG_FILE_NAME), `
        raw betaResource

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
        
        prepare
            echo __PREPARE_ALPHA
        end
        
        res alphaResource
            ${path.join(process.cwd(), "./test/portBeta")}
                betaResource
            end
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

    console.log("[TEST] Don't install dependencies for a resource that's not imported")
    {
        await promisify(writeFile)(path.join("./test/portAlpha", CONFIG_FILE_NAME), `
        
        prepare
            echo __PREPARE_ALPHA
        end
        
        res alphaResource
            ${path.join(process.cwd(), "./test/portBeta")}
                betaResource
            end
        end

        res deltaResource
            ${path.join(process.cwd(), "./test/portGamma")}
                gammaResource
            end
        end
        `)
        await run("git add .", "./test/portAlpha")
        await run(`git commit -m "Added added unwanted resource"`, "./test/portAlpha")
        await run("ucpem update", "./test/project")
        let infoOutput = run("ucpem info", "./test/project")
        if ((await infoOutput).includes("gammaResource")) throw new TestFail("Dependencies for an unimported resource are imported")
    }

    console.log("[TEST] Import resource from self")
    {
        await run("mkdir portGamma", "./test")
        await run("mkdir gammaResource", "./test/portGamma")
        await run("git init", "./test/portGamma")
        await promisify(writeFile)(path.join("./test/portGamma", CONFIG_FILE_NAME), `
        raw gammaResource

        prepare
            echo __PREPARE_GAMMA
        end
        `)
        await run("git add .", "./test/portGamma")
        await run(`git commit -m "Added resources"`, "./test/portGamma")

        await promisify(writeFile)(path.join("./test/portAlpha", CONFIG_FILE_NAME), `
        
        prepare
            echo __PREPARE_ALPHA
        end
        
        res alphaResource
            ${path.join(process.cwd(), "./test/portBeta")}
                betaResource
            end

            self
                deltaResource
            end
        end

        res deltaResource
            ${path.join(process.cwd(), "./test/portGamma")}
                gammaResource
            end
        end
        `)
        await run("git add .", "./test/portAlpha")
        await run(`git commit -m "Added added wanted resource"`, "./test/portAlpha")

        let installOutput = await run("ucpem update", "./test/project")
        if (!installOutput.includes("__PREPARE_GAMMA")) throw new TestFail("Prepare script in portGamma not run")
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