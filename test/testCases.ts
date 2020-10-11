import { includes, run, TestCase } from "./testAPI";

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
    }

}