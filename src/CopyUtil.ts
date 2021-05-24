import chalk from "chalk"
import { copyFileSync, Dirent, mkdirSync, readdir, readFileSync, writeFileSync } from "fs"
import { dirname, extname, join, relative, resolve } from "path"
import { promisify } from "util"

export namespace CopyUtil {
    export function massReplace(text: string, replacements: [RegExp, string][]): string {
        replacements.forEach(([expr, replacement]) => {
            text = text.replace(expr, replacement)
        })

        return text
    }

    export async function* find(path: string, pattern?: RegExp | undefined): AsyncGenerator<{ path: string, dirent: Dirent }> {
        const dirents = await promisify(readdir)(path, { withFileTypes: true })
        for (const dirent of dirents) {
            const res = resolve(path, dirent.name)

            if (!pattern || pattern.test(path)) {
                if (dirent.isDirectory()) {
                    yield* find(res)
                } else {
                    yield { path: res, dirent: dirent }
                }
            }
        }
    }

    export function ensureDirectory(path: string) {
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
            if (success) {
                console.log(`[${chalk.greenBright("+DIR")}] ${currentPath}`)
            }
        }
    }

    export async function copy(source: string, target: string, replacements?: [RegExp, string][]) {
        console.log(`[${chalk.greenBright("COPY")}] Copying ${source} → ${target}`)
        for await (const file of find(source)) {
            const offset = relative(source, file.path)
            if (!file.dirent.isDirectory()) {
                if (!replacements) {
                    const targetPath = join(target, offset)
                    console.log(`[${chalk.greenBright("COPY")}]   ${file.path} → ${targetPath}`)
                    ensureDirectory(dirname(targetPath))
                    copyFileSync(file.path, targetPath)
                } else {
                    const targetPath = massReplace(join(target, offset), replacements)
                    console.log(`[${chalk.greenBright("COPY")}]   ${file.path} → ${targetPath}`)
                    ensureDirectory(dirname(targetPath))
                    if (targetPath.includes("__SKIP")) {
                        console.log(`[${chalk.greenBright("COPY")}]   Skipping file`)
                        continue
                    }
                    if (![".jpg", ".jpeg", ".ico", ".png"].includes(extname(targetPath))) {
                        const source = readFileSync(file.path)
                        writeFileSync(targetPath, massReplace(source.toString(), replacements))
                    } else {
                        copyFileSync(file.path, targetPath)
                    }
                }
            }
        }
    }
}