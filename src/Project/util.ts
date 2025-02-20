import { basename, extname } from "path"
import { URL } from "url"

const ID_DELIM = "!"

export function makeResourceID(portName: string, resourceName: string) {
    return portName + ID_DELIM + resourceName
}

export function parseResourceID(id: string) {
    const [portName, resourceName] = id.split(ID_DELIM)

    return { portName, resourceName }
}

export function parseNameFromPath(path: string) {
    const extension = extname(path)
    const name = basename(path, extension)
    return name
}

export function processClonePath(path: string) {
    if (process.env.UCPEM_TOKEN) {
        try {
            const url = new URL(path)
            url.username = process.env.UCPEM_TOKEN
            path = url.href
        } catch (err: any) {
            if (err.code != "ERR_INVALID_URL") throw err
        }
    }

    return path
}
