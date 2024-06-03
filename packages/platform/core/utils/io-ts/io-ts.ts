import t from "io-ts";
import { unique } from "remeda";

export * from "io-ts";
export { isLeft, isRight } from "fp-ts/Either";

export const FunctionT = t.Function as unknown as t.Type<
  (...args: any[]) => any
>;

export const unionOfStrings = <T extends string>(...values: T[]) =>
  t.keyof(
    // eslint-disable-next-line unicorn/no-null
    Object.fromEntries(values.map((value): any => [value, null])) as {
      [K in T]: null;
    },
  );

export const decodeOrThrow = <I, A>(
  decoder: t.Decoder<I, A>,
  input: I,
  error: string = "Failed to decode input",
): A => {
  const either = decoder.decode(input);
  switch (either._tag) {
    case "Left": {
      // throw new Error(`${error}:\n${PathReporter.report(either).join("\n")}`);
      throw new Error(
        `${error}:\n${unique(
          either.left.map(
            (error) =>
              error.message ??
              error.context
                .map(({ key, type, actual }, index) =>
                  !key
                    ? ""
                    : index < error.context.length - 1
                      ? `${index > 1 ? "." : ""}${key}`
                      : `.${key}: got '${actual}', but expected ${type.name}`,
                )
                .join(""),
          ),
        ).join("\n")}`,
      );
    }
    case "Right": {
      return either.right;
    }
  }
};
