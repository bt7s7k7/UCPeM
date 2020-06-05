import { SpawnOptions, spawn } from "child_process"

export class RunnerError extends Error { }

export function executeCommand(command: string, cwd: string, options: SpawnOptions = {}) {
    return new Promise<string>((resolve, reject) => {
        process.stdout.write(`> ${cwd} $ ${command}\n\n  `)

        const childProcess = spawn(command, [], {
            ...options,
            cwd,
            shell: true,
            stdio: "pipe",
            env: {
                ...process.env,
                FORCE_COLOR: "true"
            }
        })

        let ret = [] as Buffer[]

        childProcess.on("error", (err) => reject(err))
        childProcess.on("exit", (code) => {
            console.log("")
            if (code == 0) {
                resolve(Buffer.concat(ret).toString())
            } else {
                reject(new RunnerError(`Command failed with error code ${code}`))
            }
        })

        childProcess.stderr.pipe(process.stderr)

        childProcess.stdout.on("data", (chunk: Buffer) => {
            process.stdout.write(chunk.toString().replace(/\n\r?/g, "\n  "))
            ret.push(chunk)
        })

        process.stdin.pipe(childProcess.stdin)
    })
}