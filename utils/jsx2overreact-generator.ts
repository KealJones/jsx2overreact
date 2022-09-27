import { ESTree, parseScript } from "https://esm.sh/meriyah@4.2.1";
// @deno-types="https://deno.land/x/astring@v1.8.3/astring.d.ts"
import {
  generate,
  GENERATOR,
} from "https://deno.land/x/astring/src/astring.js";
import {
  Generator,
  State,
} from "https://deno.land/x/astring@v1.8.3/astring.d.ts";
import { JSXEmptyExpression } from "https://esm.sh/v86/meriyah@4.2.1/dist/src/estree.d.ts";

declare module "https://deno.land/x/astring@v1.8.3/astring.d.ts" {
  interface State {
    generator: Generator;
    hooks: Record<string | number | symbol, any>;
  }
}

function reindent(state: State, text: string, indent: string, lineEnd: string) {
  /*
  Writes into `state` the `text` string reindented with the provided `indent`.
  */
  const lines = text.split("\n");
  const end = lines.length - 1;
  state.write(lines[0].trim());
  if (end > 0) {
    state.write(lineEnd);
    for (let i = 1; i < end; i++) {
      state.write(indent + lines[i].trim() + lineEnd);
    }
    state.write(indent + lines[end].trim());
  }
}

function formatComments(
  state: State,
  comments: any[],
  indent: string,
  lineEnd: string,
) {
  /*
  Writes into `state` the provided list of `comments`, with the given `indent` and `lineEnd` strings.
  Line comments will end with `"\n"` regardless of the value of `lineEnd`.
  Expects to start on a new unindented line.
  */
  const { length } = comments;
  for (let i = 0; i < length; i++) {
    const comment = comments[i];
    state.write(indent);
    if (comment.type[0] === "L") {
      // Line comment
      state.write("// " + comment.value.trim() + "\n", comment);
    } else {
      // Block comment
      state.write("/*");
      reindent(state, comment.value, indent, lineEnd);
      state.write("*/" + lineEnd);
    }
  }
}

const formatVariableDeclaration: Generator["VariableDeclaration"] = (
  node,
  state,
) => {
  /*
    Writes into `state` a variable declaration.
    */
  const { generator } = state;
  const { declarations } = node;
  state.write("var ");
  const { length } = declarations;
  if (length > 0) {
    generator.VariableDeclarator(declarations[0], state);
    for (let i = 1; i < length; i++) {
      state.write(", ");
      generator.VariableDeclarator(declarations[i], state);
    }
  }
};

const formatJSXElement: Generator["JSXElement"] = (
  node: ESTree.JSXElement,
  state,
) => {
  const indent = state.indent.repeat(state.indentLevel++);
  const jsxElementIndent = indent + state.indent;

  const element = node.openingElement;
  const children = node.children.filter((
    el,
  ) => (el.type != "JSXText" ||
    (el.type == "JSXText" &&
      el.value.replace(/(\s|\r\n|\r|\n)/g, "").length != 0))
  );
  const hasProps = element.attributes != null && element.attributes.length > 0;
  const hasChildren = children != null && children.length > 0;

  if (hasProps) state.write("(");
  state.write(formatElementName(element.name) + "()");
  if (hasProps) {
    const propIndent = state.indent.repeat(state.indentLevel++);
    state.write(state.lineEnd);
    for (const attribute of element.attributes) {
      state.write(propIndent);
      state.generator[attribute.type](attribute, state);
      state.write(state.lineEnd);
    }
    state.indentLevel--;
    state.write(indent);
    state.write(")");
  }
  state.write("(");
  if (hasChildren) {
    state.write(state.lineEnd);
    const { length } = children;
    for (let i = 0; i < length; i++) {
      const child = children[i];
      state.write(jsxElementIndent);
      state.generator[child.type](child, state);
      state.write("," + state.lineEnd);
    }
    state.write(indent);
  }
  state.write(")");
  state.indentLevel--;
};

const formatJSXFragment: Generator["JSXFragment"] = (
  node: ESTree.JSXFragment,
  state,
) => {
  const indent = state.indent.repeat(state.indentLevel++);
  const jsxElementIndent = indent + state.indent;
  const children = node.children.filter((
    el,
  ) => (el.type == "JSXText" && !el.value.trim().length));
  const hasChildren = children != null && children.length > 0;
  state.write("Fragment()");

  state.write("(");
  if (hasChildren) {
    state.write(state.lineEnd);
    const { length } = children;
    for (let i = 0; i < length; i++) {
      const child = children[i];
      state.write(jsxElementIndent);
      state.generator[child.type](child, state);
    }
    state.write(indent, node);
  }
  state.write(")", node);
  state.indentLevel--;
};

const formatJSXAttribute: Generator["JSXAttribute"] = (
  node: ESTree.JSXAttribute,
  state,
) => {
  state.write("..", node);
  state.generator[node.name.type](node.name, state);
  state.write(" = ", node);
  if (node.value != null) {
    state.generator[node.value.type](node.value, state);
  } else {
    state.write("null", node);
  }
};

function formatSequence(nodes: ESTree.Node[], state: State) {
  /*
    Writes into `state` a sequence of `nodes`.
    */
  const { generator } = state;
  state.write("(");
  if (nodes != null && nodes.length > 0) {
    generator[nodes[0].type](nodes[0], state);
    const { length } = nodes;
    for (let i = 1; i < length; i++) {
      const param = nodes[i];
      state.write(", ");
      generator[param.type](param, state);
    }
  }
  state.write(")");
}

function startsWithCapital(word: string): boolean {
  if (!word) return false;
  return word.substring(0, 1) === word.substring(0, 1).toUpperCase();
}

function formatElementName(
  name: string | ESTree.JSXIdentifier | ESTree.JSXTagNameExpression,
): string {
  const convertedName = formatName(name);
  if (startsWithCapital(convertedName)) {
    return convertedName;
  }
  return `Dom.${convertedName}`;
}

function formatName(
  name: string | ESTree.JSXIdentifier | ESTree.JSXTagNameExpression,
): string {
  if (isString(name)) {
    return name;
  } else if ("type" in name) {
    switch (name.type) {
      case "JSXIdentifier":
        return name.name;
      case "JSXMemberExpression":
        return name.property.name;
      case "JSXNamespacedName":
        return `${formatName(name.namespace)}.${formatName(name)}`;
    }
  }
  return `${name}`;
}

function isString(value: unknown): value is string {
  return typeof value === "string" || value instanceof String;
}

// Unrelated but kind dope (found while building this): https://jsonformatter.org/json-to-dart
const customGenerator: Generator = {
  ...GENERATOR,
  JSXElement: formatJSXElement,
  JSXFragment: formatJSXFragment,
  JSXAttribute: formatJSXAttribute,
  JSXIdentifier: function (node: ESTree.JSXIdentifier, state) {
    if (node.name.includes("aria-")) {
      state.write(node.name.replace("aria-", "aria."), node);
      return;
    }
    this.Identifier(node, state);
  },
  JSXExpressionContainer: function (node, state) {
    this[node.expression.type](node.expression, state);
  },
  JSXText: function (node, state) {
    if (node.value == null) {
      return;
    }
    state.write(`'${node.value.trim()}'`, node);
  },
  Literal: function (node, state) {
    if (node.raw != null) {
      debugger;
      // Non-standard property
      state.write(node.raw, node);
    } else if (node.regex != null) {
      this.RegExpLiteral(node, state);
    } else if (node.bigint != null) {
      state.write(node.bigint + "n", node);
    } else {
      state.write(JSON.stringify(node.value).replaceAll('"', "'"), node);
    }
  },
  Property: function(node: ESTree.Property, state) {
    if (node.method || node.kind[0] !== 'i') {
      // Either a method or of kind `set` or `get` (not `init`)
      this.MethodDefinition(node, state)
    } else {
      if (!node.shorthand) {
        if (node.computed) {
          state.write('[')
          this[node.key.type](node.key, state)
          state.write(']')
        } else {
          if (node.key.type == 'Identifier') state.write("'");
          this[node.key.type](node.key, state)
          if (node.key.type == 'Identifier') state.write("'");
        }
        state.write(': ')
      }
      this[node.value.type](node.value, state)
    }
  },
  ObjectExpression: function (node: ESTree.ObjectExpression, state) {
    const indent = state.indent.repeat(state.indentLevel++);
    const { lineEnd, writeComments } = state;
    const propertyIndent = indent + state.indent;
    state.write("{");
    if (node.properties.length > 0) {
      state.write(lineEnd);
      // if (writeComments && node.comments != null) {
      //   formatComments(state, node.comments, propertyIndent, lineEnd);
      // }
      const comma = "," + lineEnd;
      const { properties } = node,
        { length } = properties;
      for (let i = 0;;) {
        const property = properties[i];
        // if (writeComments && property.comments != null) {
        //   formatComments(state, property.comments, propertyIndent, lineEnd);
        // }
        state.write(propertyIndent);
        this[property.type](property, state);
        if (++i < length) {
          state.write(comma);
        } else {
          break;
        }
      }
      state.write(lineEnd);
      // if (writeComments && node.trailingComments != null) {
      //   formatComments(state, node.trailingComments, propertyIndent, lineEnd);
      // }
      state.write(indent + "}");
    }
    //  else if (writeComments) {
    //   if (node.comments != null) {
    //     state.write(lineEnd);
    //     formatComments(state, node.comments, propertyIndent, lineEnd);
    //     if (node.trailingComments != null) {
    //       formatComments(state, node.trailingComments, propertyIndent, lineEnd);
    //     }
    //     state.write(indent + "}");
    //   } else if (node.trailingComments != null) {
    //     state.write(lineEnd);
    //     formatComments(state, node.trailingComments, propertyIndent, lineEnd);
    //     state.write(indent + "}");
    //   } else {
    //     state.write("}");
    //   }
    //}
    else {
      state.write("}");
    }
    state.indentLevel--;
  },
  RegExpLiteral: function (node, state) {
    const { regex } = node;
    state.write(`/${regex.pattern}/${regex.flags}`, node);
  },
  ArrowFunctionExpression: function (node, state) {
    const { params } = node;
    if (params != null) {
      formatSequence(node.params, state);
      state.write(" ");
    }
    if (node.body.type[0] === "O") {
      // Body is an object expression
      state.write("(");
      this.ObjectExpression(node.body, state);
      state.write(")");
    } else {
      this[node.body.type](node.body, state);
    }
  },
  ArrayExpression: function (node: ESTree.ArrayExpression, state) {
    state.write("[");
    if (node.elements.length > 0) {
      const { elements } = node,
        { length } = elements;
      for (let i = 0;;) {
        const element = elements[i];
        if (element != null) {
          this[element.type](element, state);
        }
        if (++i < length) {
          state.write(", ");
        } else {
          if (element == null) {
            state.write(", ");
          }
          break;
        }
      }
    }
    state.write("]");
  },
  ArrayPattern: function (node, state) {
    if (node.elements.length == 2 && node.elements[1].name.includes("set")) {
      this[node.elements[0].type](node.elements[0], state);
    } else {
      state.generator.ArrayExpression(node, state);
    }
  },
  VariableDeclarator: function (node, state) {
    this[node.id.type](node.id, state);
    if (node.init != null) {
      state.write(" = ");
      this[node.init.type](node.init, state);
    }
  },
  VariableDeclaration: function (node, state) {
    formatVariableDeclaration(node, state);
    state.write(";");
  },
};

export function jsx2OverReact(str: string): string {
  const parsedJsx = parseScript(str, { module: true, jsx: true });
  //console.log(JSON.stringify(parsedJsx, null, 2));
  return generate(parsedJsx, { generator: customGenerator });
}
