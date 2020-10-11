import { basename, extname } from "path"

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