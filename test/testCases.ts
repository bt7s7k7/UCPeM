import { includes, notIncludes, run, TestCase } from "./testAPI";

export const cases: Record<string, TestCase> = {
    "Should return resource name": {
        structure: {
            "ucpem.js": `
                const { project } = require("ucpem")

                project.res("resource")
            `,
            "resource": {
                "index.js": `console.log("Hi")`
            }
        },
        async callback() {
            let info = await run("ucpem info")

            includes(info, "resource")
        }
    },
    "Should fail, because of missing resource folder": {
        structure: {
            "ucpem.js": `
                const { project } = require("ucpem")

                project.res("resource")
            `
        },
        async callback() {
            let info = await run("ucpem info")

            includes(info, "resource")
        },
        shouldFail: "error code 1"
    },
    "Should indicate that a resource is internal": {
        structure: {
            "ucpem.js": `
                const { project, internal } = require("ucpem")

                project.res("resource",
                    internal()
                )
            `,
            "resource": {}
        },
        async callback() {
            let info = await run(`ucpem info`)

            includes(info, ".temp!resource !!INT")
        }
    },
    "Should not indicate that a resource is internal, if not internal": {
        structure: {
            "ucpem.js": `
                const { project, internal } = require("ucpem")

                project.res("resource",
                    internal()
                )

                project.res("resource2",
                    // Not internal
                )
            `,
            "resource": {},
            "resource2": {}
        },
        async callback() {
            let info = await run(`ucpem info`)

            includes(info, ".temp!resource !!INT")
            notIncludes(info, ".temp!resource2 !!INT")
        }
    },
    "Should print the name of the missing port and resource": {
        structure: {
            "ucpem.js": `
                const { project, github } = require("ucpem")

                const port = github("b/port")

                project.res("resource",
                    port.res("depend")
                )
            `,
            "resource": {}
        },
        async callback() {
            let info = await run(`ucpem info`)

            includes(info, "  port :: ")
            includes(info, "  port!depend")
        }
    }

}