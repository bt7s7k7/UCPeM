export function resolveGitHubUrl(repo: string) {
    if (process.env.UCPEM_SSH_CLONE) {
        return `git@github.com:${repo}.git`
    } else {
        return `https://github.com/${repo}.git`
    }
}
