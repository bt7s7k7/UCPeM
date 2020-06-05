import { promisify } from "util"
import { writeFile } from "fs"
import { spawn, SpawnOptions } from "child_process"

export function run(command: string, cwd: string, options: SpawnOptions = {}) {
    return new Promise<string>((resolve, reject) => {
        process.stdout.write(`> ${cwd} > ${command}\n\n  `)

        const childProcess = spawn(command, [], {
            ...options,
            cwd,
            shell: true,
            stdio: "pipe"
        })

        let ret = [] as Buffer[]

        childProcess.on("error", (err) => reject(err))
        childProcess.on("exit", (code) => {
            console.log("")
            if (code == 0) {
                resolve(Buffer.concat(ret).toString())
            } else {
                reject(new TestFail(`Command failed with error code ${code}`))
            }
        })

        childProcess.stderr.pipe(process.stderr)

        childProcess.stdout.on("data", (chunk: Buffer) => {
            process.stdout.write(chunk.toString().replace(/\n\r?/g, "\n  "))
            ret.push(chunk)
        })
    })
}

class TestFail extends Error { }

(async () => {
    console.log(`[SETUP] Creating testing folder...`)
    await run("rm -rf test && mkdir test", ".")

    console.log(`[SETUP] Creating project...`)
    await run("mkdir project", "./test")
    await run("git init", "./test/project")
    await promisify(writeFile)("./test/project/~ucpem_config", `
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
    await promisify(writeFile)("./test/unity/Assets/UCPeM/~ucpem_config", `
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


})().catch((err) => {
    if (err instanceof TestFail) {
        console.error(`[FAIL] ${err.message}`)
    } else {
        console.error(err)
    }
    process.exit(1)
})