import { loadRepoProject } from "@condu/cli/loadProject.js";
import path from "node:path";

const __dirname = new URL(".", import.meta.url).pathname;

async function createOverrides({
  relativeToDir,
  protocol = "file:",
}: {
  relativeToDir: string;
  protocol?: string;
}) {
  const project = await loadRepoProject({
    startDir: path.resolve(__dirname, ".."),
  });
  if (!project) {
    throw new Error("Could not find project");
  }
  const packages = await project.getWorkspacePackages();
  const overrideList = packages.map(({ dir, manifest }) => [
    manifest.name,
    `${protocol}${path.relative(
      relativeToDir,
      path.join(project.projectDir, "build", dir),
    )}`,
  ]);
  return Object.fromEntries(overrideList);
}

const overrides = await createOverrides({
  relativeToDir: path.join(__dirname, "example-repo"),
});

console.log(overrides);
