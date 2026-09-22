import type { Writable } from "node:stream";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private frame = 0;
  private intervalId?: ReturnType<typeof setInterval>;
  private text = "";
  private isActive = false;

  private readonly output: Writable;
  constructor(output: Writable) {
    this.output = output;
  }

  start(text: string) {
    this.stop();
    this.text = text;
    this.isActive = true;

    this.intervalId = setInterval(() => {
      this.render();
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
    }, 80);
    this.intervalId.unref?.();
  }

  update(text: string) {
    this.text = text;
    this.render();
  }

  stop(finalText?: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.isActive) {
      this.output.write("\u001B[2K\r");
      if (finalText) this.output.write(`${finalText}\n`);
    }

    this.isActive = false;
  }

  private render() {
    if (!this.isActive) return;

    this.output.write("\u001B[2K\r");
    this.output.write(`${SPINNER_FRAMES[this.frame]} ${this.text}`);
  }
}
