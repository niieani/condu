import { Command, Option } from "clipanion";
import { CONDU_CONFIG_FILE_NAME, CONFIG_DIR } from "@condu/types/constants.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import { createCommandContext } from "../createCommandContext.js";
import { ensureDependency } from "../ensureDependency.js";

export class InitCommand extends Command {
  static override paths = [["init"]];

  static override usage = Command.Usage({
    description:
      "Initialize a condu project in the current (or specified) directory.",
    details: `
      This command will create a default config file and add a postinstall script to your package.json.

      If you provide a name as a positional argument, it will create a new folder with that name, initialize a git repo inside, and run the initialization within that folder.
    `,
    examples: [
      ["Initialize condu in the current directory", "$0 init"],
      [
        'Initialize condu in a new directory called "my-project"',
        "$0 init my-project",
      ],
    ],
  });

  projectName = Option.String({ required: false });

  async execute() {
    const context = createCommandContext(this.context);

    const targetDirectory = this.projectName
      ? path.join(process.cwd(), this.projectName)
      : process.cwd();

    // Create the target directory if it doesn't exist
    try {
      await fs.access(targetDirectory);
    } catch {
      await fs.mkdir(targetDirectory, { recursive: true });
    }

    // Change to the target directory
    process.chdir(targetDirectory);

    context.log(`Initializing condu in ${targetDirectory}...`);

    // Create the config directory
    const configDirectory = path.join(targetDirectory, CONFIG_DIR);
    await fs.mkdir(configDirectory, { recursive: true });

    // Create the default config file
    const configFilePath = path.join(configDirectory, CONDU_CONFIG_FILE_NAME);
    await fs.writeFile(
      configFilePath,
      `import { configure } from 'condu';

export default configure({
  engine: 'node',
  features: [
    gitignore(),
    typescript(),
  ],
});
`,
    );

    // Read the package.json file
    const packageJsonPath = path.join(targetDirectory, "package.json");
    let packageJson: any;
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
      packageJson = JSON.parse(packageJsonContent);
    } catch {
      // If package.json doesn't exist, create a new one
      packageJson = {};
    }

    // Add the postinstall script
    packageJson.scripts ||= {};
    packageJson.scripts.postinstall = "test -f .config/condu.ts && condu apply";

    // Add the yarn plugin dependency
    await ensureDependency({
      packageAlias: "condu",
      manifest: packageJson,
      target: "devDependencies",
    });

    // Write the updated package.json file
    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, undefined, 2),
    );

    // Initialize git repository if project name is provided
    if (this.projectName) {
      const git = childProcess.spawnSync("git", ["init"], { stdio: "inherit" });
      if (git.status !== 0) {
        context.error(`git init failed with status code ${git.status}`);
      }
    }

    context.log("condu project initialized!");
  }
}
