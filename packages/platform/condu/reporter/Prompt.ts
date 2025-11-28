import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { PromptOptions } from "./types.js";

const BORDER_WIDTH = 69;
const TOP_BORDER = `┌${"─".repeat(BORDER_WIDTH)}┐`;
const BOTTOM_BORDER = `└${"─".repeat(BORDER_WIDTH)}┘`;

export async function prompt<T>(options: PromptOptions<T>): Promise<T> {
  if (!options.choices.length) {
    throw new Error("Prompt requires at least one choice");
  }

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      renderPrompt(options);
      const answer = await rl.question("  Your choice: ");
      const rawInput = (answer.trim() || options.defaultKey || "").trim();
      const normalized = rawInput.toLowerCase();

      const choice = options.choices.find(
        (item) => item.key.toLowerCase() === normalized,
      );

      if (choice) {
        return choice.value;
      }

      if (!normalized) {
        console.log("  Please enter a choice.");
      } else {
        console.log(`  Unknown option: ${answer.trim()}`);
      }
    }
  } finally {
    rl.close();
  }
}

function renderPrompt<T>({ message, detail, choices }: PromptOptions<T>): void {
  console.log("");
  console.log(TOP_BORDER);
  printWrapped(message);

  const detailLines = Array.isArray(detail)
    ? detail
    : detail
      ? [detail]
      : [];

  for (const line of detailLines) {
    printWrapped(line);
  }

  if (detailLines.length > 0) {
    printWrapped("");
  }

  printWrapped("Options:");
  for (const choice of choices) {
    printWrapped(`  [${choice.key}] ${choice.label}`);
  }
  console.log(BOTTOM_BORDER);
}

function printWrapped(content: string): void {
  if (!content) {
    console.log(formatLine(""));
    return;
  }
  let remaining = content;
  while (remaining.length > 0) {
    const segment = remaining.slice(0, BORDER_WIDTH);
    console.log(formatLine(segment));
    remaining = remaining.slice(BORDER_WIDTH);
  }
}

function formatLine(content: string): string {
  const truncated = content.length > BORDER_WIDTH
    ? content.slice(0, BORDER_WIDTH)
    : content;
  return `│${truncated.padEnd(BORDER_WIDTH, " ")}│`;
}
