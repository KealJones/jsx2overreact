import { ESTree, parseScript } from 'https://esm.sh/meriyah@4.3.0';
import { walk } from 'https://esm.sh/estree-walker';
import ts from 'https://esm.sh/typescript';
import * as ts2dart from 'https://esm.sh/ts2dart@0.9.11';
import * as ESTree2 from 'estree';
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
    hookIdentifiers: Record<string, Record<string, string>>;
    currentFunctionComponentName: string;
    currentFunctionComponentRange: number[];
  }
}

declare module 'https://esm.sh/meriyah@4.3.0' {
  namespace ESTree {
    interface _Node {
      comments?: ESTree.Comment[] | undefined;
      trailingComments?: ESTree.Comment[] | undefined;
      leadingComments?: ESTree.Comment[] | undefined;
    }
  }
}

const writeComments = false;

const specialFeatures = {
  or_styled: true,
  or_hooks: true,
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

const getCallExpressionName = (node: ESTree.CallExpression): string => {
  let callName = node.callee?.name ?? '';
  if (node.callee.type == 'CallExpression') {
    callName = node.callee.callee.name;
  }
  return callName;
}

const isCallExpressionNamed = (node: ESTree.CallExpression, name: string | RegExp) => {
  const callName = getCallExpressionName(node);
  return callName.match(name) ? true : false;
}

const isCapitalized = (str: string | undefined) => str == null ? false : str[0] === str[0].toUpperCase();

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
  comments: ESTree.Comment[],
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

const formatHookDeclarator = (
  node: ESTree.VariableDeclarator,
  state: State,
) => {
  const hookType = getHookTypeFromDeclarator(node);
  if (hookType != null) {
    if (hookType == 'State') {
      // using destructured assignment
      // ex. `const [state, setState] = useState();`
      if (node.id.type == 'ArrayPattern' && node.id.elements.length == 2) {
          // Add to a hook map the identifier name so that when that identifier is found later we can swap it with the overreact equivalent
          if (node.id.elements[0].type == 'Identifier' && node.id.elements[1].type == 'Identifier') {
            // First element is the value
            state.hookIdentifiers[state.currentFunctionComponentName][node.id.elements[0].name] = `${node.id.elements[0].name}.value`;
            // Second element is the setter
            state.hookIdentifiers[state.currentFunctionComponentName][node.id.elements[1].name] = `${node.id.elements[0].name}.set`;
            state.write(node.id.elements[0].name, node);
          }
        } else {
          state.generator[node.id.type](node.id, state);
        }
    }
    if (node.init != null) {
      state.write(' = ');
      state.generator[node.init.type](node.init, state);
    }
  }
}


const formatVariableDeclaration = (
  node: ESTree.VariableDeclaration,
  state: State,
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
    if (isHookDeclarator(declarations[0])) {
      formatHookDeclarator(declarations[0], state);
      return;
    }
    generator.VariableDeclarator(declarations[0], state);
    for (let i = 1; i < length; i++) {
      state.write(', ');
      generator.VariableDeclarator(declarations[i], state);
    }
  }
};

const isHookDeclarator = (node: ESTree.VariableDeclarator) => {
  if (node.init != null && node.init?.type == 'CallExpression') {
    return getCallExpressionName(node.init).startsWith('use');
  }
  return false;
}

const getHookTypeFromDeclarator = (node: ESTree.VariableDeclarator) => {
  if (node.init != null && node.init?.type == 'CallExpression') {
    let callName = getCallExpressionName(node.init);
    if (callName.startsWith('use')) {
      callName = callName.substring(3);
    }
    return callName;
  }
  return null;
}


const formatJSXElement = (
  node: ESTree.JSXElement,
  state: State,
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

const formatJSXFragment = (
  node: ESTree.JSXFragment,
  state: State,
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

const formatJSXAttribute = (
  node: ESTree.JSXAttribute,
  state: State,
) => {
  state.write('..', node);
  // @ts-ignore `node.name` is having type issues but because we are passing it to state.generator of the node.type there will be no issue.
  state.generator[node.name.type](node.name, state);
  state.write(' = ', node);
  if (node.value != null) {
    state.generator[node.value.type](node.value, state);
  } else {
    // Usually this is a boolean attribute that doesn't require the `={true}` in the JSX
    state.write('true', node);
  }
};

const formatJSXSpreadAttribute = (
  node: ESTree.JSXSpreadAttribute,
  state: State,
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
const customGenerator = {
  ...GENERATOR,
  Program(node: ESTree.Program, state: State) {
    // Initialize state with hooks placeholder
    state.hookIdentifiers = {};
    const indent = state.indent.repeat(state.indentLevel);
    const { lineEnd, writeComments } = state;
    if (writeComments && node.comments != null) {
      formatComments(state, node.comments, indent, lineEnd);
    }
    const statements = node.body;
    const { length } = statements;
    for (let i = 0; i < length; i++) {
      const statement = statements[i];
      if (writeComments && statement.comments != null) {
        formatComments(state, statement.comments, indent, lineEnd);
      }
      state.write(indent);
      state.generator[statement.type](statement, state);
      state.write(lineEnd);
    }
    if (writeComments && node.trailingComments != null) {
      formatComments(state, node.trailingComments, indent, lineEnd);
    }
  },
  JSXElement: formatJSXElement,
  JSXFragment: formatJSXFragment,
  JSXAttribute: formatJSXAttribute,
  JSXSpreadAttribute: formatJSXSpreadAttribute,
  JSXIdentifier: function (node: ESTree.JSXIdentifier, state: State) {
    if (node.name.includes('aria-')) {
      state.write(node.name.replace('aria-', 'aria.'));
      return;
    }
    state.generator.Identifier(node, state);
  },
  JSXMemberExpression: function (node: ESTree.JSXMemberExpression, state: State) {
    state.generator.MemberExpression(node, state);
  },
  JSXNamespacedName: function (node: ESTree.JSXNamespacedName, state: State) {
    // @ts-ignore this isn't an issue because we are sending it tot the exact type it needs
    state.generator[node.namespace.type](node.namespace, state);
    state.generator[node.name.type](node.name, state);
  },
  JSXExpressionContainer: function (node: ESTree.JSXExpressionContainer, state: State) {
    state.generator[node.expression.type](node.expression, state);
  },
  JSXText: function (node: ESTree.JSXText, state: State) {
    if (node.value == null) {
      return;
    }
    state.write(`'${node.value.trim()}'`);
  },
  Literal: (node: ESTree.Literal, state: State) => {
    if (node.raw != null) {
      // Non-standard property
      state.write(node.raw, node);
    } else if (node.value == 'regex') {
      state.generator.RegExpLiteral(node, state);
    } else if (node.value == 'bigint') {
      state.write(node.value + 'n', node);
    } else {
      state.write(JSON.stringify(node.value).replaceAll('"', '\''), node);
    }
  },
  Identifier: (node: ESTree.Identifier, state: State) => {
    // Check if this identifier is a known hook and replace it
    if (
      specialFeatures.or_hooks
      && state.hookIdentifiers[state.currentFunctionComponentName]?.[node.name] != null
      && ((node?.start ?? 0) >= state.currentFunctionComponentRange[0])
      && ((node?.end ?? 0) <= state.currentFunctionComponentRange[1])
    ) {
      state.write(state.hookIdentifiers[state.currentFunctionComponentName][node.name], node);
    } else {
      state.write(node.name, node);
    }
  },

  Property: (
    node: ESTree.Property,
    state: State,
  ) => {
    if (node.method || node.kind[0] !== 'i') {
      // Either a method or of kind `set` or `get` (not `init`)
      state.generator.MethodDefinition(node, state);
    } else {
      if (!node.shorthand) {
        if (node.computed) {
          state.write('[');
          state.generator[node.key.type](node.key, state);
          state.write(']');
        } else {
          if (node.key.type == 'Identifier') state.write('\'');
          state.generator[node.key.type](node.key, state);
          if (node.key.type == 'Identifier') state.write('\'');
        }
        state.write(': ');
      }

      state.generator[node.value.type](node.value, state);
    }
  },
  ObjectExpression: (node: ESTree.ObjectExpression, state: State) => {
    const indent = state.indent.repeat(state.indentLevel++);
    const { lineEnd } = state;
    const propertyIndent = indent + state.indent;
    state.write('{');
    if (node.properties.length > 0) {
      state.write(lineEnd);
      if (writeComments && node.comments != null) {
        formatComments(state, node.comments, propertyIndent, lineEnd);
      }
      const comma = ',' + lineEnd;
      const { properties } = node,
        { length } = properties;
      for (let i = 0;;) {
        const property = properties[i];
        if (writeComments && property.comments != null) {
          formatComments(state, property.comments, propertyIndent, lineEnd);
        }
        state.write(propertyIndent);
        state.generator[property.type](property, state);
        if (++i < length) {
          state.write(comma);
        } else {
          break;
        }
      }
      state.write(lineEnd);
      if (writeComments && node.trailingComments != null) {
        formatComments(state, node.trailingComments, propertyIndent, lineEnd);
      }
      state.write(indent + '}');
    } else if (writeComments) {
      if (node.comments != null) {
        state.write(lineEnd);
        formatComments(state, node.comments, propertyIndent, lineEnd);
        if (node.trailingComments != null) {
          formatComments(state, node.trailingComments, propertyIndent, lineEnd);
        }
        state.write(indent + '}');
      } else if (node.trailingComments != null) {
        state.write(lineEnd);
        formatComments(state, node.trailingComments, propertyIndent, lineEnd);
        state.write(indent + '}');
      } else {
        state.write('}');
      }
    } else {
      state.write('}');
    }
    state.indentLevel--;
  },
  RegExpLiteral: function (node: ESTree.RegExpLiteral, state: State) {
    const { regex } = node;
    state.write(`/${regex.pattern}/${regex.flags}`, node);
  },
  ArrowFunctionExpression: (node: ESTree.ArrowFunctionExpression, state: State) => {
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
      state.generator.ObjectExpression(node.body, state);
      state.write(')');
    } else {
      state.generator[node.body.type](node.body, state);
    }
  },
  ArrayExpression: (node: ESTree.ArrayExpression, state: State) => {
    state.write('[');
    if (node.elements.length > 0) {
      const { elements } = node,
        { length } = elements;
      for (let i = 0;;) {
        const element = elements[i];
        if (element != null) {
          state.generator[element.type](element, state);
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
ArrayPattern: (node: ESTree.ArrayPattern, state: State) => {
    state.generator.ArrayExpression(node, state);
  },
CallExpression: (node: ESTree.CallExpression, state: State) => {
    // Special Case
    if (specialFeatures.or_styled && isCallExpressionNamed(node, 'styled')) {
      formatStyledCallExpression(node, state);
      return;
    }
    const precedence = state.expressionsPrecedence[node.callee.type as keyof typeof EXPRESSIONS_PRECEDENCE];
    if (
      precedence === NEEDS_PARENTHESES ||
      precedence < state.expressionsPrecedence.CallExpression
    ) {
      state.write('(');
      state.generator[node.callee.type](node.callee, state);
      state.write(')');
    } else {
      state.generator[node.callee.type](node.callee, state);
    }
    if (node.optional) {
      state.write('?.');
    }
    formatSequence(node['arguments'], state);
  },
  FunctionDeclaration: (node: ESTree.FunctionDeclaration, state: State) => {
    if (node.id != null && isCapitalized(node.id.name)) {
      if (node.start != null && node.end != null) {
        state.currentFunctionComponentRange = [node.start, node.end];
      }
      state.currentFunctionComponentName = node.id.name;
      state.hookIdentifiers[state.currentFunctionComponentName] = {};
      console.log(state.currentFunctionComponentName);
    }
    state.write(
      (node.id ? node.id.name : '') +
        (node.async ? 'async' : '') +
        (node.generator ? node.async ? '* ' : 'sync* ' : ''),
      node,
    );
    formatSequence(node.params, state);
    state.write(' ');
    if (node.body != null) state.generator[node.body.type](node.body, state);
  },
VariableDeclarator: (node: ESTree.VariableDeclarator, state: State) => {
    state.generator[node.id.type](node.id, state);
    if (node.init != null) {
      state.write(' = ');
      state.generator[node.init.type](node.init, state);
    }
  },
VariableDeclaration: (node: ESTree.VariableDeclaration, state: State) => {
    formatVariableDeclaration(node, state);
    state.write(';');
  },
};

export function jsx2OverReact(str: string): string {
  const comments: ESTree.Comment[] = [];
//   // Create a Program with an in-memory emit
//   // const createdFiles: Record<string, string> = {};
//   // const host = ts.createCompilerHost( {module: ts.ModuleKind.CommonJS, allowJs:true });
//   // host.writeFile = (fileName: string, contents: string) => createdFiles[fileName] = contents
//   const filename = "test.ts";
// const sourceFile = ts.createSourceFile(
//     filename, str, ts.ScriptTarget.Latest
// );

// const defaultCompilerHost = ts.createCompilerHost({});

// const customCompilerHost: ts.CompilerHost = {
//     getSourceFile: (name, languageVersion) => {
//         console.log(`getSourceFile ${name}`);

//         if (name === filename) {
//             return sourceFile;
//         } else {
//             return defaultCompilerHost.getSourceFile(
//                 name, languageVersion
//             );
//         }
//     },
//     writeFile: (filename, data) => {},
//     getDefaultLibFileName: () => "lib.d.ts",
//     useCaseSensitiveFileNames: () => false,
//     getCanonicalFileName: filename => filename,
//     getCurrentDirectory: () => "",
//     getNewLine: () => "\n",
//     getDirectories: () => [],
//     fileExists: () => true,
//     readFile: () => ""
// };

// const program = ts.createProgram(
//     ["test.ts"], {}, customCompilerHost
// );
// const typeChecker = program.getTypeChecker();
//   const transpiler = new ts2dart.Transpiler();
//   console.log(transpiler.translateProgram(program, customCompilerHost))
  const ast = parseScript(str, { module: true, jsx: true, ranges: true, onComment: comments });
  attachComments(ast, comments);
  console.log(ast);
  return generate(ast, { generator: customGenerator });
}

// These node types will not get any comments attached to them
const skipNodes = new Set([
  'Identifier',
])

/**
 * Attach comments to the next node after the comment's location
 * @param {Object} ast - The object returned by parse()
 * @param {Object[]} comments - The comments obtained by using
 *                              the { onComment: [] } option of parse()
 * @example
 *    const code = '// comment\n const x = 42'
 *    const comments = []
 *    const ast = meriyah.parse(code, { onComment: comments })
 *    attachComments(ast, comments)
 */
function attachComments(ast: ESTree.Program, comments: ESTree.Comment[]) {
  const nodePositions    = Array(ast.end).fill(null)
  const commentPositions = Array(ast.end).fill(null)
  // @ts-expect-error idk man...
  walk(ast, {
    enter(node: any, parent: any, prop: any, index: any) {
      if (skipNodes.has(node.type))
        return
      nodePositions[node.start] = node
    }
  })

  comments.forEach((node: any) => {
    node.comment = true
    for (let i = node.start; i < node.end; i++) {
      commentPositions[i] = node
    }
  })

  for (let i = 0; i < commentPositions.length; i++) {
    const comment = commentPositions[i]
    if (!comment)
      continue

    // Attach node
    for (; i < commentPositions.length; i++) {
      const node = nodePositions[i]
      if (!node)
        continue
      node.comment = comment
      break
    }

    // Advance until end of comment
    for (; i < commentPositions.length; i++) {
      if (comment !== commentPositions[i])
        break
    }
  }
}
