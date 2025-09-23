import { homedir } from "os"
import { join } from "path"

export const PORT_FOLDER_NAME = "ucpem_ports"
export const CONFIG_FILE_NAME = "ucpem.js"
export const TS_CONFIG_FILE_NAME = "ucpem.ts"
export const GITIGNORE_SECTION_BEGIN = "# UCPeM generated, write above to not be overwritten"
export const CURRENT_PATH = process.cwd()
export const RUN_SCRIPT_CACHE = ".run"
export const SCRIPT_RES_PREFIX = "<SCRIPT>"

export const LOCAL_PORTS_PATH = process.env.UCPEM_LOCAL_PORTS ?? join(homedir(), ".ucpem")

export var state = {
    debug: false,
    compact: false,
    quiet: false
}
