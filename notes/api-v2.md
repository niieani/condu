```ts
import { type FileMapping, type PeerContext, defineFeature } from "condu";

// merge interface declarations
interface FileMapping {
  ".gitignore": string;
}

// merge interface declarations to extend the global PeerContext
// define the kind of peer context for this feature, which can be extended by other features
interface PeerContext {
  gitignore: {
    ignore: string[];
  };
}

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    initialPeerContext: { ignore },

    // 'after' can be used to define dependencies of this feature to determine the optimal order of execution,
    // or define "*" if you want to run execute the feature after all other non "*"-depending features have executed
    after: "*",

    // for every configured feature, we execute 'mergePeerContext' to collect
    // and "reduce" the final peer context first (in topological order, as per "after" dependencies)
    // note that peer context contributions might be asynchronous
    // most features won't even to use this (it's an optional property of the feature definition API)
    mergePeerContext: async (config) => ({
      // each feature can define its own peer context
      // and it can be extended by other features
      // e.g. another feature could add a 'gitignore' key to the peer context
      // which is then available in the 'apply' function
      gitignore: (gitIgnorePeerContext) => ({
        ignore: [...gitIgnorePeerContext.ignore, "something"],
      }),
    }),

    // after we have peer context, we we execute 'apply' for every configured feature (in topological order)
    // and any files that are created, modified, their dependencies added,
    // but by this point peer context cannot be extended anymore
    apply: (condu, peerContext) => {
      // condu.config is available here

      // subsequent calls overwrite the previous ones
      // and output a warning
      condu.root.createManagedFile(".gitignore", {
        content: (pkg) => `...` + peerContext.ignore.join("\n"),
        // stringify: (content) => content,
      });

      // modifies a file that was created by another feature
      // modifications are run only after all createManagedFile calls, in the same order as features
      // if the file wasn't created in another feature, it errors
      // think of it like middleware for the file creation
      condu.root.modifyManagedFile(".gitignore", {
        content: (content, pkg) => {
          return content + `...`;
        },
        ifNotCreated: "error", // default is "ignore", can also be "error" or "create" - in last case we might need stringify/parse or fallback?
        // no stringify here necessary, we're depending on the previous feature to do that (unless "create" is set)
      });

      // loads the file from fs, and modifies it
      // subsequent calls receive the content from the previous call
      condu.root.modifyUserEditableFile(".gitignore", {
        createIfNotExists: true, // default is true
        content: (content, pkg) => {
          return content + `...`;
        },
        // optional: (by default uses json-comment for .json files, and yaml for .yaml files)
        // parse: (fileBuffer) => content,
        // stringify: (content) => content,
      });

      condu.root.addManagedDevDependency("tsx");

      // target a specific workspace/package:
      // alternative names: 'matching', 'where'
      condu.with({ name: "xyz", kind: "package" }).addManagedDependency("abc");

      // only available in the root package
      condu.root.setDependencyResolutions({
        abc: "1.0.0",
      });

      // example usage of `mergePackageJson`
      condu.root.mergePackageJson((pkg) => ({
        scripts: {
          ...pkg.scripts,
          test: "jest",
        },
      }));

      // only update the release-prepared version of the package.json only:
      condu.with({ kind: "package" }).mergeReleasePackageJson((pkg) => ({
        scripts: {
          ...pkg.scripts,
          test: "jest",
        },
      }));

      // etc. other features and methods are available under the `condu` namespace
    },
  });
```

After configuring the features:

- we sort the features in topological order
- run their `mergePeerContext` to collect a final reducer of each peer context
- we execute the peer context reducers in topological order with `config` (`ConduConfigWithInferredValuesAndProject`)
- run their `apply` with both `config` and `peerContext` (scoped down to only this particular feature's `peerContext`)
  - `apply`'s function is to collects all the "changes to be made", i.e. `createManagedFile` and other methods only create a "change to be made" object with the correct context
- once collected, we create a reducer pipeline for creating/updating files from each of these changes. These pipelines are created from grouping all "changes to be made" based on their absolute filepath.
  - a final "content" reducer is created by combining all matching `createManagedFile` and `modifyManagedFile` (order must be respected)
  - similarly for `modifyUserEditableFile`
- finally, we can interface with the FS, parse, run content reducers, stringify and commit the changes to the file system

Notes: it's important to distinguish between managed files, and user-modifiable files:

- The managed kind is created and edited by condu
- The user-modifiable file can be created by the user (or by condu), but the user or other tools can modify that task manually. This can be useful for things like vscode settings, where we want individual end users to still be able to either override certain settings or add their own custom settings on top of the ones suggested by the repository configuration.

```ts
// maybe immutability-helper style?
condu.root.mergePackageJson({
  scripts: $merge({
    test: "jest",
  }),
  someField: $unset,
});

// version: auto-set from package.json? does it matter?

// condu.state?

// how can we ensure that this is not called asynchronously, or how do we allow async `apply`? force `apply` to be synchronous? or make it return another function
// from another feature. Alternative is to `await condu.getPeerContext()` and then throw if `mergePeerContext` is called with an error saying that `mergePeerContext` can only be called before `getPeerContext()`
// or we could yield? nah just returning a function (or undefined) is fine
```
