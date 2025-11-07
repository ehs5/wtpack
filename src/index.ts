#!/usr/bin/env node
import chalk from "chalk";
import { spawnSync } from "node:child_process";
import fs from "fs";

/** A package and its state. When updated, it contains before and after versions. */
type PackageDiff = {
  name: string;
  beforeVer: string | undefined;
  afterVer: string | undefined;
  type: "installed" | "updated" | "removed" | "unchanged";
};

/** Reads package-lock.json and returns categorized top-level dependencies */
function readPackages(isBeforeInstall: boolean): {
  deps: Record<string, string>;
  devDeps: Record<string, string>;
} {
  if (!fs.existsSync("package-lock.json")) {
    if (isBeforeInstall) {
      console.log(chalk.gray("📦 No package-lock.json found."));
    }
    return { deps: {}, devDeps: {} };
  }

  const data = JSON.parse(fs.readFileSync("package-lock.json", "utf-8"));
  const root = data.packages?.[""] || {};
  const deps: Record<string, string> = root.dependencies || {};
  const devDeps: Record<string, string> = root.devDependencies || {};

  return { deps, devDeps };
}

/** Runs npm install. Outputs lines directly to the console */
function npmInstall(npmArgs: string[]): void {
  console.log(chalk.bold.white("npm install " + npmArgs.join(" ")));

  // Figure out which command to use open npm. Windows must use npm.cmd instead of npm.
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  // Run npm install, followed by all arguments passed to wtpack.
  const result = spawnSync(npmCommand, ["install", ...npmArgs], {
    stdio: "inherit",
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    console.error(
      chalk.bgRed.white.bold(" ERR "),
      chalk.red("npm install failed\n"),
      chalk.gray(result.stderr?.toString().trim())
    );
    process.exit(1);
  }
}

/** Prints the wtpack header */
function showHeader(): void {
  const border = chalk.dim("─".repeat(40));
  const title =
    chalk.bold.blueBright("  wtpack  ") + chalk.gray(" What the Pack?");
  console.log(border);
  console.log(title);
  console.log(border);
}

/** Collects package differences without formatting */
function collectPackageDiffs(
  before: Record<string, string>,
  after: Record<string, string>
): PackageDiff[] {
  const diffs: PackageDiff[] = [];
  const allPackageNames = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]);

  for (const name of allPackageNames) {
    const beforeVer: string | undefined = before[name];
    const afterVer: string | undefined = after[name];

    if (!beforeVer && afterVer) {
      diffs.push({ name, beforeVer, afterVer, type: "installed" });
    } else if (beforeVer && !afterVer) {
      diffs.push({ name, beforeVer, afterVer, type: "removed" });
    } else if (beforeVer !== afterVer) {
      diffs.push({ name, beforeVer, afterVer, type: "updated" });
    } else {
      diffs.push({ name, beforeVer, afterVer, type: "unchanged" });
    }
  }

  return diffs;
}

/**
 * Formats package diffs with padding
 * "pad" is the number of spaces to pad to the right of the package name.
 */
function formatPackageDiffs(
  diffs: PackageDiff[],
  pad: number
): {
  installed: string[];
  removed: string[];
  updated: string[];
  unchanged: string[];
} {
  const installed: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  for (const diff of diffs) {
    if (diff.type === "installed") {
      installed.push(
        `${chalk.white(diff.name.padEnd(pad))}${chalk.green(diff.afterVer!)}`
      );
    } else if (diff.type === "removed") {
      removed.push(
        `${chalk.white(diff.name.padEnd(pad))}${chalk.red(diff.beforeVer!)}`
      );
    } else if (diff.type === "updated") {
      updated.push(
        `${chalk.white(diff.name.padEnd(pad))}${chalk.gray(
          diff.beforeVer!
        )} ${chalk.dim(" → ")} ${chalk.yellow(diff.afterVer!)}`
      );
    } else {
      unchanged.push(
        `${chalk.dim(diff.name.padEnd(pad))}${chalk.dim(diff.beforeVer!)}`
      );
    }
  }

  return { installed, removed, updated, unchanged };
}

/** Comparison helper */
function diffMap(
  before: Record<string, string>,
  after: Record<string, string>,
  namePad: number
): {
  installed: string[];
  removed: string[];
  updated: string[];
  unchanged: string[];
  displayedNames: string[];
} {
  const diffs = collectPackageDiffs(before, after);
  const formatted = formatPackageDiffs(diffs, namePad);
  const displayedNames = diffs
    .filter((d) => d.type !== "unchanged")
    .map((d) => d.name);

  return { ...formatted, displayedNames };
}

/** Helper to format a category of dependencies */
function formatCategoryList(label: string, items: string[]): string {
  if (!items.length) return "";

  return (
    chalk.gray(`     ${label}:\n`) +
    items.map((item) => `       ${item}`).join("\n") +
    "\n"
  );
}

/** Returns a section string to output to console. */
function createSection(
  title: string,
  color: (s: string) => string,
  deps: string[],
  devDeps: string[]
): string {
  if (deps.length === 0 && devDeps.length === 0) return "";

  let out = `  ${color(title)}\n`;

  if (deps.length > 0) {
    out += formatCategoryList("dependencies", deps);
  }

  if (devDeps.length > 0) {
    out += formatCategoryList("devDependencies", devDeps);
  }

  return out;
}

/** Compares dependencies and devDependencies and prints a summary */
function comparePackages(
  before: { deps: Record<string, string>; devDeps: Record<string, string> },
  after: { deps: Record<string, string>; devDeps: Record<string, string> }
): void {
  const border = chalk.dim("─".repeat(40));
  console.log(border);
  console.log(chalk.bold.blueBright("  wtpack  ") + chalk.gray(" Summary"));

  // Collect package diffs once
  const depDiffs = collectPackageDiffs(before.deps, after.deps);
  const devDepDiffs = collectPackageDiffs(before.devDeps, after.devDeps);

  // Get all the package names we actually display
  const displayedPackageNames: string[] = [
    ...depDiffs.filter((d) => d.type !== "unchanged").map((d) => d.name),
    ...devDepDiffs.filter((d) => d.type !== "unchanged").map((d) => d.name),
  ];

  // Calculate padding for package names based on the longest displayed name
  const namePad: number =
    displayedPackageNames.length > 0
      ? Math.max(...displayedPackageNames.map((n) => n.length), 0) + 2
      : 2;

  // Format with correct padding
  const depDiff = formatPackageDiffs(depDiffs, namePad);
  const devDepDiff = formatPackageDiffs(devDepDiffs, namePad);

  /** Make sections for installed, updated, removed and unchanged */
  const sectionInstalled: string = createSection(
    "🟢 Installed",
    chalk.green,
    depDiff.installed,
    devDepDiff.installed
  );

  const sectionUpdated: string = createSection(
    "🟡 Updated",
    chalk.yellow,
    depDiff.updated,
    devDepDiff.updated
  );

  const sectionRemoved: string = createSection(
    "🔴 Removed",
    chalk.red,
    depDiff.removed,
    devDepDiff.removed
  );

  const sectionUnchanged: string = createSection(
    "⚪ Unchanged",
    chalk.gray,
    depDiff.unchanged,
    devDepDiff.unchanged
  );

  const sectionOutput = [
    sectionInstalled,
    sectionUpdated,
    sectionRemoved,
    //sectionUnchanged, // We're not printing non-changed packages. Might introduce it later or make a flag for it later
  ]
    .filter(Boolean) // Filters out empty sections
    .join("\n");

  if (sectionOutput) {
    console.log("\n" + sectionOutput);
  }

  if (
    sectionUnchanged &&
    !sectionInstalled &&
    !sectionRemoved &&
    !sectionUpdated
  ) {
    console.log(chalk.blueBright("\n    📦 No packages were changed"));
  }

  console.log(border + "\n");
}

/** Prints a category of packages. A category being dependencies or devDependencies. */
function printCategory(category: string, deps: Record<string, string>) {
  const packageNames: string[] = Object.keys(deps);
  if (packageNames.length === 0) return;

  console.log("  " + chalk.gray(`${category}:`));

  for (const [name, version] of Object.entries(deps)) {
    console.log("    " + chalk.green(`${name}@${version}`));
  }

  console.log();
}

/** Displays all current packages */
function showPackages(
  pkg: { deps: Record<string, string>; devDeps: Record<string, string> },
  isBeforeInstall: boolean
) {
  const border = chalk.dim("─".repeat(40));
  const label: string = isBeforeInstall
    ? "Packages BEFORE install"
    : "Packages AFTER install";

  if (!isBeforeInstall) console.log(border);
  console.log(chalk.bold.blueBright(`📦 ${label}\n`));

  const hasDeps = Object.keys(pkg.deps).length > 0;
  const hasDevDeps = Object.keys(pkg.devDeps).length > 0;

  if (!hasDeps && !hasDevDeps) {
    console.log(chalk.gray("📦 No packages found"));
  } else {
    if (hasDeps) printCategory("dependencies", pkg.deps);
    if (hasDevDeps) printCategory("devDependencies", pkg.devDeps);
  }

  if (isBeforeInstall) console.log(border + "\n");
}

/**
 * We accept any parameters and pass them on to npm install.
 * Exception being any flags that start with --wtpack-.
 */
function parseArgs(): { npmArgs: string[]; wtpackFlags: string[] } {
  // The first two arguments are paths to node + this file, so we remove them.
  let allArgs: string[] = process.argv.slice(2);

  // If provided, filter out install argument since we're gonna do "npm install" anyways.
  // We don't have to do this, but it looks nicer.
  const installArgs = ["install", "i", "add"];
  allArgs = allArgs.filter((arg) => !installArgs.includes(arg));

  const npmArgs: string[] = [];
  const wtpackFlags: string[] = [];

  for (const a of allArgs) {
    if (a.startsWith("--wtpack-")) {
      const flag: string = a.replace("--wtpack-", "");
      wtpackFlags.push(flag);
    } else {
      npmArgs.push(a);
    }
  }

  return { npmArgs, wtpackFlags };
}

function main() {
  const { npmArgs, wtpackFlags } = parseArgs();
  const flagShow: boolean = wtpackFlags.includes("show");

  showHeader();

  const before = readPackages(true);
  if (flagShow) showPackages(before, true);

  npmInstall(npmArgs);

  const after = readPackages(false);
  if (flagShow) showPackages(after, false);

  comparePackages(before, after);
}

main();
