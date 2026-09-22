import { PassThrough } from "node:stream";
import { afterEach, expect, test, vi } from "vitest";
import { ConduReporter } from "./ConduReporter.js";

function capture() {
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  return { output, text: () => text };
}

afterEach(() => vi.useRealTimers());

test("independent runs own their progress and output", () => {
  const first = capture();
  const second = capture();
  const reporterA = new ConduReporter({
    mode: "local",
    supportsColor: false,
    output: first.output,
  });
  const reporterB = new ConduReporter({
    mode: "local",
    supportsColor: false,
    output: second.output,
  });
  reporterA.startFeature("first-feature", { index: 0, total: 1 });
  reporterB.startFeature("second-feature", { index: 0, total: 1 });
  reporterA.renderFeatureList();
  reporterB.renderFeatureList();
  expect(first.text()).toContain("first-feature");
  expect(first.text()).not.toContain("second-feature");
  expect(second.text()).toContain("second-feature");
  expect(second.text()).not.toContain("first-feature");
});

test("diffs use the run output", () => {
  const captured = capture();
  using reporter = new ConduReporter({
    mode: "quiet",
    supportsColor: false,
    output: captured.output,
  });
  reporter.printDiff("previous-content", "desired-content");
  expect(captured.text()).toContain("previous-content");
  expect(captured.text()).toContain("desired-content");
  expect(captured.text()).not.toContain("\u001B");
});

test("disposing a failed run stops its spinner", () => {
  vi.useFakeTimers();
  const captured = capture();
  expect(() => {
    using reporter = new ConduReporter({
      mode: "quiet",
      supportsColor: false,
      isInteractiveTTY: true,
      output: captured.output,
    });
    reporter.startPhase("loading");
    vi.advanceTimersByTime(100);
    throw new Error("recipe failed");
  }).toThrow("recipe failed");
  const atFailure = captured.text();
  vi.advanceTimersByTime(500);
  expect(captured.text()).toBe(atFailure);
  expect(vi.getTimerCount()).toBe(0);
});

test("interactive prompts use the run input and output", async () => {
  const captured = capture();
  const input = new PassThrough();
  using reporter = new ConduReporter({
    mode: "local",
    isInteractiveTTY: true,
    supportsColor: false,
    input,
    output: captured.output,
  });
  const answer = reporter.prompt({
    message: "Choose this run's action",
    choices: [{ key: "s", label: "Skip", value: "skip" }],
  });
  input.write("s\n");
  await expect(answer).resolves.toBe("skip");
  expect(captured.text()).toContain("Choose this run's action");
  input.destroy();
});

test("postinstall never prompts even with a terminal", () => {
  vi.stubEnv("npm_lifecycle_event", "postinstall");
  try {
    using reporter = new ConduReporter({
      mode: "local",
      isInteractiveTTY: true,
    });
    expect(reporter.isInteractive()).toBe(false);
  } finally {
    vi.unstubAllEnvs();
  }
});

test("redirected input cannot prompt on a terminal output", () => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
  });
  try {
    using reporter = new ConduReporter({
      mode: "local",
      input: new PassThrough(),
    });
    expect(reporter.isInteractive()).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
    else Reflect.deleteProperty(process.stdout, "isTTY");
  }
});

test("aggregate failures retain their causes in run output", () => {
  const captured = capture();
  using reporter = new ConduReporter({
    mode: "ci",
    supportsColor: false,
    output: captured.output,
  });
  reporter.error(
    "Apply failed",
    new AggregateError(
      [
        new Error("Recipe could not generate configuration"),
        new AggregateError(
          [new Error("EISDIR: output is a directory")],
          "File failure",
        ),
      ],
      "Failed to apply managed files",
    ),
  );
  expect(captured.text()).toContain("Recipe could not generate configuration");
  expect(captured.text()).toContain("EISDIR: output is a directory");
});
