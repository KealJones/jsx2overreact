import JSXParser from 'https://cdn.skypack.dev/jsx-parser?dts';

// Unrelated but kind dope (found while building this): https://jsonformatter.org/json-to-dart

const indent = '  ';

export function jsx2OverReact(str: string): string {
  const parsedJsx = JSXParser(str, false);
  return parsedJsx.map((el: JSXElement) =>jsxElementToOverReactString(el));
}


function jsxElementToOverReactString(el: JSXElement, depth = 0): string {
  if (el.type == '#text') {
    return indent.repeat(depth) + `\'${el.nodeValue}\'\n`;
  }
  let childCount = 0;
  const hasProps = el.props && Object.keys(el.props).length > 0;
  let dartOutput = indent.repeat(depth) + `${hasProps ? '(' : ''}${startsWithCapital(el.type) ? el.type : 'Dom.' + el.type}()${hasProps ? '\n' : ''}`;
  if (el.props && Object.keys(el.props).length > 0) {
    for (const prop in el.props) {
      dartOutput += indent.repeat(depth+1) + `..${prop} = ${el.props[prop].nodeValue ? JSON.stringify(eval("("+el.props[prop].nodeValue+")")).replaceAll('"',"'") : "'"+el.props[prop]+"'"}\n`
    }
  }
  if (el.children && el.children?.length > 0) {
    childCount += 1;
    dartOutput += `${hasProps ? indent.repeat(depth) + ')' : ''}(\n`;
    for (const child in el.children) {
      dartOutput += jsxElementToOverReactString(el.children[child], depth + 1) + (el.children.length > 1 ? ',\n' : '');
    }
    dartOutput += indent.repeat(depth) + ')';
  } else if (hasProps) {
    dartOutput += indent.repeat(depth) + ')()';
  } else {
    dartOutput += '()';
  }
  if (el.children && childCount < el.children?.length) {
    dartOutput += ',\n';
  }
  return dartOutput;
}

function startsWithCapital(word: string):boolean {
  if (!word) return false;
  return word.substring(0, 1) === word.substring(0, 1).toUpperCase()
}

type JSXElement = {
  type: string;
  props?: Record<string, {type: string, nodeValue: string}>;
  children?: JSXElement[];
  nodeValue?: string;
}