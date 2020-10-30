# UCPeM [![Testing](https://github.com/bt7s7k7/UCPeM/workflows/Testing/badge.svg)](https://github.com/bt7s7k7/UCPeM/actions?query=workflow%3ATesting)
UCPeM is used to import packages into projects. A package is defined in using a port which is a special type of package, that exports resources. In a project these resources can be imported into resource links, which are folder junctions to the cloned repositories of ports. 

## Config
To create a project run: 
```
ucpem init
```
If you have a `.gitignore` file, it will be updated.

A project contains an `ucpem.js` file, defining resources and their dependencies. 

Port is a repository path (for `git clone`). Resource names should be `[a-zA-Z0-9_]+` and cannot contain whitespace.

Port must be a git clone URL. All cloned repos will be placed into a `ucpem_ports` folder in the root of the project. Don't worry about source control, a `.gitignore` file will be generated automatically.

To define a resource write:
```js
const { project } = require("ucpem")

project.res("resource")
```

To define a port and dependency write:
```js
const { project, git, github } = require("ucpem")

const port = git("https://github.com/bt7s7k7/UCPeM")
// OR
const port = github("bt7s7k7/UCPeM")

project.res("resource",
    port.res("dependency")
)
```

Resources can have a preparation script. It's run when the port is cloned, updated or manually using `ucpem prepare`. 
```js
const { project, prepare } = require("ucpem")

project.res("resource",
    prepare(async () => {
        // ...
    })
)
```

Scripts have access to context information in the constants object.
```js
const { project, prepare, constants } = require("ucpem")

project.res("resource",
    prepare(async () => {
        /** Path of the resource the callback is executed for */
        constants.resourcePath
        /** Path to this project */
        constants.projectPath
        /** Path to the install path, eq. to project path if not port */
        constants.installPath
        /** Is this project being installed as a port */
        constants.isPort
        /** Name of this project */
        constants.projectName
        /** Name of the project this port is being installed into */
        constants.installName
    })
)
```

There are utility function you can use in prepare scripts:
```ts
const { project, prepare, link, join, run } = require("ucpem")

project.res("resource",
    prepare(async () => {
        /** Creates a symlink / junction, relative to resource */
        link(link: string, target: string): void
        /** Joins paths together */
        join(...paths: string[]): string
        /** Runs a command, cwd is resource path */
        run(command: string): Promise<void>
    })
)
```

If your resources files are offset from the config folder (i.e. in a `src` folder) you can prefix the project path:
```js
const { project, prepare } = require("ucpem")

const srcFolder = project.prefix("./src")

srcFolder.res("resource")
```

You can also specify a unique path for a resource:
```js
const { project, path } = require("ucpem")

project.res("resourceName",
    path("./path/to/resource/resourceName")
)
```

Sometimes you just want to import a resource to use during development, like testing util scripts:
```js
const { project, git } = require("ucpem")

const port = git("../port")

project.prefix("test").use(port.res("testUtil"))
```

## Local linking
During project development it is often beneficial to develop a dependency along with a project. To synchronize an imported port with it's source you can use local linking.

To publish a port for local linking run:
```
ucpem sync
```
This will create a symlink in a global ucpem folder, from which the port can be linked into a project:
```
ucpem sync with <port name>
```

The global folder is `~/.ucpem` by default but it can be modified with the `UCPEM_LOCAL_PORTS` environmental variable.

Local linking requires node version `^12.10.0`

## Installation
1. Install globally
```
git clone https://github.com/bt7s7k7/UCPeM.git
npm install
npm run build
npm link
```
2. Run once
```html
curl -L https://github.com/bt7s7k7/UCPeM/releases/latest/download/ucpem.js | node - <arguments>
```
## Usage
```
Usage:
  ucpem <operation>

Commands:
  info        - Displays information about the current project
  install     - Installs all missing ports
  prepare     - Runs prepare scripts for all resources
  update      - Updates all installed ports
  link        - Links dependencies to resources
  init        - Creates a ucpem project
  sync        - Publishes this project for local linking
  unsync      - Removes this project from local linking
  sync with   - Syncs with a port that was published for local linking :: Arguments: <name>
  unsync with - Removes a local linked port that was synced with :: Arguments: <name>
```
Run `ucpem` without arguments to view help.