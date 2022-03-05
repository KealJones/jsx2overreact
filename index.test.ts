import { assertEquals } from "https://deno.land/std@0.128.0/testing/asserts.ts";
import { jsx2OverReact } from "./index.ts";
import dedent from "./utils/dedent.ts";

const assertStringEqual = (actual: string, expected: string) =>
  assertEquals(dedent(actual), dedent(expected));

await Deno.test("jsx2OverReact", async (t) => {

  await t.step("wraps text nodes in single quotes", () => {
    const jsxInput = `hello world`;
    assertStringEqual(
      jsx2OverReact(jsxInput),
      "'" + jsxInput + "'",
    );
  });

  await t.step("treats non capitalized elements as Dom.* factories", () => {
    const jsxInput = "<div>hello world</div>";
    assertStringEqual(
      jsx2OverReact(jsxInput),
      `Dom.div()(
        'hello world'
      )`,
    );
  });

  await t.step("treats capitalized elements as OverReact Factory", () => {
    const jsxInput = "<HelloWorld>hello world</HelloWorld>";
    assertStringEqual(
      jsx2OverReact(jsxInput),
      `HelloWorld()(
        'hello world'
      )`,
    );
  });

  await t.step("wraps OverReact factory and has cascade setters when there are properties", () => {
    const jsxInput = `<HelloWorld omg="lol">hello world</HelloWorld>`;
    assertStringEqual(
      jsx2OverReact(jsxInput),
      `(HelloWorld()
        ..omg = 'lol'
      )(
        'hello world'
      )`,
    );
  });

  await t.step('"Dartifies" JSX props', async (t) => {
    const makeJsxPropertyValueString = (value: string) =>
      `<Test prop=${value}></Test>`;
    const makeOverReactPropertyValueString = (value: string) =>
      `(Test()
      ..prop = ${value.toString()}
    )()`;
    const makePropertyValueStrings = (
      jsxValue: string,
      orValue: string,
    ) => [
      makeJsxPropertyValueString(jsxValue),
      makeOverReactPropertyValueString(orValue),
    ];

    await t.step("string", () => {
      const [jsxInput, orExpect] = makePropertyValueStrings(
        `'some value'`,
        `'some value'`,
      );
      assertStringEqual(
        jsx2OverReact(jsxInput),
        orExpect,
      );
    });

    await t.step("boolean", () => {
      const [jsxInput, orExpect] = makePropertyValueStrings(`{true}`, `true`);
      assertStringEqual(
        jsx2OverReact(jsxInput),
        orExpect,
      );
    });

    await t.step("map", () => {
      const [jsxInput, orExpect] = makePropertyValueStrings(
        `{{test:"omg"}}`,
        `{'test':'omg'}`,
      );
      assertStringEqual(
        jsx2OverReact(jsxInput),
        orExpect,
      );
    });

    await t.step("can convert deeply nested children to OverReact", () => {
      const jsxInput =
        `<HelloWorld omg="lol"><div><Fancy>hello world</Fancy><Fun correct={false}></Fun></div></HelloWorld>`;
      assertStringEqual(
        jsx2OverReact(jsxInput),
        `(HelloWorld()
          ..omg = 'lol'
        )(
          Dom.div()(
            Fancy()(
              'hello world'
            ),
            (Fun()
              ..correct = false
            )(),
          ),
        )`,
      );
    });
  });
});
