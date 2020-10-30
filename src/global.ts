import { homedir } from "os"
import { join } from "path"

export const PORT_FOLDER_NAME = "ucpem_ports"
export const CONFIG_FILE_NAME = "ucpem.js"
export const GITIGNORE_SECTION_BEGIN = "# UCPeM generated, write above to not be overwritten"
export const CURRENT_PATH = process.cwd()

export const LOCAL_PORTS_PATH = process.env.UCPEM_LOCAL_PORTS ?? join(homedir(), ".ucpem")

export var state = {
    debug: false
}