# no5ix - how to build and how to install it to vsc

1. build: in the project root path, `pnpm run vsce:package`
2. install: open VS Code:
      1. Press `Cmd + Shift + P`.
      2. Select Extensions: Install from VSIX...
      3. Select branchshift-0.6.4.vsix.
      4. Reload VS Code.


<a name="readme-top"></a>

<div align="center">

<img src="https://raw.githubusercontent.com/VitalHex/branchshift/main/images/assets/logo-128.png" width="88" alt="BranchShift icon" />

<h1>BranchShift</h1>

**Switch editors, not your Git workflow.**

A JetBrains-style Git workflow for developers moving to **VS Code** or **Cursor**.

**English** · [简体中文](./README.zh_CN.md)

</div>

---

BranchShift keeps the Git habits you already know from JetBrains IDEs: a visual branch tree, compact commit graph, dedicated Commit tool window, Shelf and Stash, branch comparison, history rewriting, merge tools, and conflict resolution—without forcing you to relearn your workflow after changing editors.

> BranchShift is an independent open-source project and is not affiliated with or endorsed by JetBrains, Microsoft, GitHub, or Cursor.

> This project is a fork of [zhyc9de/jet-git](https://github.com/zhyc9de/jet-git). The original repository and its contributors remain credited under [Project lineage](#project-lineage).

## Familiar workflow, new editor

| JetBrains workflow | BranchShift in VS Code |
| --- | --- |
| Commit tool window | Dedicated Commit activity with partial commits, Amend, Commit & Push, Shelf, and Stash |
| Git Log | Branch tree, compact graph, refs, filters, changed files, and commit details |
| Compare with Current | Independent bidirectional comparison tabs with per-side filters |
| Branch actions | Checkout, Update, Push, Merge, Rebase, Rename, Delete, Favorite, and more |
| Merge conflicts | Conflict dashboard and syntax-highlighted 3-way merge editor |
| Multi-repository project | One active repository shared by Commit and Git Log across multi-root workspaces |

## Highlights

### Git Log and branch management

- Local branches, remotes, and tags in a searchable tree
- Favorites, ahead/behind indicators, and upstream-aware Update
- Color-coded commit graph with resizable and hideable columns
- Branch, author, date, and file-history filters
- Shared commit context actions across normal and comparison logs

### Commit, Shelf, and Stash

- Select individual files for partial commits
- Commit, Commit and Push, and Amend workflows
- Directory grouping, multi-selection, rollback, and diff navigation
- JetBrains-compatible Shelf data stored under `.idea/shelf/`
- Native Git stash management

### Branch comparison

Compare a local branch, remote branch, or tag with the current branch. BranchShift opens a dedicated editor tab with commits unique to each side, independent filters, changed files, and commit details.

### Context menus where you expect them

Right-click branches, commits, and changed files to access checkout, cherry-pick, reset, revert, merge, rebase, diff, history, source navigation, and other repository-bound actions.

### Conflicts and 3-way merge

- Dedicated conflict list with Accept Yours, Accept Theirs, and Merge actions
- Three-column Theirs / Result / Yours editor
- Per-conflict actions and syntax highlighting
- Integration with the built-in VS Code Source Control view

### Multi-root workspace support

BranchShift discovers one Git repository per workspace folder and exposes a shared active-repository selector in both Commit and Git Log. Nested repositories inside a single workspace folder are intentionally deferred to a later release.

## Installation

> Upgrading from a JetGit Plus development VSIX? Uninstall `strNewBee.jetgit-plus` first. BranchShift uses the extension ID `vitalhex.branchshift`, so VS Code treats it as a separate extension.

### VS Code Marketplace

Search for **BranchShift** or **Git** in the Extensions view.

### VSIX

1. Download the latest `.vsix` from [Releases](https://github.com/VitalHex/branchshift/releases).
2. Run **Extensions: Install from VSIX...** from the Command Palette.

## Requirements

- VS Code 1.85.0 or later
- Git available on `PATH`



## Local development

```bash
git clone https://github.com/VitalHex/branchshift.git
cd branchshift
pnpm install
cd webview && pnpm install && cd ..
```

Press **F5** to launch the Extension Development Host.

```bash
pnpm run watch          # Development watch mode
pnpm run build          # Extension host + webview production build
pnpm run vsce:package   # Build a VSIX package
```

## Project lineage

BranchShift began as a fork of [zhyc9de/jet-git](https://github.com/zhyc9de/jet-git) and retains the original project's Git graph and merge foundations. This fork has since added the JetBrains-style Commit/Shelf/Stash workflow, extensive context actions, branch comparison, multi-root repository support, and independent branding.

Some interface icons are derived from [IntelliJ Platform Icons](https://intellij-icons.jetbrains.design/) under the Apache 2.0 license. The BranchShift application icon is an original project asset.

## License

BranchShift remains available under the [MIT License](./LICENSE). Copyright and attribution notices are preserved in the license file and project history.
