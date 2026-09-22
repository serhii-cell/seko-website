# Seko website

The Seko website, built with [Astro](https://astro.build) on
[Lumos for Astro](https://lumosframework.com) 0.0.3.

## Run it locally

Node 22.12 or newer is required.

```sh
npm install
npm run dev
```

| Script            | What it does                      |
| ----------------- | --------------------------------- |
| `npm run dev`     | Starts the dev server             |
| `npm run build`   | Builds the site to `dist/`        |
| `npm run preview` | Serves the built site             |
| `npm run check`   | Type-checks every `.astro` file   |
| `npm run format`  | Formats the project with Prettier |

Read [LUMOS.md](LUMOS.md) before adding pages, components or styles, and
[MOTION.md](MOTION.md) before adding scripts, animation, page transitions or
Osmo resources. The component reference and guides are at
[lumosframework.com](https://lumosframework.com).

## Branches

| Branch      | Holds                                                   |
| ----------- | ------------------------------------------------------- |
| `main`      | The live site. It only changes by merging `develop` in. |
| `develop`   | Finished work waiting for the next release.             |
| `feature/*` | One piece of work each, branched off `develop`.         |

Start new work from an up-to-date `develop`:

```sh
git switch develop
git pull
git switch -c feature/home-hero
```

Commit as you go, then push the branch and open a pull request into `develop`:

```sh
git push -u origin feature/home-hero
gh pr create --base develop
```

To release, open a pull request from `develop` into `main`:

```sh
gh pr create --base main --head develop --title "Release"
```

## GitHub account

The repository belongs to [serhii-cell](https://github.com/serhii-cell), and
commits are authored as `Serhii Shepel <serhii@seko.design>`.

On a machine signed in to several GitHub accounts, pin the clone to
serhii-cell in its local git config. Switching the active `gh` account for
other projects then doesn't change who commits or pushes here:

```sh
git config user.name "Serhii Shepel"
git config user.email "serhii@seko.design"
git config credential.https://github.com.helper ""
git config --add credential.https://github.com.helper '!f() { test "$1" = get || return 0; t=$(gh auth token --hostname github.com --user serhii-cell) || return 0; echo username=serhii-cell; echo "password=$t"; }; f'
```

`gh` commands such as `gh pr create` still use whichever account is active, so
run `gh auth switch --user serhii-cell` first if another one is.

## Upgrading Lumos

Run `/lumos-upgrade-version` in Claude Code, or follow
[its steps](.claude/skills/lumos-upgrade-version/SKILL.md) by hand. It needs a
clean working tree, so do it on its own branch off `develop`.

## License

[LICENSE](LICENSE) is Lumos for Astro's MIT license, which covers the framework
code this site is built from.
