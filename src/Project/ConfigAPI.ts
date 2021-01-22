namespace ConfigAPI {
    export interface RunScriptOptions {
        argc?: number
        desc: string
    }

    export interface RunScriptCallback {
        (args: string[]): Promise<void>
    }

    export interface Project {
        prefix(path: string): Project
        path: string
        res(name: string, ...inp: (Modifier | Dependency)[]): Resource
        use(dep: Dependency): void
        script(name: string, callback: RunScriptCallback, options: RunScriptOptions): void
    }

    export interface Port {
        res(name: string): Dependency
    }

    export interface Dependency {
        id: string
    }

    export interface Resource extends Dependency {

    }

    export interface Modifier {
        callback: any
    }

    export interface API {
        project: Project
        /** Imports a port from github */
        github(path: string): Port
        /** Imports a port from any git repo */
        git(path: string): Port


        /** Sets a path for a resource, relative to prefix, must include resource folder (i.e. "./src/Button" not "./src/" ← use `project.prefix()` for that) */
        path(path: string): Modifier
        /** Sets a resource to be not exported */
        internal(): Modifier
        /** Function to be called before linking dependencies */
        prepare(callback: () => Promise<void>): Modifier

        /** Creates a symlink / junction, relative to resource. Only available during callbacks */
        link(link: string, target: string): void
        /** Joins paths together */
        join(...paths: string[]): string
        /** Runs a command, cwd is resource path. Only available during callbacks */
        run(command: string, cwd?: string): Promise<void>
        /** Runs an UCPeM command */
        ucpem(command: string, cwd?: string): Promise<void>
        /** Includes a config file and returns the resources defined within */
        include(path: string): Record<string, Resource>

        constants: {
            /** Path of the resource the callback is executed for */
            readonly resourcePath: string
            /** Path to this project */
            readonly projectPath: string
            /** Path to the install path, eq. to project path if not port */
            readonly installPath: string
            /** Is this project being installed as a port */
            readonly isPort: boolean
            /** Name of this project */
            readonly projectName: string
            /** Name of the project this port is being installed into */
            readonly installName: string
        }
    }
}