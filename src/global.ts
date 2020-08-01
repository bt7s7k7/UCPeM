import { inspect } from "util"

export const PORT_FOLDER_NAME = "ucpem_ports~"
export const CONFIG_FILE_NAME = "ucpem_config"
export const GITIGNORE_SECTION_BEGIN = "# UCPeM generated, write above to not be overwritten"

export const LOCAL = {
    install_noMissingResources: "No missing resources",
    install_done: (took: number) => "\n" + `Done! Took ${took} ms`,
    install_preparingInstall: (name: string, path: string) => `Preparing to install: ${"\n"}  ${name} : ${path}${"\n"}`,
    install_failedToResolve: (lastMissing: Set<string>) => "Failed to resolve following dependencies: " + inspect(lastMissing, { colors: true }),
    help_desc_install: "Downloads and prepares all ports",
    help_desc_update: "Updates all ports",
    help_desc_link: "Recreates all links to imports",
    help_desc_info: "Prints information about this project",
    help_desc_prepare: "Runs all prepare scripts in this project",
    help_usage: "Usage:\n  ucpem <operation>\n\nOperations:",
    config_prepare_invalidType: (type: string, pos: string) => `Invalid prepare type "${type}" at ${pos}`,
    config_prepare_argErr: (pos: string) => `Prepare keyword should have 1 or 0 arguments ("prepare" ["using" <type>]) at ${pos}`,
    config_res_duplicate: (pos: string) => `Duplicate resource definition at ${pos}`,
    config_res_argErr: (pos: string) => `Resource keyword should have 1 argument ("res" <name>) at ${pos}`,
    config_raw_argErr: (pos: string) => `Raw keyword should have 1 argument ("raw" <name>) at ${pos}`,
    config_invalidKeyword: (pos: string) => `Invalid keyword at ${pos}`,
    config_port_duplicate: (port: string, resource: string, pos: string) => `Duplicate port ${port} in resource ${resource} at ${pos}`,
    config_import_whitespace: (pos: string) => `Resource name cannot contain whitespace at ${pos}`,
    prepare_running: (name: string) => `[PRE] Running prepare script for '${name}'`,
    prepare_fail: (code: number) => `[PRE] Failed with error code ${code}`,
    import_resolveFail: (name: string) => `Failed to resolve ${name}, resource not exported`
} as const

export var state = {
    debug: false
}