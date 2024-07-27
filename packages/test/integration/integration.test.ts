/// <reference types="bun-types" />

// eslint-disable-next-line import-x/no-unresolved
import { beforeAll, describe, test } from "bun:test";
import { runVerdaccio } from "./verdaccio.js";
import type { Application } from "express";

describe("integration", () => {
  let server: Application;
  beforeAll(async () => {
    server = await runVerdaccio();
  });

  test("should work", async () => {
    //
  });
});
