
export namespace ConfigAPI {
    interface CopyOptions {
        quiet?: boolean
        replacements?: [RegExp, string][]
    }

    export interface RunScriptOptions {
        argc?: number
        dependencies?: Dependency[]
        desc?: string
    }

    export interface RunScriptCallback {
        (args: string[]): Promise<void>
    }

    export interface ScriptRef extends Dependency {
        path: string
        name: string
        run(args?: string, cwd?: string): Promise<string>
    }

    export interface Project {
        prefix(path: string): Project
        path: string
        res(name: string, ...inp: (Modifier | Dependency)[]): Resource
        use(...dep: Dependency[]): void
        script(name: string, callback: RunScriptCallback, options?: RunScriptOptions): ScriptRef
        /** Creates a reference to a resource defined the project */
        ref(name: string): Dependency
        isChild(): void
    }

    export interface Port {
        res(name: string): Dependency
        script(name: string): ScriptRef
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
        log(...msg: any[]): void

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
        run(command: string, cwd?: string): Promise<string>
        /** Runs an UCPeM command */
        ucpem(command: string, cwd?: string): Promise<string>
        /** Includes a config file and returns the resources defined within */
        include(path: string): Record<string, Resource>

        /** Apply each replacement to a string */
        massReplace(text: string, replacements: [RegExp, string][]): string
        /** Find all files in a folder recursively, optionally filtered by pattern */
        find(path: string, pattern?: RegExp): AsyncGenerator<{ path: string, isDirectory: boolean }>
        /** Copy file / directory, optionally replace filename and content */
        copy(source: string, target: string, options?: CopyOptions | CopyOptions["replacements"]): Promise<void>
        /** Creates directories for the path to exist */
        ensureDirectory(path: string, options?: { quiet?: boolean }): void

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