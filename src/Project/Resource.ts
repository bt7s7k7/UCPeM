export class Resource {

    constructor(
        public readonly id: string,
        public readonly dependencies: Readonly<string[]>,
        public readonly prepare: (() => void) | null
    ) { }
}