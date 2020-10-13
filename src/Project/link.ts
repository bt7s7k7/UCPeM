import chalk from "chalk";
import { symlinkSync } from "fs";
import { relative } from "path";
import { DependencyTracker } from "./DependencyTracker";

export function link(source: string, target: string) {
    const projectRoot = DependencyTracker.getRootProject().path

    console.log(`[${chalk.cyanBright("LINK")}] Linking ${relative(projectRoot, source)} → ${relative(projectRoot, target)}`);

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
