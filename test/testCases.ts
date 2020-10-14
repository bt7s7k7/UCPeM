import { statSync, writeFileSync } from "fs";
import { join } from "path";
import { dir, git, includes, notIncludes, run, TestCase, TestFail } from "./testAPI";

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
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
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
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
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
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
            await run(`git add . && git commit -m "Initial commit"`, "./port2", { stdio: "ignore" })
            await run(`ucpem install`, "./project")
            const info = await run(`ucpem info`, "./project")

            notIncludes(info, "port2")
        }
    },
    "Should run the prepare script": {
        structure: {
            "ucpem.js": `
                const { project, prepare } = require("ucpem")

                project.res("resource",
                    prepare(async () => {
                        console.log("__WORKS")
                    })
                )
            `,
            "resource": {
                "index.js": `console.log("Hi")`
            }
        },
        async callback() {
            let info = await run("ucpem prepare")

            includes(info, "__WORKS")
        }
    },
    "Should run the prepare script on first install": {
        structure: {
            "ucpem.js": `
                const { project, prepare } = require("ucpem")

                project.res("resource",
                    prepare(async () => {
                        console.log("__WORKS")
                    })
                )
            `,
            "resource": {
                "index.js": `console.log("Hi")`
            }
        },
        async callback() {
            let info = await run("ucpem install")
            includes(info, "__WORKS")

            info = await run("ucpem install")
            notIncludes(info, "__WORKS")
        }
    },
    "Should correctly execute the run utility": {
        structure: {
            "ucpem.js": `
                const { project, prepare, run } = require("ucpem")

                project.res("resource",
                    prepare(async () => {
                        await run("echo __WORKS")
                    })
                )
            `,
            "resource": {
                "index.js": `console.log("Hi")`
            }
        },
        async callback() {
            const info = await run("ucpem install")
            includes(info, "__WORKS")
        }
    },
    "Should correctly execute the link utility": {
        structure: {
            "ucpem.js": `
                const { project, prepare, link } = require("ucpem")

                project.res("resource",
                    prepare(async () => {
                        link("../resource", "../resource2")
                    })
                )
            `,
            "resource": {
                "index.js": `console.log("Hi")`
            }
        },
        async callback() {
            const info = await run("ucpem install")
            try {
                statSync(join(__dirname, dir(), "resource2"))
            } catch (err) {
                throw new TestFail(err.message)
            }
        }
    },
    "Should run prepare script on installed ports": {
        structure: {
            "project": {
                git,
                "ucpem.js": `
                        const { project, git, prepare } = require("ucpem")
    
                        const port = git("../port")
    
                        project.res("resource",
                            prepare(async () => console.log("__ALPHA")),
                            port.res("dependency")
                        )
                    `,
                "resource": {}
            },
            "port": {
                git,
                "ucpem.js": `
                        const { project, git, prepare } = require("ucpem")
    
                        const port = git("../port2")
    
                        project.res("dependency",
                            prepare(async () => console.log("__BETA")),
                        )
    
                        project.res("dependency2",
                            prepare(async () => console.log("__GAMMA")),
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
                        const { project, prepare } = require("ucpem")
    
                        project.res("dependency2",
                            prepare(async () => console.log("__DELTA")),
                        )
                    `,
                "dependency2": {
                    "index.js": ""
                }
            }
        },
        async callback() {
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
            await run(`git add . && git commit -m "Initial commit"`, "./port2", { stdio: "ignore" })
            const info = await run(`ucpem install`, "./project")

            includes(info, "__ALPHA")
            includes(info, "__BETA")
            notIncludes(info, "__GAMMA")
            notIncludes(info, "__DELTA")
        }
    },
    "Should give the correct constants for the prepare script": {
        structure: {
            "project": {
                git,
                "ucpem.js": `
                    const { project, git, constants, prepare } = require("ucpem")

                    const port = git("../port")

                    project.res("resource",
                        prepare(() => {
                            Object.entries(constants).forEach(([key, value]) => console.log("P/" + key + ": " + JSON.stringify(value)))
                        }),
                        port.res("dependency")
                    )
                `,
                "resource": {}
            },
            "port": {
                git,
                "ucpem.js": `
                    const { project, constants, prepare } = require("ucpem")

                    project.res("dependency",
                        prepare(() => {
                            Object.entries(constants).forEach(([key, value]) => console.log("p/" + key + ": " + JSON.stringify(value)))
                        })
                    )
                `,
                "dependency": {
                    "index.js": ""
                }
            }
        },
        async callback() {
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
            const info = await run(`ucpem install`, "./project")

            includes(info, `P/installName: "project"`)
            includes(info, `P/installPath: ${JSON.stringify(join(__dirname, dir(), "./project"))}`)
            includes(info, `P/isPort: false`)
            includes(info, `P/projectName: "project"`)
            includes(info, `P/projectPath: ${JSON.stringify(join(__dirname, dir(), "./project"))}`)
            includes(info, `P/resourcePath: ${JSON.stringify(join(__dirname, dir(), "./project/resource"))}`)

            includes(info, `p/installName: "project"`)
            includes(info, `p/installPath: ${JSON.stringify(join(__dirname, dir(), "./project"))}`)
            includes(info, `p/isPort: true`)
            includes(info, `p/projectName: "port"`)
            includes(info, `p/projectPath: ${JSON.stringify(join(__dirname, dir(), "./project/ucpem_ports/port"))}`)
            includes(info, `p/resourcePath: ${JSON.stringify(join(__dirname, dir(), "./project/ucpem_ports/port/dependency"))}`)
        }
    },
    "Should update all installed ports": {
        structure: {
            "project": {
                git,
                "ucpem.js": `
                    const { project, git, constants, prepare } = require("ucpem")

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
                    const { project, constants, prepare } = require("ucpem")

                    project.res("dependency",
                    )
                `,
                "dependency": {
                    "index.js": ""
                }
            }
        },
        async callback() {
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
            await run(`ucpem install`, "./project", { stdio: "ignore" })
            writeFileSync(join(__dirname, dir(), "./port/ucpem.js"), `
                const { project, constants, prepare } = require("ucpem")

                project.res("dependency",
                    prepare(() => {
                        console.log("__WORKS")
                    })
                )
            `)
            await run(`git add . && git commit -m "Updated"`, "./port", { stdio: "ignore" })
            const info = await run(`ucpem update`, "./project")

            includes(info, "__WORKS")
        }
    },
    "Should link resources dependent on": {
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
            await run(`git add . && git commit -m "Initial commit"`, "./port", { stdio: "ignore" })
            await run(`git add . && git commit -m "Initial commit"`, "./port2", { stdio: "ignore" })
            await run(`ucpem install`, "./project")

            try { statSync(join(__dirname, dir(), "./project/resource")) } catch (err) { throw new TestFail(err.message) }
            try { statSync(join(__dirname, dir(), "./project/dependency")) } catch (err) { throw new TestFail(err.message) }

            try {
                statSync(join(__dirname, dir(), "./project/dependency2"))
                throw new TestFail("Link to an unneeded resource created")
            } catch (err) { if (err.code != "ENOENT") throw new TestFail(err.message) }
        }
    }
}