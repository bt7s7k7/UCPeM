import { git, includes, notIncludes, run, TestCase } from "./testAPI";

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
            await run("ucpem info")
        },
        shouldFail: "error code 218"
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
    },
    "Should say no missing dependencies if no missing": {
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
            let info = await run("ucpem install")

            includes(info, "No missing dependencies")
        }
    },
    "Should install the missing port": {
        structure: {
            "project": {
                git,
                "ucpem.js": `
                    const { project, git } = require("ucpem")

                    const port = git("../port")

                    project.res("resource",
                        port.res("dependency")
                    )
                `,
                "resource": {}
            },
            "port": {
                git,
                "ucpem.js": `
                    const { project } = require("ucpem")

                    project.res("dependency")
                `,
                "dependency": {
                    "index.js": ""
                }
            }
        },
        async callback() {
            await run(`git add . && git commit -m "Initial commit"`, "./port")
            await run(`ucpem install`, "./project")
        }
    },
    "Should error on missing resource after install": {
        structure: {
            "project": {
                git,
                "ucpem.js": `
                    const { project, git } = require("ucpem")

                    const port = git("../port")

                    project.res("resource",
                        port.res("dependency"),
                        port.res("dependency2")
                    )
                `,
                "resource": {}
            },
            "port": {
                git,
                "ucpem.js": `
                    const { project } = require("ucpem")

                    project.res("dependency")
                `,
                "dependency": {
                    "index.js": ""
                }
            }
        },
        async callback() {
            await run(`git add . && git commit -m "Initial commit"`, "./port")
            await run(`ucpem install`, "./project")
        },
        shouldFail: "error code 177"
    },
    "Should only install ports dependent on": {
        structure: {
            "project": {
                git,
                "ucpem.js": `
                    const { project, git } = require("ucpem")

                    const port = git("../port")

                    project.res("resource",
                        port.res("dependency")
                        
                    )
                `,
                "resource": {}
            },
            "port": {
                git,
                "ucpem.js": `
                    const { project, git } = require("ucpem")

                    const port = git("../port2")

                    project.res("dependency")

                    project.res("dependency2",
                        port.res("dependency2")
                    )
                `,
                "dependency": {
                    "index.js": ""
                },
                "dependency2": {
                    "index.js": ""
                }
            },
            "port2": {
                git,
                "ucpem.js": `
                    const { project } = require("ucpem")

                    project.res("dependency2")
                `,
                "dependency2": {
                    "index.js": ""
                }
            }
        },
        async callback() {
            await run(`git add . && git commit -m "Initial commit"`, "./port")
            await run(`git add . && git commit -m "Initial commit"`, "./port2")
            await run(`ucpem install`, "./project")
            const info = await run(`ucpem info`, "./project")

            notIncludes(info, "port2")
        }
    }

}