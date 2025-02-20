import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { GITIGNORE_SECTION_BEGIN } from "../global"

export const GitIgnoreGenerator = new class GitIgnoreGenerator {
    protected generatedFiles = {} as Record<string, Set<string>>

    public addIgnore(path: string, name: string) {
        this.generatedFiles[path] = this.generatedFiles[path]?.add(name) ?? new Set([name])
    }

    public generateIgnores() {
        Object.entries(this.generatedFiles).forEach(([path, files]) => {
            const filesSorted = [...files].sort()

            const ignoreFiles = [
                GITIGNORE_SECTION_BEGIN,
                ...filesSorted.map(v => "/" + v)
            ]

            const gitignorePath = join(path, ".gitignore")

            /** Text of the current gitignore */
            let gitignoreText = ""
            try {
                gitignoreText = readFileSync(gitignorePath).toString()
            } catch (err: any) {
                if (err.code != "ENOENT") throw err
            }
            /** Index of the start of our generated text */
            //                                                                  ↓ Subtract one to include the newline we put before our text 
            const ourTextStart = gitignoreText.indexOf(GITIGNORE_SECTION_BEGIN) - 1
            /** Text of the gitignore we didn't generate (user set), save it to put it in the new gitignore */
            //                   ↓ Test if we even found our text, because if not we don't need to slice it out
            const gitignorePre = ourTextStart == -2 ? gitignoreText : gitignoreText.slice(0, ourTextStart)
            /** New gitignore text */
            const gitignoreOutput = gitignorePre + "\n" + ignoreFiles.join("\n") + "\n"
            // Write the new text to the gitignore
            writeFileSync(gitignorePath, gitignoreOutput)
        })
    }
}()
