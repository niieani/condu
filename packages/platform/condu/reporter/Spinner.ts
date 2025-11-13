const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private frame = 0;
  private intervalId?: ReturnType<typeof setInterval>;
  private text = "";
  private isActive = false;

  start(text: string) {
    this.text = text;
    this.isActive = true;

    if (process.stdout.isTTY) {
      this.intervalId = setInterval(() => {
        this.render();
        this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      }, 80);
    } else {
      // Non-TTY: just print once
      process.stdout.write(`${text}...\n`);
    }
  }

  update(text: string) {
    this.text = text;
    if (process.stdout.isTTY) {
      this.render();
    }
  }

  stop(finalText?: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      if (finalText) {
        process.stdout.write(`${finalText}\n`);
      }
    }

    this.isActive = false;
  }

  private render() {
    if (!process.stdout.isTTY || !this.isActive) return;

    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${SPINNER_FRAMES[this.frame]} ${this.text}`);
  }
}
