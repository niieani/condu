import { describe, expect, test } from "vitest";
import { GitIgnore } from "./gitignore-matcher.js";

describe("GitIgnore Parser and Tester", () => {
  describe("Basic Wildcard Patterns", () => {
    const gitignoreContent = `
*.log
*.txt
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["error.log", false],
      ["debug.log", false],
      ["readme.txt", false],
      ["src/app.js", true],
      ["notes.md", true],
      ["app.LOG", true], // Case-sensitive match
      ["doc/readme.TXT", true],
    ])('should correctly accept or deny "%s"', (path, expected) => {
      expect(gitignore.isAccepted(path)).toBe(expected);
    });
  });

  describe("Negated Patterns", () => {
    const gitignoreContent = `
*.log
logs/
!important.log
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["error.log", false],
      ["debug.log", false],
      ["important.log", true],
      ["logs/important.log", false], // Cannot re-include in ignored directory
      ["readme.md", true],
    ])(
      'should correctly accept or deny "%s" with negation',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Escaped Characters", () => {
    const gitignoreContent = `
\\#secret.txt
file\\ name.txt
!\\!important!.txt
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["#secret.txt", false],
      ["secret.txt", true],
      ["file name.txt", false],
      ["filename.txt", true],
      ["!important!.txt", true],
      ["important!.txt", true],
      ["\\#secret.txt", true],
      ["file\\ name.txt", true],
    ])(
      'should correctly handle escaped characters for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Directory-Specific Patterns", () => {
    const gitignoreContent = `
logs/
temp/
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["logs/", false],
      ["logs/app.log", false],
      ["temp/", false],
      ["temp/data.tmp", false],
      ["src/logs", true],
      ["src/logs/", false],
      ["dir/logs/", false],
      ["build/temp/file.txt", false],
      ["src/app.js", true],
      ["logs", true], // 'logs' as a file should be accepted
      ["temp", true], // 'temp' as a file should be accepted
    ])(
      'should correctly accept or deny directory-specific patterns for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Patterns with Multiple Wildcards", () => {
    const gitignoreContent = `
foo/**/bar
yo/**la/bin
foo/**/rec**on
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["foo/bar/", false],
      ["notfoo/bar/", true],
      ["foo/baz/bar", false],
      ["notfoo/baz/bar", true],
      ["foo/baz/notbar", true],
      ["foo/baz/qux/bar", false],
      ["yo/xyzla/bin/", false],
      ["yo/abcxyzla/bin/", false],
      ["foo/reconnection", false],
      ["foo/recursiveconnection", false],
      ["foo/recursion", false],
      ["foo/anything/recursion", false],
      ["notfoo/anything/recursion", true],
      ["foo/bar/baz", false],
      ["yo/la/bin/", false],
      ["yo/somela/bin/", false],
      ["yo/some/bin", true],
      ["yo/some/bin/", true],
      ["foo/bar", false],
      ["foo//bar", false], // Double slash should still match
    ])(
      'should correctly handle multiple wildcards for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Character Ranges", () => {
    const gitignoreContent = `
file[0-9].txt
image[a-c].png
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["file1.txt", false],
      ["file9.txt", false],
      ["file0.txt", false],
      ["file10.txt", true],
      ["filea.txt", true],
      ["imagea.png", false],
      ["imageb.png", false],
      ["imagec.png", false],
      ["imaged.png", true],
      ["imageA.png", true], // Case-sensitive match
    ])(
      'should correctly handle character ranges for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Complex Sequence of Patterns", () => {
    const gitignoreContent = `
# Exclude everything except directory foo/bar
/*
!/foo
/foo/*
!/foo/bar
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["foo/", false],
      ["notfoo/", false],
      ["foo/bar", true],
      ["foo/bar/", true],
      ["foo/bar/baz.txt", true],
      ["foo/baz.txt", false],
      ["src/app.js", false],
      ["README.md", false],
      ["foo/barbaz", false],
      ["foo/bar/baz/qux.txt", true],
    ])(
      'should correctly handle complex sequence for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Leading and Trailing Slashes", () => {
    const gitignoreContent = `
/config/
build/*.js
docs/
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["config/", false],
      ["config/settings.json", false],
      ["build/app.js", false],
      ["build/docs/readme.md", false],
      ["build/app.css", true],
      ["docs/", false],
      ["docs/readme.md", false],
      ["src/docs/readme.md", false],
      ["src/config/", true],
      ["config/file.txt", false],
      ["build/app.jsx", true],
      ["build/app.js.map", true],
    ])(
      'should correctly handle leading/trailing slashes for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });
  describe("Double Asterisks (`**`) Usage", () => {
    describe("Prefix `**`", () => {
      const gitignoreContent = `
**/logs
`;
      const gitignore = new GitIgnore(gitignoreContent);

      test.each([
        ["logs", false],
        ["logs/", false],
        ["app/logs/", false],
        ["app/logs/error.log", false],
        ["app/logs", false],
        ["src/app/file.js", true],
      ])(
        'should correctly handle prefix "**" patterns for "%s"',
        (path, expected) => {
          expect(gitignore.isAccepted(path)).toBe(expected);
        },
      );
    });

    describe("Suffix `**`", () => {
      const gitignoreContent = `
logs/**
**/*.tmp
`;
      const gitignore = new GitIgnore(gitignoreContent);

      test.each([
        ["logs", true],
        ["logs/", false],
        ["logs/error.log", false],
        ["temp/file.tmp", false],
        ["src/app/tmp/file.tmp", false],
        ["src/app/file.tmp", false],
        ["tmp/file.log", true],
      ])(
        'should correctly handle suffix "**" patterns for "%s"',
        (path, expected) => {
          expect(gitignore.isAccepted(path)).toBe(expected);
        },
      );
    });
  });

  describe("Mixed Patterns and Order Sensitivity", () => {
    const gitignoreContent = `
*.js
!src/app.js
src/*.js
!src/lib/*.js
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["app.js", false],
      ["src/app.js", false],
      ["src/lib/utils.js", true],
      ["src/lib/index.js", true],
      ["src/main.js", false],
      ["test/app.js", false],
      ["src/lib/deep/utils.js", false], // Not matched by '!src/lib/*.js'
    ])('should correctly handle mixed patterns for "%s"', (path, expected) => {
      expect(gitignore.isAccepted(path)).toBe(expected);
    });
  });

  describe("Patterns with Spaces and Special Characters", () => {
    const gitignoreContent = `
*.log
file\\ name.txt
data\\ \\[backup\\].csv
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["debug.log", false],
      ["file name.txt", false],
      ["filename.txt", true],
      ["data [backup].csv", false],
      ["data backup.csv", true],
      ["data[backup].csv", true],
      ["file  name.txt", true],
      ["data [backup].csv", false],
    ])(
      'should correctly handle spaces and special characters for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Edge Cases from Git SCM gitignore Manpage", () => {
    const gitignoreContent = `
# Exclude everything except directory foo/bar
/*
!/foo
/foo/*
!/foo/bar
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["foo/bar/baz.txt", true],
      ["foo/baz.txt", false],
      ["foo/bar/", true],
      ["foo/bar", true],
      ["foo", true],
      ["foo/", false],
      ["foo/anything", false],
      ["foo/bar/extra", true],
    ])(
      'should correctly handle Git manpage edge cases for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );

    const content2 = `
# Ignore files starting with '#' unless escaped
\\#secret.txt
`;
    const gitignore2 = new GitIgnore(content2);

    test.each([
      ["#secret.txt", false],
      ["secret.txt", true],
      ["src/app.js", true],
      ["#notsecret.txt", true],
    ])('should correctly handle escaped # for "%s"', (path, expected) => {
      expect(gitignore2.isAccepted(path)).toBe(expected);
    });
  });

  describe("Empty Lines and Comments", () => {
    const gitignoreContent = `
# This is a comment
*.tmp

# Another comment
!keep.tmp

`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["file.tmp", false],
      ["keep.tmp", true],
      ["src/file.tmp", false],
      ["docs/readme.md", true],
      ["file.tmp.backup", true], // Should not be ignored
    ])(
      'should correctly ignore comments and empty lines for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Case Sensitivity", () => {
    const gitignoreContent = `
*.Log
!Important.Log
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["error.log", true],
      ["error.Log", false],
      ["Important.log", true],
      ["Important.Log", true],
      ["IMPORTANT.LOG", true], // Case-sensitive match
    ])(
      'should correctly handle case sensitivity for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Root vs. Subdirectory Patterns", () => {
    describe("Root Pattern `/build`", () => {
      const gitignoreContent = `
/build
`;
      const gitignore = new GitIgnore(gitignoreContent);

      test.each([
        ["app.js", true],
        ["build/", false],
        ["build/app.js", false],
        ["src/build/", true],
        ["src/build/app.js", true],
        ["src/app/build.js", true],
        ["src/app/build/", true],
        ["src/build/app", true],
        ["src/app/", true],
        ["dist/build/app.js", true],
        ["build", false],
      ])(
        'should correctly handle root pattern `/build` for "%s"',
        (path, expected) => {
          expect(gitignore.isAccepted(path)).toBe(expected);
        },
      );
    });

    describe("Subdirectory Pattern `build/`", () => {
      const gitignoreContent = `
build/
`;
      const gitignore = new GitIgnore(gitignoreContent);

      test.each([
        ["app.js", true],
        ["build/", false],
        ["build/app.js", false],
        ["src/build/", false],
        ["src/build/app.js", false],
        ["src/app/build.js", true],
        ["src/app/build/", false],
        ["src/build/app", false],
        ["src/app/", true],
        ["dist/build/app.js", false],
        ["build", true], // 'build' as a file should be accepted
      ])(
        'should correctly handle subdirectory pattern `build/` for "%s"',
        (path, expected) => {
          expect(gitignore.isAccepted(path)).toBe(expected);
        },
      );
    });

    describe("Subdirectory Pattern `src/build/`", () => {
      const gitignoreContent = `
src/build/
`;
      const gitignore = new GitIgnore(gitignoreContent);

      test.each([
        ["app.js", true],
        ["build/", true],
        ["build/app.js", true],
        ["src/build/", false],
        ["src/build/app.js", false],
        ["src/app/build.js", true],
        ["src/app/build/", true],
        ["src/build/app", false],
        ["src/app/", true],
        ["dist/build/app.js", true],
        ["build", true], // 'build' as a file should be accepted
      ])(
        'should correctly handle subdirectory pattern `src/build/` for "%s"',
        (path, expected) => {
          expect(gitignore.isAccepted(path)).toBe(expected);
        },
      );
    });
  });

  describe("Handling Trailing Spaces", () => {
    const gitignoreContent = ["*.log ", "!important.log\\ "].join("\n");
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["error.log", false],
      ["important.log ", true],
      ["important.log", false], // Trailing space is escaped, so should not match
      ["readme.md", true],
      ["debug.log ", true], // Gitignore only specifies *.log (ignoring trailing space), so this one is accepted
    ])('should correctly handle trailing spaces for "%s"', (path, expected) => {
      expect(gitignore.isAccepted(path)).toBe(expected);
    });
  });

  describe("Hidden Files and Directories", () => {
    const gitignoreContent = `
.*
!/.gitignore
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      [".env", false],
      [".gitignore", true],
      [".npmrc", false],
      ["src/.hidden", false],
      ["src/.hidden/file.txt", false],
      ["regular.file", true],
    ])('should correctly handle hidden files for "%s"', (path, expected) => {
      expect(gitignore.isAccepted(path)).toBe(expected);
    });
  });

  describe("Trailing Whitespace and Escaped Spaces", () => {
    const gitignoreContent = [
      "patternwithspace\\ ",
      "patternwithoutspace",
      '"patterninquotes"',
    ].join("\n");
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["patternwithspace ", false],
      ["patternwithspace", true],
      ["patternwithoutspace", false],
      ['"patterninquotes"', false],
      ["patterninquotes", true],
    ])(
      'should correctly handle trailing whitespace and escaped spaces for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Patterns Starting with Exclamation Mark", () => {
    const gitignoreContent = `
\\!important.txt
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["!important.txt", false],
      ["important.txt", true],
      ["notimportant.txt", true],
    ])(
      'should correctly handle patterns starting with "!" for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Patterns with Carriage Returns", () => {
    const gitignoreContent = `test\r\n*.bak\r\n`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["test", false],
      ["backup.bak", false],
      ["backup.txt", true],
    ])(
      'should correctly handle patterns with CRLF for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Recursive Directory Matching", () => {
    const gitignoreContent = `
docs/**/build/
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["docs/build/", false],
      ["docs/subdir/build/", false],
      ["docs/subdir/build/file.txt", false],
      ["docs/build/file.txt", false],
      ["docs/build", true], // 'build' as a file should be accepted
      ["src/docs/build/", false],
    ])(
      'should correctly handle recursive directory patterns for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });

  describe("Explain API", () => {
    const gitignoreContent = `
*.log
!important.log
/build/
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      [
        "error.log",
        {
          outcome: "ignored",
          reason: expect.objectContaining({ line: "*.log" }),
        },
      ],
      [
        "important.log",
        {
          outcome: "accepted",
          reason: expect.objectContaining({ line: "!important.log" }),
        },
      ],
      [
        "build/app.js",
        {
          outcome: "ignored",
          reason: expect.objectContaining({ line: "/build/" }),
        },
      ],
      [
        "src/app.js",
        {
          outcome: "accepted",
        },
      ],
      [
        "build/",
        {
          outcome: "ignored",
          reason: expect.objectContaining({ line: "/build/" }),
        },
      ],
      [
        "nested/build/app.js",
        {
          outcome: "accepted",
        },
      ],
    ])('should correctly explain the reason for "%s"', (path, expected) => {
      expect(gitignore.explain(path)).toEqual(expected);
    });
  });

  describe("Character Class Negation", () => {
    const gitignoreContent = `
file[!0-9].txt
`;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["filea.txt", true],
      ["file9.txt", false],
      ["file0.txt", false],
      ["file$.txt", true],
    ])(
      'should correctly handle character class negation for "%s"',
      (path, expected) => {
        expect(gitignore.isIgnored(path)).toBe(expected);
      },
    );
  });

  describe("Gitignore in Subdirectories", () => {
    const gitignoreContent = `
  subdir/*.txt
  `;
    const gitignore = new GitIgnore(gitignoreContent);

    test.each([
      ["file.txt", true],
      ["subdir/file.txt", false],
      ["subdir/nested/file.txt", true],
      ["subdir/file.md", true],
    ])(
      'should correctly handle gitignore in subdirectories for "%s"',
      (path, expected) => {
        expect(gitignore.isAccepted(path)).toBe(expected);
      },
    );
  });
});
