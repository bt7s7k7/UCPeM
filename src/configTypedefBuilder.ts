import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const inputLines = readFileSync(join(__dirname, "../src/Project/ConfigAPI.ts")).toString().split("\n")
const outputLines = [
    `declare module "ucpem" {`,
    `import { Dirent } from "fs"`,
    ...inputLines.slice(3, inputLines.length - 1),
    `export = api as API`,
    `}`
]

const output = outputLines.join("\n")

writeFileSync(join(__dirname, "../build/config.d.ts"), output)
writeFileSync(join(__dirname, "../build/config.json"), JSON.stringify(output))
