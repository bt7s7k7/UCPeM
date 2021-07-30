import { Debug } from "./Debug"
import { UserError } from "./UserError"

export interface Command {
    desc: string
    callback: (args: string[]) => Promise<void>
    name?: string,
    argc?: number
}

interface Fallback {
    fallback: (args: string[]) => Promise<boolean>,
    fallbackInfo: () => void
}

export class CLI {

    public async run(args: string[]) {
        let command: Command | null = null
        let commandArgs = [] as string[]

        if (args.length == 0) {
            // Keep null
        } else {
            for (let i = args.length; i > 0; i--) {
                let name = args.slice(0, i).join(" ")
                let debug = false

                if (name[name.length - 1] == "+") {
                    name = name.substring(0, name.length - 1)
                    debug = true
                }

                if (name in this.commands) {
                    command = this.commands[name]
                    const argc = command.argc ?? 0
                    if (debug) Debug.enable()

                    commandArgs = args.slice(i)
                    if (!isNaN(argc) && commandArgs.length != argc) {
                        const commandName = command.desc.split("::")[1]?.trim() ?? command.name ?? name
                        command = {
                            async callback() {
                                throw new UserError(`E051 Expected ${argc} arguments but ${commandArgs.length} provided: ${commandName}`)
                            },
                            desc: ""
                        }
                    }

                    break
                }
            }
        }

        if (command == null) {
            if (this.fallback && await this.fallback.fallback(args)) {
                return
            }

            /** All command definitions, excluding the development ones (defined by "_" prefix) */
            const commandDefs = Object.entries(this.commands).map(v => (v[1].name = v[1].name ?? v[0], v[1])).filter(v => v.name![0] != "_")
            /** The length of the longest command (+1 for padding), so we can put all command descs at the same x pos */
            const maxNameLength = commandDefs.reduce((p, v) => Math.max(p, v.name!.length), 0) + 1

            console.log(`Usage:\n  ${this.usageCommand}\n\nCommands:`)
            commandDefs.forEach(v => {
                console.log(`  ${v.name}${" ".repeat(maxNameLength - v.name!.length)}- ${v.desc}`)
            })

            if (this.fallback) this.fallback.fallbackInfo()

            process.exit(1)
        } else {
            // Call the callback of the specified command and handle errors
            await command.callback(commandArgs)
        }
    }

    protected fallback: Fallback | null = null

    public setFallback(fallback: Fallback) {
        this.fallback = fallback
    }

    constructor(
        protected readonly usageCommand: string,
        protected readonly commands: Record<string, Command>,
    ) { }
}
