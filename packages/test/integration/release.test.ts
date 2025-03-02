import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { runVerdaccio } from "./verdaccio.js";

describe("release command integration", () => {
  let verdaccio: Awaited<ReturnType<typeof runVerdaccio>>;
  beforeAll(async () => {
    verdaccio = await runVerdaccio({ port: 4000 });
  });
  afterAll(async () => {
    await verdaccio.close();
  });

  test("should release the repo to NPM", async () => {
    const res = await fetch("http://localhost:4000");
    expect(res.status).toBe(200);
    // TODO: actual test that creates a condu fixture project with localhost:4000 as its NPM server,
    // builds it, and releases it
  });
});
