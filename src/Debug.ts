import chalk from "chalk"
import { inspect } from "util"

let enabled = false

export const Debug = {
    enable() {
        enabled = true
    },
    log(source: string, message: string, ...data: any[]) {
        if (enabled) console.log(`[${chalk.magenta("DEBUG")}][${chalk.magentaBright(source)}]`, message, ...data.map(v => inspect(v, false, 50, true)))
    }
}