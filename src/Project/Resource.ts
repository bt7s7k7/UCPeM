import { statSync } from "fs";

export class Resource {

    constructor(
        public readonly id: string,
        public readonly path: string,
        public readonly dependencies: Readonly<string[]>,
        public readonly prepare: (() => void) | null
    ) {
        try {
            if (!statSync(path).isDirectory()) {
                throw new TypeError(`Resource path ${this.path} does not point to a directory`)
            }
        } catch (err) {
            if ("code" in err && err.code == "ENOENT") {
                throw new TypeError(`Resource path ${this.path} does not point to a directory, in fact the file does not exist`)
            } else {
                throw err
            }
        }
    }
}