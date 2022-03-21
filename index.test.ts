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

  await t.step(
    "wraps OverReact factory and has cascade setters when there are properties",
    () => {
      const jsxInput = `<HelloWorld omg="lol">hello world</HelloWorld>`;
      assertStringEqual(
        jsx2OverReact(jsxInput),
        `(HelloWorld()
        ..omg = 'lol'
      )(
        'hello world'
      )`,
      );
    },
  );

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

    await t.step("can convert stupidly complex input", () => {
      const jsxInput =
        `<List sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
        <ListItem alignItems="flex-start">
          <ListItemAvatar>
            <Avatar hasSomething={true} alt="Remy Sharp" src="/static/images/avatar/1.jpg" />
          </ListItemAvatar>
          <ListItemText
            primary="Brunch this weekend?"
            secondary={
              <React.Fragment>
                <Typography
                  sx={{ display: 'inline' }}
                  component="span"
                  variant="body2"
                  color="text.primary"
                >
                  Ali Connors
                </Typography>
                {" — I'll be in your neighborhood doing errands this…"}
              </React.Fragment>
            }
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemAvatar>
            <Avatar alt="Travis Howard" src="/static/images/avatar/2.jpg" />
          </ListItemAvatar>
          <ListItemText
            primary="Summer BBQ"
            secondary={
              <React.Fragment>
                <Typography
                  sx={{ display: 'inline' }}
                  component="span"
                  variant="body2"
                  color="text.primary"
                >
                  to Scott, Alex, Jennifer
                </Typography>
                {" — Wish I could come, but I'm out of town this…"}
              </React.Fragment>
            }
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem alignItems="flex-start">
          <ListItemAvatar>
            <Avatar alt="Cindy Baker" src="/static/images/avatar/3.jpg" />
          </ListItemAvatar>
          <ListItemText
            primary="Oui Oui"
            secondary={
              <React.Fragment>
                <Typography
                  sx={{ display: 'inline' }}
                  component="span"
                  variant="body2"
                  color="text.primary"
                >
                  Sandra Adams
                </Typography>
                {' — Do you have Paris recommendations? Have you ever…'}
              </React.Fragment>
            }
          />
        </ListItem>
      </List>`;
      assertStringEqual(
        jsx2OverReact(jsxInput),
      `(List()
        ..sx = {'width': '100%', 'maxWidth': 360, 'bgcolor': 'background.paper'}
      )(
        (ListItem()..alignItems = 'flex-start')(
          ListItemAvatar()(
            (Avatar()
              ..hasSomething = true
              ..alt = 'Remy Sharp'
              ..src = '/static/images/avatar/1.jpg'
            )(),
          ),
          (ListItemText()
            ..primary = 'Brunch this weekend?'
            ..secondary = Fragment()(
              (Typography()
                ..sx = {'display': 'inline'}
                ..component = 'span'
                ..variant = 'body2'
                ..color = 'text.primary'
              )(
                'Ali Connors',
              ),
            )
          )(),
        ),
        (Divider()
          ..variant = 'inset'
          ..component = 'li'
        )(),
        (ListItem()..alignItems = 'flex-start')(
          ListItemAvatar()(
            (Avatar()
              ..alt = 'Travis Howard'
              ..src = '/static/images/avatar/2.jpg'
            )(),
          ),
          (ListItemText()
            ..primary = 'Summer BBQ'
            ..secondary = Fragment()(
              (Typography()
                ..sx = {'display': 'inline'}
                ..component = 'span'
                ..variant = 'body2'
                ..color = 'text.primary'
              )(
                'to Scott, Alex, Jennifer',
              ),
            )
          )(),
        ),
        (Divider()
          ..variant = 'inset'
          ..component = 'li'
        )(),
        (ListItem()..alignItems = 'flex-start')(
          ListItemAvatar()(
            (Avatar()
              ..alt = 'Cindy Baker'
              ..src = '/static/images/avatar/3.jpg'
            )(),
          ),
          (ListItemText()
            ..primary = 'Oui Oui'
            ..secondary = Fragment()(
              (Typography()
                ..sx = {'display': 'inline'}
                ..component = 'span'
                ..variant = 'body2'
                ..color = 'text.primary'
              )(
                'Sandra Adams',
              ),
            )
          )(),
        ),
      ),`,
      );
    });
  });
});
