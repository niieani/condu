import { $ as $$, spinner } from "zx";
import { Configuration, Project, ResolveOptions } from "@yarnpkg/core";
import { npath, ppath, xfs } from "@yarnpkg/fslib";
import { getPluginConfiguration } from "@yarnpkg/cli";
import { suggestUtils } from "@yarnpkg/plugin-essentials";
import {
  structUtils,
  ThrowReport,
  miscUtils,
  semverUtils,
} from "@yarnpkg/core";
import semver from "semver";

// wrapper that makes the io 'inherit' by default
const $ = (pieces: TemplateStringsArray, ...args: unknown[]) =>
  $$(pieces, ...args).stdio("inherit", "inherit", "inherit");

async function setup() {
  await $`yarn config set nodeLinker node-modules`;
}

// await $`yarn`;
// await spinner("waiting", () => $`sleep 5`);

const startingPath = ppath.cwd();
const pluginConfiguration = getPluginConfiguration();
const yarnConfig = await Configuration.find(startingPath, pluginConfiguration);
const yarnProjectInfo = await Project.find(yarnConfig, startingPath);

await addDependency({ package: "lodash" }, yarnConfig, yarnProjectInfo.project);
await $`echo done`;

async function addDependency(
  {
    namespace: packageNamespace = null,
    package: packageName,
    versionOrTag = "latest",
  }: { namespace?: string | null; package: string; versionOrTag?: string },
  yarnConfig: Configuration,
  yarnProject: Project,
) {
  const resolver = yarnConfig.makeResolver();
  const resolveOptions: ResolveOptions = {
    project: yarnProject,
    resolver,
    report: new ThrowReport(),
  };

  const ident = structUtils.makeIdent(packageNamespace, packageName);
  const descriptor = structUtils.makeDescriptor(ident, versionOrTag);
  let range = structUtils.parseRange(descriptor.range).selector;

  // If the range is a tag, we have to resolve it into a semver version
  if (!semverUtils.validRange(range)) {
    const normalizedDescriptor = yarnConfig.normalizeDependency(descriptor);
    const originalCandidates = await resolver.getCandidates(
      normalizedDescriptor,
      {},
      resolveOptions,
    );

    range = structUtils.parseRange(originalCandidates[0].reference).selector;
  }

  const semverRange = semver.coerce(range);
  if (semverRange === null) {
    throw new Error(`Invalid semver range for ${packageName}`);
  }
  const coercedRange = `${suggestUtils.Modifier.CARET}${semverRange!.major}`;
  const finalDescriptor = structUtils.makeDescriptor(
    structUtils.makeIdent(packageNamespace, packageName),
    coercedRange,
  );

  yarnProject.workspaces[0].manifest.dependencies.set(
    ident.identHash,
    finalDescriptor,
  );

  await yarnProject.workspaces[0].persistManifest();
}
