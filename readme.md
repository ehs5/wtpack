# 📦️ wtpack - What the Pack?

[![npm](https://img.shields.io/npm/v/wtpack.svg)](https://www.npmjs.com/package/wtpack)

wtpack is a CLI tool that enhances `npm install` by showing you which packages were installed, updated, or removed. It clearly highlights version changes for each package.

> It works by comparing `package-lock.json` before and after `npm install` runs. It shows direct dependencies and devDependencies.

## Installation

```bash
npm install -g wtpack
```

## Usage

Use `wtpack` just like you would use `npm install`. All arguments are passed on to `npm install`.

```bash
wtpack
wtpack lodash
wtpack install vue
wtpack --save-dev typescript
wtpack hono@latest
```

These commands are equivalent to:

```bash
npm install
npm install lodash
npm install vue
npm install --save-dev typescript
npm install hono@latest
```

After running `npm install`, wtpack displays a summary showing:

- 🟢 **Installed** - Packages that were installed
- 🟡 **Updated** - Packages that were updated (with old → new version)
- 🔴 **Removed** - Packages that were removed

## Options

### Show packages before/after

Use the `--wtpack-show` flag to see all packages before and after the install:

```bash
wtpack --wtpack-show
```

## Author

Created by [Espen Steen](https://steen.cc) ([@ehs5](https://github.com/ehs5))

## License

MIT
