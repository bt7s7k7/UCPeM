import chalk from "chalk"
import { spawn, SpawnOptions } from "child_process"

export class RunnerError extends Error { }

export function executeCommand(command: string, cwd: string, options: SpawnOptions & { quiet?: boolean } = {}) {
    return new Promise<string>((resolve, reject) => {
        const quiet = options.quiet ?? false
        const output = options.stdio != "ignore"
        // Write the command to be executed
        output && !quiet && process.stdout.write(chalk.grey(`> ${cwd} $ ${command}\n\n  `))

        if (!output) {
            options.stdio = ["ignore", "ignore", "inherit"]
        }

        // Spawn the process
        const childProcess = spawn(command, [], {
            cwd,
            shell: true,
            stdio: "pipe",
            env: {
                ...process.env,
                FORCE_COLOR: "true"
            },
            ...options
        })

        /** Chunks of the output from the command */
        const ret = [] as Buffer[]

        childProcess.on("error", (err) => reject(err)) // On error spawning, reject
        childProcess.on("exit", (code) => { // On exit
            output && !quiet && console.log("")
            if (code == 0) { // If success return the output of the command
                resolve(Buffer.concat(ret).toString())
            } else { // Else throw
                reject(new RunnerError(`Command failed with error code ${code}`))
            }
        })

        // Pipe all streams we don't need to process
        childProcess.stderr?.on("data", (chunk: Buffer) => {
            process.stdout.write(chunk.toString().replace(/\r?\n/g, "\n  "))
        })
        childProcess.stdin && process.stdin.pipe(childProcess.stdin)

        childProcess.stdout?.on("data", (chunk: Buffer) => {
            // Save all output from the command
            ret.push(chunk)

            // Also print it out, but indent so we know it's coming from it
            if (quiet) return
            process.stdout.write(chunk.toString().replace(/\r?\n/g, "\n  "))
        })

    })
}
