import { ESTree, parseScript } from 'https://esm.sh/meriyah@4.2.1';
import * as ESTree2 from 'estree-jsx';
import {
  EXPRESSIONS_PRECEDENCE,
  generate,
  GENERATOR,
  NEEDS_PARENTHESES,
} from 'https://deno.land/x/astring@v1.8.3/src/astring.js';
import { Generator, State } from 'https://deno.land/x/astring@v1.8.3/astring.d.ts';

declare module 'https://deno.land/x/astring@v1.8.3/astring.d.ts' {
  interface State {
    generator: CustomGenerator;
    expressionsPrecedence: Record<keyof typeof EXPRESSIONS_PRECEDENCE, number>;
  }
}

interface CustomGenerator extends Generator {
  JSXAttribute: (
    node: ESTree.JSXAttribute,
    state: State,
  ) => void;
  JSXElement: (
    node: ESTree.JSXElement,
    state: State,
  ) => void;
  JSXFragment: (
    node: ESTree.JSXFragment,
    state: State,
  ) => void;
  JSXIdentifier: (
    node: ESTree.JSXIdentifier,
    state: State,
  ) => void;
  JSXExpressionContainer: (
    node: ESTree.JSXExpressionContainer,
    state: State,
  ) => void;
  JSXText: (node: ESTree.JSXText, state: State) => void;
  JSXSpreadAttribute: (
    node: ESTree.JSXSpreadAttribute,
    state: State,
  ) => void;
  JSXMemberExpression: (node: ESTree.JSXMemberExpression, state: State) => void;
  JSXNamespacedName: (node: ESTree.JSXNamespacedName, state: State) => void;
}

function reindent(state: State, text: string, indent: string, lineEnd: string) {
  /*
  Writes into `state` the `text` string reindented with the provided `indent`.
  */
  const lines = text.split('\n');
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

function isCallExpressionNamed(node: ESTree.CallExpression, name: string) {
  let callName;
  if (node.callee.type == 'CallExpression') {
    callName = node.callee.callee.name;
  } else {
    callName = node.callee.name;
  }
  return callName == name ? true : false;
}

// styled in JS uses a double invocation like styled('div')({..}) in dart it only uses 1 with some named params so lets fix that.
function formatStyledCallExpression(node: ESTree.CallExpression, state: State) {
  state.write('styled(');
  if (node.callee.arguments[0].type == 'Literal') {
    state.write(`Dom.${node.callee.arguments[0].value}`);
  } else {
    state.generator[node.callee.arguments[0].type](node.callee.arguments[0], state);
  }
  const namedArgs: Record<string, any> = {};
  if (node.callee.arguments[1] != undefined) {
    namedArgs['options'] = node.callee.arguments[1];
  }
  let styleKey = 'buildStyles';
  if (node.arguments[0].type == 'ObjectExpression') {
    styleKey = 'stylesMap';
  }
  namedArgs[styleKey] = node.arguments[0];
  // the first arg was already written above so add a comma
  state.write(', ');
  formatNamedArgs(namedArgs, state);
}

function formatNamedArgs(args: Record<string, ESTree.Node> = {}, state: State) {
  const { generator } = state;
  let first = true;
  if (args != null) {
    for (const argName in args) {
      const param = args[argName];
      if (!first) {
        state.write(', ');
      } else {
        first = false;
      }
      state.write(argName + ': ');
      generator[param.type](param, state);
    }
  }
  state.write(')');
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
    if (comment.type[0] === 'L') {
      // Line comment
      state.write('// ' + comment.value.trim() + '\n', comment);
    } else {
      // Block comment
      state.write('/*');
      reindent(state, comment.value, indent, lineEnd);
      state.write('*/' + lineEnd);
    }
  }
}

const formatVariableDeclaration: CustomGenerator['VariableDeclaration'] = (
  node: ESTree.VariableDeclaration,
  state,
) => {
  /*
    Writes into `state` a variable declaration.
    */
  const { generator } = state;
  const { declarations = [] } = node;
  if (node.kind == 'const') {
    // Best guess, it could be wrong at times though cause theres no 1 to 1 type for a js const in dart...
    state.write('final');
  } else {
    state.write('var');
  }
  // Add a space after the kind
  state.write(' ');
  const { length } = declarations;
  if (length > 0) {
    generator.VariableDeclarator(declarations[0], state);
    for (let i = 1; i < length; i++) {
      state.write(', ');
      generator.VariableDeclarator(declarations[i], state);
    }
  }
};

const formatJSXElement: CustomGenerator['JSXElement'] = (
  node,
  state,
) => {
  const indent = state.indent.repeat(state.indentLevel++);
  const jsxElementIndent = indent + state.indent;

  const element = node.openingElement;
  const children = node.children.filter((
    el,
  ) => (el.type != 'JSXText' ||
    (el.type == 'JSXText' &&
      el.value.replace(/(\s|\r\n|\r|\n)/g, '').length != 0))
  );
  const hasProps = element.attributes != null && element.attributes.length > 0;
  const hasChildren = children != null && children.length > 0;

  if (hasProps) state.write('(');
  state.write(formatElementName(element.name) + '()');
  if (hasProps) {
    const propIndent = state.indent.repeat(state.indentLevel++);
    state.write(state.lineEnd);
    for (const attribute of element.attributes) {
      state.write(propIndent);
      // Argument of type 'JSXAttribute | JSXSpreadAttribute' is not assignable to parameter of type 'never'.
      // The intersection 'JSXAttribute & JSXSpreadAttribute' was reduced to 'never' because property 'type' has conflicting types in some constituents.
      // Type 'JSXAttribute' is not assignable to type 'never'.deno-ts(2345)
      //
      // @ts-expect-error IDK why this is complaining but its saying that the `attribute` arg is broke because its `&` ing JSXAttribute and JSXSpreadAttribute together?
      state.generator[attribute.type](attribute, state);
      state.write(state.lineEnd);
    }
    state.indentLevel--;
    state.write(indent);
    state.write(')');
  }
  state.write('(');
  if (hasChildren) {
    state.write(state.lineEnd);
    const { length } = children;
    for (let i = 0; i < length; i++) {
      const child = children[i];
      state.write(jsxElementIndent);
      state.generator[child.type](child, state);
      state.write(',' + state.lineEnd);
    }
    state.write(indent);
  }
  state.write(')');
  state.indentLevel--;
};

const formatJSXFragment: CustomGenerator['JSXFragment'] = (
  node: ESTree.JSXFragment,
  state,
) => {
  const indent = state.indent.repeat(state.indentLevel++);
  const jsxElementIndent = indent + state.indent;
  const children = node.children.filter((
    el,
  ) => (el.type == 'JSXText' && !el.value.trim().length));
  const hasChildren = children != null && children.length > 0;
  state.write('Fragment()');

  state.write('(');
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
  state.write(')', node);
  state.indentLevel--;
};

const formatJSXAttribute: CustomGenerator['JSXAttribute'] = (
  node: ESTree.JSXAttribute,
  state,
) => {
  state.write('..', node);
  // @ts-ignore
  state.generator[node.name.type](node.name, state);
  state.write(' = ', node);
  if (node.value != null) {
    state.generator[node.value.type](node.value, state);
  } else {
    // Usually this is a boolean attribute that doesn't require the `={true}` in the JSX
    state.write('true', node);
  }
};

const formatJSXSpreadAttribute: CustomGenerator['JSXSpreadAttribute'] = (
  node: ESTree.JSXSpreadAttribute,
  state,
) => {
  state.write('..addProps(');
  state.generator[node.argument.type](node, state);
  state.write(')');
};

function formatSequence(nodes: ESTree.Node[], state: State) {
  /*
    Writes into `state` a sequence of `nodes`.
    */
  const { generator } = state;
  state.write('(');
  if (nodes != null && nodes.length > 0) {
    generator[nodes[0].type](nodes[0], state);
    const { length } = nodes;
    for (let i = 1; i < length; i++) {
      const param = nodes[i];
      state.write(', ');
      generator[param.type](param, state);
    }
  }
  state.write(')');
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
  } else if ('type' in name) {
    switch (name.type) {
      case 'JSXIdentifier':
        return name.name;
      case 'JSXMemberExpression':
        return name.property.name;
      case 'JSXNamespacedName':
        return `${formatName(name.namespace)}.${formatName(name)}`;
    }
  }
  return `${name}`;
}

function isString(value: unknown): value is string {
  return typeof value === 'string' || value instanceof String;
}

// Unrelated but kind dope (found while building this): https://jsonformatter.org/json-to-dart
const customGenerator: CustomGenerator = {
  ...GENERATOR,
  JSXElement: formatJSXElement,
  JSXFragment: formatJSXFragment,
  JSXAttribute: formatJSXAttribute,
  JSXSpreadAttribute: formatJSXSpreadAttribute,
  JSXIdentifier: function (node: ESTree.JSXIdentifier, state) {
    if (node.name.includes('aria-')) {
      state.write(node.name.replace('aria-', 'aria.'));
      return;
    }
    this.Identifier(node, state);
  },
  JSXMemberExpression: function (node: ESTree.JSXMemberExpression, state) {
    this.MemberExpression(node, state);
  },
  JSXNamespacedName: function (node: ESTree.JSXNamespacedName, state) {
    // @ts-ignore this hasn't come up yet...
    this[node.namespace.type](node.namespace, state);
    this[node.name.type](node.name, state);
  },
  JSXExpressionContainer: function (node, state) {
    this[node.expression.type](node.expression, state);
  },
  JSXText: function (node, state) {
    if (node.value == null) {
      return;
    }
    state.write(`'${node.value.trim()}'`);
  },
  Literal: function (node, state) {
    if (node.raw != null) {
      // Non-standard property
      state.write(node.raw, node);
    } else if (node.regex != null) {
      this.RegExpLiteral(node, state);
    } else if (node.bigint != null) {
      state.write(node.bigint + 'n', node);
    } else {
      state.write(JSON.stringify(node.value).replaceAll('"', '\''), node);
    }
  },

  Property: function (
    node:
      | (ESTree2.AssignmentProperty & {
        type: 'Property';
      })
      | (ESTree.Property & {
        type: 'Property';
      }),
    state,
  ) {
    if (node.method || node.kind[0] !== 'i') {
      // Either a method or of kind `set` or `get` (not `init`)
      this.MethodDefinition(node, state);
    } else {
      if (!node.shorthand) {
        if (node.computed) {
          state.write('[');
          this[node.key.type](node.key, state);
          state.write(']');
        } else {
          if (node.key.type == 'Identifier') state.write('\'');
          this[node.key.type](node.key, state);
          if (node.key.type == 'Identifier') state.write('\'');
        }
        state.write(': ');
      }

      this[node.value.type](node.value, state);
    }
  },
  ObjectExpression: function (node: ESTree.ObjectExpression, state) {
    const indent = state.indent.repeat(state.indentLevel++);
    const { lineEnd } = state;
    const propertyIndent = indent + state.indent;
    state.write('{');
    if (node.properties.length > 0) {
      state.write(lineEnd);
      const comma = ',' + lineEnd;
      const { properties } = node,
        { length } = properties;
      for (let i = 0;;) {
        const property = properties[i];
        state.write(propertyIndent);
        this[property.type](property, state);
        if (++i < length) {
          state.write(comma);
        } else {
          break;
        }
      }
      state.write(lineEnd);
      state.write(indent + '}');
    } else {
      state.write('}');
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
    }
    if (!(node.body.type === 'BlockStatement')) {
      state.write(' => ');
    } else {
      state.write(' ');
    }
    if (node.body.type[0] === 'O') {
      // Body is an object expression
      state.write('(');
      this.ObjectExpression(node.body, state);
      state.write(')');
    } else {
      this[node.body.type](node.body, state);
    }
  },
  ArrayExpression: function (node: ESTree.ArrayExpression, state) {
    state.write('[');
    if (node.elements.length > 0) {
      const { elements } = node,
        { length } = elements;
      for (let i = 0;;) {
        const element = elements[i];
        if (element != null) {
          this[element.type](element, state);
        }
        if (++i < length) {
          state.write(', ');
        } else {
          if (element == null) {
            state.write(', ');
          }
          break;
        }
      }
    }
    state.write(']');
  },
  ArrayPattern: function (node, state) {
    if (node.elements.length == 2 && node.elements[1].name.includes('set')) {
      this[node.elements[0].type](node.elements[0], state);
    } else {
      state.generator.ArrayExpression(node, state);
    }
  },
  CallExpression: function (node, state) {
    // Special Case
    if (isCallExpressionNamed(node, 'styled')) {
      formatStyledCallExpression(node, state);
      return;
    }
    const precedence = state.expressionsPrecedence[node.callee.type as keyof typeof EXPRESSIONS_PRECEDENCE];
    if (
      precedence === NEEDS_PARENTHESES ||
      precedence < state.expressionsPrecedence.CallExpression
    ) {
      state.write('(');
      this[node.callee.type](node.callee, state);
      state.write(')');
    } else {
      this[node.callee.type](node.callee, state);
    }
    if (node.optional) {
      state.write('?.');
    }
    formatSequence(node['arguments'], state);
  },
  FunctionDeclaration: function (node: ESTree.FunctionDeclaration, state: State) {
    state.write(
      (node.id ? node.id.name : '') +
        (node.async ? 'async' : '') +
        (node.generator ? node.async ? '* ' : 'sync* ' : ''),
      node,
    );
    formatSequence(node.params, state);
    state.write(' ');
    if (node.body != null) this[node.body.type](node.body, state);
  },
  VariableDeclarator: function (node, state) {
    this[node.id.type](node.id, state);
    if (node.init != null) {
      state.write(' = ');
      this[node.init.type](node.init, state);
    }
  },
  VariableDeclaration: function (node, state) {
    formatVariableDeclaration(node, state);
    state.write(';');
  },
};

export function jsx2OverReact(str: string): string {
  const ast = parseScript(str, { module: true, jsx: true });
  console.log(ast);
  return generate(ast, { generator: customGenerator });
}
