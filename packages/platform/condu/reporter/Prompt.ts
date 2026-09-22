import readline from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import type { PromptOptions } from "./types.js";

const BORDER_WIDTH = 69;
const TOP_BORDER = `┌${"─".repeat(BORDER_WIDTH)}┐`;
const BOTTOM_BORDER = `└${"─".repeat(BORDER_WIDTH)}┘`;

export async function prompt<T>(
  options: PromptOptions<T>,
  { input, output }: { input: Readable; output: Writable },
): Promise<T> {
  if (!options.choices.length) {
    throw new Error("Prompt requires at least one choice");
  }

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      renderPrompt(options, output);
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
        output.write("  Please enter a choice.\n");
      } else {
        output.write(`  Unknown option: ${answer.trim()}\n`);
      }
    }
  } finally {
    rl.close();
  }
}

function renderPrompt<T>(
  { message, detail, choices }: PromptOptions<T>,
  output: Writable,
): void {
  const print = (text: string) => output.write(`${text}\n`);
  const printWrapped = (text: string) => writeWrapped(text, output);
  print("");
  print(TOP_BORDER);
  printWrapped(message);

  const detailLines = Array.isArray(detail) ? detail : detail ? [detail] : [];

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
  print(BOTTOM_BORDER);
}

function writeWrapped(content: string, output: Writable): void {
  const print = (text: string) => output.write(`${text}\n`);
  if (!content) {
    print(formatLine(""));
    return;
  }
  let remaining = content;
  while (remaining.length > 0) {
    const segment = remaining.slice(0, BORDER_WIDTH);
    print(formatLine(segment));
    remaining = remaining.slice(BORDER_WIDTH);
  }
}

function formatLine(content: string): string {
  const truncated =
    content.length > BORDER_WIDTH ? content.slice(0, BORDER_WIDTH) : content;
  return `│${truncated.padEnd(BORDER_WIDTH, " ")}│`;
}
