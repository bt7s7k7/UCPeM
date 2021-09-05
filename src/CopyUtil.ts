import chalk from "chalk"
import { copyFileSync, mkdirSync, readdir, readFileSync, writeFileSync } from "fs"
import { dirname, extname, join, relative, resolve } from "path"
import { promisify } from "util"

interface CopyOptions {
    quiet?: boolean
    replacements?: [RegExp, string][]
}

export namespace CopyUtil {
    export function massReplace(text: string, replacements: [RegExp, string][]): string {
        replacements.forEach(([expr, replacement]) => {
            text = text.replace(expr, replacement)
        })

        return text
    }

    export async function* find(path: string, pattern?: RegExp | undefined): AsyncGenerator<{ path: string, isDirectory: boolean }> {
        const dirents = await promisify(readdir)(path, { withFileTypes: true }).catch(err => { if (err.code == "ENOTDIR") { return false } else throw err })
        if (typeof dirents == "boolean") {
            if (!pattern || pattern.test(path)) yield { path, isDirectory: false }
            return
        }

        for (const dirent of dirents) {
            const res = resolve(path, dirent.name)

            if (!pattern || pattern.test(res)) {
                if (dirent.isDirectory()) {
                    yield* find(res)
                } else {
                    yield { path: res, isDirectory: dirent.isDirectory() }
                }
            }
        }
    }

    export function ensureDirectory(path: string, options: { quiet?: boolean } = {}) {
        path = resolve(path)
        const segments = path.split(/\/|\\/)

        let currentPath = "/"

        for (const segment of segments) {
            currentPath = join(currentPath, segment)
            let success = false
            try {
                mkdirSync(currentPath)
                success = true
            } catch (err) {
                if (err.code != "EEXIST") throw err
            }
            if (success && !options.quiet) {
                console.log(`[${chalk.greenBright("+DIR")}] ${currentPath}`)
            }
        }
    }

    export async function copy(source: string, target: string, options: CopyOptions | CopyOptions["replacements"] = {}) {
        options = options instanceof Array ? { replacements: options } : options
        if (!options.quiet) console.log(`[${chalk.greenBright("COPY")}] Copying ${source} → ${target}`)
        for await (const file of find(source)) {
            const offset = relative(source, file.path)
            if (!file.isDirectory) {
                if (!options.replacements) {
                    const targetPath = join(target, offset)
                    if (!options.quiet) console.log(`[${chalk.greenBright("COPY")}]   ${file.path} → ${targetPath}`)
                    ensureDirectory(dirname(targetPath), options)
                    copyFileSync(file.path, targetPath)
                } else {
                    const targetPath = massReplace(join(target, offset), options.replacements)
                    if (!options.quiet) console.log(`[${chalk.greenBright("COPY")}]   ${file.path} → ${targetPath}`)
                    ensureDirectory(dirname(targetPath), options)
                    if (targetPath.includes("__SKIP")) {
                        if (!options.quiet) console.log(`[${chalk.greenBright("COPY")}]   Skipping file`)
                        continue
                    }
                    if (![".jpg", ".jpeg", ".ico", ".png"].includes(extname(targetPath))) {
                        const source = readFileSync(file.path)
                        writeFileSync(targetPath, massReplace(source.toString(), options.replacements))
                    } else {
                        copyFileSync(file.path, targetPath)
                    }
                }
            }
        }
    }
}