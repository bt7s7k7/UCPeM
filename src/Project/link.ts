import chalk from "chalk";
import { symlinkSync } from "fs";
import { relative } from "path";
import { DependencyTracker } from "./DependencyTracker";

export function link(source: string, target: string, sourceGlobal = false, targetGlobal = false) {
    const projectRoot = DependencyTracker.getRootProject().path;
    const sourcePath = sourceGlobal ? source : "./" + relative(projectRoot, source)
    const targetPath = targetGlobal ? target : "./" + relative(projectRoot, target)

    console.log(`[${chalk.cyanBright("LINK")}] Linking ${sourcePath} → ${targetPath}`);

    try {
        symlinkSync(source, target, "junction");
    } catch (err) {
        if (err.code == "EEXIST") {
            console.log(`    └─ File already exists`);
        } else {
            throw err;
        }
    }
}
