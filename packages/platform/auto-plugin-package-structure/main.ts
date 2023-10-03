import type { Auto, IPlugin } from "@auto-it/core";

export default class PackageStructurePlugin implements IPlugin {
  name = "package-structure";

  /** Tap into auto plugin points. */
  apply(auto: Auto) {
    auto.hooks.beforeShipIt.tapPromise(this.name, async (d) => {
      d.dryRun;
    });
  }
}
