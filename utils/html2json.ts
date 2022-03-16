import HTMLParser from "./html5parser.js";

const DEBUG = false;
let debug = DEBUG ? console.log.bind(console) : function () {};

function q(v: string) {
  return '"' + v + '"';
}

function removeDOCTYPE(html: string) {
  return html
    .replace(/<\?xml.*\?>\n/, "")
    .replace(/<!doctype.*\>\n/, "")
    .replace(/<!DOCTYPE.*\>\n/, "");
}

const html2json = function html2json(html: string) {
  html = removeDOCTYPE(html);
  const bufArray: any[] = [];
  let results = {
    node: "root",
    child: [] as any[],
  };

  HTMLParser(html, {
    start: function (tag: string, attrs: any, unary: any) {
      debug(tag, attrs, unary);
      // node for this element
      let node = {
        node: "element",
        tag: tag,
        attr: [],
      };
      if (attrs.length !== 0) {
        node.attr = attrs.reduce(
          function (
            pre: { [x: string]: any },
            attr: { name: any; value: any },
          ) {
            let name = attr.name;
            let value = attr.value;

            // has multi attibutes
            // make it array of attribute
            if (value.match(/ /)) {
              value = value.split(" ");
            }

            // if attr already exists
            // merge it
            if (pre[name]) {
              if (Array.isArray(pre[name])) {
                // already array, push to last
                pre[name].push(value);
              } else {
                // single value, make it array
                pre[name] = [pre[name], value];
              }
            } else {
              // not exist, put it
              pre[name] = value;
            }

            return pre;
          },
          {},
        );
      }
      if (unary) {
        // if this tag dosen't have end tag
        // like <img src="hoge.png"/>
        // add to parents
        let parent = bufArray[0] || results;
        if (parent.child === undefined) {
          parent.child = [];
        }
        parent.child.push(node);
      } else {
        bufArray.unshift(node);
      }
    },
    end: function (tag: any) {
      debug(tag);
      // merge into parent tag
      const node = bufArray.shift();
      if (node.tag !== tag) console.error("invalid state: mismatch end tag");

      if (bufArray.length === 0) {
        results.child.push(node);
      } else {
        let parent = bufArray[0];
        if (parent.child === undefined) {
          parent.child = [];
        }
        parent.child.push(node);
      }
    },
    chars: function (text: any) {
      debug(text);
      let node = {
        node: "text",
        text: text,
      };
      if (bufArray.length === 0) {
        results.child.push(node);
      } else {
        let parent = bufArray[0];
        if (parent.child === undefined) {
          parent.child = [];
        }
        parent.child.push(node);
      }
    },
    comment: function (text: any) {
      debug(text);
      let node = {
        node: "comment",
        text: text,
      };
      let parent = bufArray[0];
      if (parent.child === undefined) {
        parent.child = [];
      }
      parent.child.push(node);
    },
  });
  return results;
};

const json2html = function json2html(
  json: {
    child: any[];
    attr: { [x: string]: any };
    node: string;
    tag: string;
    text: string;
  },
) {
  // Empty Elements - HTML 4.01
  let empty = [
    "area",
    "base",
    "basefont",
    "br",
    "col",
    "frame",
    "hr",
    "img",
    "input",
    "isindex",
    "link",
    "meta",
    "param",
    "embed",
  ];

  let child = "";
  if (json.child) {
    child = json.child.map(function (c: any) {
      return json2html(c);
    }).join("");
  }

  let attr = "";
  if (json.attr) {
    attr = Object.keys(json.attr).map(function (key) {
      let value = json.attr[key];
      if (Array.isArray(value)) value = value.join(" ");
      return key + "=" + q(value);
    }).join(" ");
    if (attr !== "") attr = " " + attr;
  }

  if (json.node === "element") {
    let tag = json.tag;
    if (empty.indexOf(tag) > -1) {
      // empty element
      return "<" + json.tag + attr + "/>";
    }

    // non empty element
    let open = "<" + json.tag + attr + ">";
    let close = "</" + json.tag + ">";
    return open + child + close;
  }

  if (json.node === "text") {
    return json.text;
  }

  if (json.node === "comment") {
    return "<!--" + json.text + "-->";
  }

  if (json.node === "root") {
    return child;
  }
};

export default html2json;
