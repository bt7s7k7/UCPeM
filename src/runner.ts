import { spawn, SpawnOptions } from "child_process"

export class RunnerError extends Error { }

export function executeCommand(command: string, cwd: string, options: SpawnOptions = {}) {
    return new Promise<string>((resolve, reject) => {
        // Write the command to be executed
        process.stdout.write(`> ${cwd} $ ${command}\n\n  `)

        // Spawn the process
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

        /** Chunks of the output from the command */
        const ret = [] as Buffer[]

        childProcess.on("error", (err) => reject(err)) // On error spawning, reject
        childProcess.on("exit", (code) => { // On exit
            console.log("")
            if (code == 0) { // If success return the output of the command
                resolve(Buffer.concat(ret).toString())
            } else { // Else throw
                reject(new RunnerError(`Command failed with error code ${code}`))
            }
        })

        // Pipe all streams we don't need to process
        childProcess.stderr.pipe(process.stderr)
        process.stdin.pipe(childProcess.stdin)

        childProcess.stdout.on("data", (chunk: Buffer) => {
            // Save all output from the command
            ret.push(chunk)
            // Also print it out, but indent so we know it's coming from it
            process.stdout.write(chunk.toString().replace(/\n\r?/g, "\n  "))
        })

    })
}