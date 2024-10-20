```ts
import { FileMapping, PeerContext } from "condu";

// merge in the interface
interface FileMapping {
  ".gitignore": string;
}

// define what kind of peer context can be extended
interface PeerContext {
  gitignore: {
    ignore: string[];
  };
}

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    initialPeerContext: { ignore },
    // version: auto-set from package.json? does it matter?

    // 'after' can be used to define dependencies of this feature to determine the optimal order of execution,
    // or define "*" if you want to run execute the feature after all other non "*"-depending features have executed
    after: "*",
    // for every feature defined, we execute 'apply' to collect the merged peer context first,
    // and any files that are created, modified, dependencies added, etc. that don't require the peer context
    // finally we run the return function of apply with the peer context
    // and continue collecting the files, dependencies, etc. that do require the peer context
    // but at this point peer context it is not possible to extend the peer context anymore
    apply: (condu) => {
      // condu.config is available here

      // from another feature, you might call `condu.mergePeerContext`
      // note that peer context contributions might be asynchronous, that's why we need the two-stage `apply`. but most features won't even need to use peer context, in which case they can just return undefined instead of a 2nd stage apply function
      condu.mergePeerContext(
        "gitignore",
        (peerContext) => ({
          ignore: [...peerContext.ignore, "something"],
        }),
        // optionally change order for peer context merging?
        { after: ["someOtherFeature"] },
      );

      // alternative:
      condu.mergePeerContext(
        {
          gitignore: (peerContext) => ({
            ignore: [...peerContext.ignore, "something"],
          }),
        },
        // optionally change order for peer context merging?
        { after: ["someOtherFeature"] },
      );

      // this would be called after all features execute the first stage of `apply` first
      return (peerContext) => {
        // all peer context is available here, since all features have run `apply`
        // running `condu.mergePeerContext(...)` throws in here
        // but you now have the peerContext applied

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
        condu
          .with({ name: "xyz", kind: "package" })
          .addManagedDependency("abc");

        // only available in the root package
        condu.root.setDependencyResolutions({
          abc: "1.0.0",
        });

        condu.root.mergePackageJson((pkg) => ({
          scripts: {
            ...pkg.scripts,
            test: "jest",
          },
        }));

        // or maybe immutability-helper style?
        condu.root.mergePackageJson({
          scripts: $merge({
            test: "jest",
          }),
          someField: $unset,
        });

        // update the release-prepared version of the package.json only:
        condu.with({ kind: "package" }).mergeReleasePackageJson({
          scripts: $merge({
            test: "jest",
          }),
          someField: $unset,
        });
      };
    },
  });

// after defining many features, and running their apply, then apply result functions - which collects all the "changes to be made", we create a pipeline for creating/updating files:
// - createManagedFile (all)
// - modifyUserEditableFile (all)
// - modifyManagedFile (all)
// and only then we commit the changes to the file system

// it's important to distinguish between managed files, and user-modifiable files.
// the managed kind is created and edited by condu
// the user-modifiable file can be created by the user (or by condu)
// but the user or other tools can modify that task manually
// this can be useful for things like vscode settings, where we want individual end users to still be able to either override certain settings or add their own custom settings on top of the ones suggested by the repository configuration
```

```
// condu.state?

// how can we ensure that this is not called asynchronously, or how do we allow async `apply`? force `apply` to be synchronous? or make it return another function
// from another feature. Alternative is to `await condu.getPeerContext()` and then throw if `mergePeerContext` is called with an error saying that `mergePeerContext` can only be called before `getPeerContext()`
// or we could yield? nah just returning a function (or undefined) is fine

```
