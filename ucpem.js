/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { rm } = require("fs/promises")
const { project, github, constants, getProjectDetails, path, copy, join } = require("ucpem")

project.use(
    github("bt7s7k7/Apsides").script("builder")
)

project.res("ucpem",
    path("src")
)

project.script("dist", async () => {
    const { PackageBuilder } = require("./ucpem_ports/Apsides/src/projectBuilder/PackageBuilder")
    await copy(join(constants.projectPath, "build/config.json"), join(constants.projectPath, "src/config.json"))
    try {
        const builder = new PackageBuilder(constants.projectPath, getProjectDetails(), "https://github.com/bt7s7k7/UCPeM")
            .addPackage("ucpem", ".", {
                strategy: "esbuild", resource: "ucpem", entryPoint: "src/app.ts",
                packageMerge(pkg) {
                    const own = builder.getProjectPackageJSON()
                    pkg.dependencies["esbuild"] = own.dependencies["esbuild"]
                    pkg.dependencies["chalk"] = own.dependencies["chalk"]
                    pkg.dependencies["source-map-support"] = own.dependencies["source-map-support"]
                    pkg.bin = "index.cjs"
                    pkg.types = "./index.d.ts"
                    pkg.exports["."].types = "./index.d.ts"
                },
                async callback() {
                    await copy(join(constants.projectPath, "build/config.d.ts"), join(constants.projectPath, "pkg-ucpem/index.d.ts"))
                }
            })

        builder.shouldBuildEsm = false
        builder.shouldBuildTypes = false
        await builder.buildPackage("ucpem")
    } finally {
        await rm(join(constants.projectPath, "src/config.json"))
    }
}, { desc: "Prepares a NPM package" })

project.script("test", async (args) => {
    try {
        const { ProjectBuilder } = require("./ucpem_ports/Apsides/src/projectBuilder/ProjectBuilder")
        const builder = new ProjectBuilder(constants.projectPath)
        builder.entryPoint = "./test/test.ts"
        builder.outFile = "./test.js"
        builder.runArguments.push(...args)
        builder.modifyOptions = (options) => {
            options.format = "cjs"
        }

        await builder.build("run")
    } finally {
        await rm("test.js", { force: true })
        await rm("test.js.map", { force: true })
    }
}, { desc: "Runs tests", argc: NaN }) 
