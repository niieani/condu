import { afterAll, beforeAll, describe, test } from "vitest";
import { runVerdaccio } from "./verdaccio.js";

describe("integration", () => {
  let verdaccio: Awaited<ReturnType<typeof runVerdaccio>>;
  beforeAll(async () => {
    verdaccio = await runVerdaccio();
  });
  afterAll(async () => {
    await verdaccio.close();
  });

  test("should work", async () => {
    const res = await fetch("http://localhost:4000");
  });
});
