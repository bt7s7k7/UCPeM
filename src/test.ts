import { promisify, inspect } from "util"
import { mkdir, writeFile } from "fs"
import { spawn, SpawnOptions } from "child_process"

const DEFAULT_SHELL = (process.env.COMSPEC || process.env.SHELL) as string

export function run(command: string, cwd: string, options: SpawnOptions = {}) {
    return new Promise<string>((resolve, reject) => {
        process.stdout.write(`> ${cwd} > ${command}\n\n  `)

        const childProcess = spawn(DEFAULT_SHELL, DEFAULT_SHELL == "/bin/bash" ? ["-c", `"${command}"`] : ["/c", command], {
            ...options,
            cwd,
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

class TestFail extends Error {}

(async () => {
    console.log(`[SETUP] Creating testing folder...`)
    await run("rm -rf test && mkdir test", ".")

    console.log(`[TEST] Run in invalid folder`)
    if (await run("ucpem info", "./test").catch(() => { }) != undefined) {
        throw new TestFail("Running in invalid folder didn't fail")
    }
    console.log(`[SUCCESS]`)

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

})().catch((err) => {
    if (err instanceof TestFail) {
        console.error(`[FAIL] ${err.message}`)
    } else {
        console.error(err)
    }
    process.exit(1)
})