import { parseScript } from "https://cdn.skypack.dev/meriyah?dts";
import {
  AssignmentPattern,
  BindingPattern,
  Expression,
  JSXAttribute,
  JSXAttributeValue,
  JSXChild,
  JSXEmptyExpression,
  JSXIdentifier,
  JSXSpreadAttribute,
  JSXTagNameExpression,
  ObjectExpression,
  ObjectLiteralElementLike,
  Program,
  Statement,
} from "https://cdn.skypack.dev/-/meriyah@v4.2.0-67KG0fIEEKBG4CkNhcI8/dist=es2019,mode=types/dist/src/estree";

// Unrelated but kind dope (found while building this): https://jsonformatter.org/json-to-dart

const indent = "  ";

export function jsx2OverReact(str: string): string {
  const parsedJsx = parseScript(str, { jsx: true });
  //console.log(JSON.stringify(parsedJsx, null, 2));
  return jsxToOverReactString(parsedJsx);
}

function jsxToOverReactString(program: Program): string {
  let output = "";
  for (const statement of program.body) {
    output += convertStatement(statement);
  }
  return output;
}
// program.body[0]
// if (el.type == '#text') {
//   return indent.repeat(depth) + `\'${el.nodeValue}\'\n`;
// }
// let childCount = 0;
// const hasProps = el.props && Object.keys(el.props).length > 0;
// let output = indent.repeat(depth) + `${hasProps ? '(' : ''}${startsWithCapital(el.type) ? el.type : 'Dom.' + el.type}()${hasProps ? '\n' : ''}`;
// if (el.props && Object.keys(el.props).length > 0) {
//   for (const prop in el.props) {
//     output += indent.repeat(depth+1) + `..${prop} = ${el.props[prop].nodeValue ? JSON.stringify(eval("("+el.props[prop].nodeValue+")")).replaceAll('"',"'") : "'"+el.props[prop]+"'"}\n`
//   }
// }
// if (el.children && el.children?.length > 0) {
//   childCount += 1;
//   output += `${hasProps ? indent.repeat(depth) + ')' : ''}(\n`;
//   for (const child in el.children) {
//     output += jsxElementToOverReactString(el.children[child], depth + 1) + (el.children.length > 1 ? ',\n' : '');
//   }
//   output += indent.repeat(depth) + ')';
// } else if (hasProps) {
//   output += indent.repeat(depth) + ')()';
// } else {
//   output += '()';
// }
// if (el.children && childCount < el.children?.length) {
//   output += ',\n';
// }
// return output;

function startsWithCapital(word: string): boolean {
  if (!word) return false;
  return word.substring(0, 1) === word.substring(0, 1).toUpperCase();
}

type JSXElement = {
  type: string;
  props?: Record<string, { type: string; nodeValue: string }>;
  children?: JSXElement[];
  nodeValue?: string;
};

function convertStatement(statement: Statement): string {
  let output = "";
  switch (statement.type) {
    case "ExpressionStatement": {
      output += convertExpression(statement.expression);
      break;
    }
    default:
      break;
  }
  return output;
}

function convertExpression(
  expression?:
    | Expression
    | JSXEmptyExpression
    | AssignmentPattern
    | BindingPattern,
  depth = 0): string {
  switch (expression?.type) {
    case "JSXElement":
    case "JSXFragment":
      return convertJSXChild(expression, depth);
    case "Identifier":
      return expression.name;
    case "Literal":
      if (typeof expression.value == 'string') {
        return `'${expression.value}'`;
      }
      return `${expression.value}`;
    case "ObjectExpression":
      return convertObjectExpression(expression);
    case "JSXExpressionContainer":
      return convertExpression(expression.expression, depth);
    default:
      return `EXPRESSION IDK: ${JSON.stringify(expression)}`;
  }
}

function convertObjectExpression(obj: ObjectExpression): string {
  let output = "{";
  let count = 0;
  for (const prop of obj.properties) {
    count++;
    output += convertObjectLiteralElementLike(prop);
    if (count < obj.properties.length){
      output += ',\n';
    }
  }
  output += "}";
  return formatValue(output);
}

function formatValue(val: string) {
  return JSON.stringify(eval("("+val+")")).replaceAll('"', "'");
}

function convertObjectLiteralElementLike(prop: ObjectLiteralElementLike) {
  switch (prop.type) {
    case "Property":
      return `'${convertExpression(prop.key)}': ${
        convertExpression(prop.value)
      }`;
    case "SpreadElement":
      return `..addAll(${prop.argument})`;
  }
}

function convertJSXChild(el: JSXChild, depth = 0): string {
  let output = "";
  switch (el.type) {
    case "JSXElement":
    case "JSXFragment": {
      const openingElement = {
        name: convertElementName(el.type == 'JSXFragment' ? 'Fragment' : el.openingElement.name),
        children: el.children,
        attributes: el.type == 'JSXElement' ? el.openingElement.attributes : [],
      };
      const hasProps = openingElement.attributes.length > 0;
      const hasChildren = el.children.length > 0;
      let childCount = 0;
      let convertedKids = [];

      output += `${indent.repeat(depth)}${hasProps ? "(" : ""}${
       openingElement.name
      }()${hasProps ? '\n' : ''}`;
      if (hasProps) {
        for (const attribute of openingElement.attributes) {
          const attributeString = `${indent.repeat(depth+1)}${convertJSXAttribute(attribute, depth+1)}\n`;
          output += attributeString.replace(/= {2,}/g, '= ');
        }
      }
      if (hasChildren) {
        childCount += 1;
        output += `${hasProps ? indent.repeat(depth) + ")" : ""}(\n`;
        convertedKids = el.children.map((child) => convertJSXChild(child, depth+1)).filter((child)=> child != '');
        for (const child of convertedKids) {
          output += child + (convertedKids.length > 1 ? ',\n' : '');
        }
        output += indent.repeat(depth) + ")";
      } else if (hasProps) {
        output += indent.repeat(depth) + ')()';
      } else {
        output += '()';
      }
      if (hasChildren && childCount < convertedKids.length) {
        output += ',\n';
      }
      break;
    }
    case "JSXText": {
      const cleanedString = cleanString(el.value);
      if (cleanedString != '' && cleanedString != '\n') {
         output += indent.repeat(depth) + cleanedString + '\n';
      }
      break;
    }
    default:
      break;
  }
  return output.replace(/\)( {2,})\)/g, ')\n$1)').replace(/^,(\r\n|\n|\r)/gm, "");
}

function cleanString(str: string): string {
  const trimmedString = str.trim();
  if (trimmedString.replace(/(\r\n|\n|\r)/gm, "") == "") {
    return "";
  } else {
    return `'${trimmedString.replaceAll("'", "\\'")}'`;
  }
}

function convertJSXAttributeValue(value: JSXAttributeValue, depth = 0): string {
  if (value == null) return "null";
  switch (value.type) {
    case "Literal":
      if (isString(value.value)) {
        return cleanString(value.value);
      }
      break;
    case "JSXElement":
    case "JSXExpressionContainer":
    case "JSXFragment":
      return `${convertExpression(value, depth)}`;
  }
  return `${value}`;
}

function convertJSXAttribute(attr: JSXAttribute | JSXSpreadAttribute, depth = 0): string {
  switch (attr.type) {
    case "JSXAttribute":
      return `..${convertName(attr.name.name)} = ${
        convertJSXAttributeValue(attr.value, depth)
      }`;
    default:
      return "";
  }
}

function convertElementName(
  name: string | JSXIdentifier | JSXTagNameExpression,
): string {
  const convertedName = convertName(name);
  if (startsWithCapital(convertedName)) {
    return convertedName;
  }
  return `Dom.${convertedName}`;
}

function convertName(
  name: string | JSXIdentifier | JSXTagNameExpression,
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
        return `${convertName(name.namespace)}.${convertName(name)}`;
    }
  }
  return `${name}`;
}

// deno-lint-ignore no-explicit-any
function isString(value: any): value is string {
  return typeof value === "string" || value instanceof String;
}
