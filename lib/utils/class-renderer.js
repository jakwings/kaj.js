var clone = require('clone');
var extend = require('extend');
var helpers = require('./helpers.js');
var mergeClasses = helpers.mergeClasses;
var trim = helpers.trim;

var Renderer = function (opts) {
  var Tnode = require('./class-tnode.js');
  var BlockLexer = require('./class-blocklexer.js');
  var InlineLexer = require('./class-inlinelexer.js');
  this.options = opts;
  this._helpers = extend(clone(helpers, false), {
    clone: clone,
    extend: extend,
    options: this.options,
    renderer: this,
    Tnode: Tnode,
    InlineLexer: InlineLexer,
    BlockLexer: BlockLexer,
    Renderer: Renderer
  });
};

Renderer.escape = function (text) {
  return text ? text.replace(/["'&<>]/g, function (c) {
    switch (c) {
      case '"': return '&quot;';
      case '\'': return '&#39;';
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      default: return c;
    }
  }) : '';
};
Renderer.getAttrId = function (s) {
  return s ? (' id="' + Renderer.escape(s) + '"') : '';
};
Renderer.getAttrAny = function (attr, value) {
  if (Array.isArray(value)) {
    value = value.filter(function (v) { return v && trim(v); });
    if (attr === 'class') {
      value = value.map(function (v) {
        return v.replace(/[ \t\f]+/g, '-');
      });
    }
    value = value.join(' ');
  }
  return value ? (' ' + attr + '="' + Renderer.escape(value) + '"') : '';
};
Renderer.getElement = function (elem, attrs, text, closed, raw, isBlock) {
  if (typeof attrs !== 'object') {
    isBlock = raw;
    raw = closed;
    closed = text;
    text = attrs;
    attrs = {};
  }
  var result = '<' + elem;
  for (var k in attrs) {
    if (k === 'id') {
      result += Renderer.getAttrId(attrs[k]);
    } else {
      result += Renderer.getAttrAny(k, attrs[k]);
    }
  }
  result += '>';
  if (!closed) {
    text = text || '';
    result += (isBlock ? '\n' : '') +
        (raw ? text : Renderer.escape(text)) +
        (isBlock ? '\n' : '') + '</' + elem + '>';
  }
  return result;
};
Renderer.getBlock = function (elem, attrs, text, closed, raw) {
  return Renderer.getElement(elem, attrs, text, closed, raw, true);
};
Renderer.getSpan = function (elem, attrs, text, closed, raw) {
  return Renderer.getElement(elem, attrs, text, closed, raw, false);
};

Renderer.render = function (root, opts) {
  return (new Renderer(opts)).render(root);
};

Renderer.prototype.render = function (root) {
  this._ast = root;
  var result = '';
  var self = this;
  var extractAttrs = function (node) {
    var attrs = {};
    var keys = Object.keys(node);
    for (var i = 0, l = keys.length; i < l; i++) {
      var k = keys[i];
      if (k.charAt(0) === '$') {
        attrs[k.substr(1)] = node[k];
      }
    }
    return attrs;
  };
  root.traverse(function (node) {
    var part;
    var prefix = node.type.substr(0, 2);
    switch (prefix) {
      case 'b_':
        part = self[node.type](node, self._ast, self._helpers);
        node.parentNode._html = node.parentNode._html ?
            (node.parentNode._html + '\n' + part) : part;
        delete node._html;
        break;
      case 'i_':
        part = self[node.type](node, self._ast, self._helpers);
        node.parentNode._html = (node.parentNode._html || '') + part;
        delete node._html;
        break;
      default:
        if (/^[a-z][a-z]*$/.test(node.type)) {
          var attrs = extractAttrs(node);
          var isBlock = !node.isSpan;
          var shape = isBlock ? 'getBlock' : 'getSpan';
          if (node.text) {
            part = Renderer[shape](
                node.type, attrs, node.text || '', node.isClosed, false);
          } else {
            part = Renderer[shape](
                node.type, attrs, node._html || '', node.isClosed, true);
          }
          if (!node.parentNode) {
            result = (isBlock ? '\n' : '') + part;
            return false;
          }
          node.parentNode._html = (node.parentNode._html || '') +
              ((node.parentNode._html && isBlock) ? '\n' : '') + part;
        } else if (node.type === '_fragment_') {
          part = node._html || '';
          if (!node.parentNode) {
            result = part;
            return false;
          }
          node.parentNode._html = (node.parentNode._html || '') + part;
        } else if (node.type === '_root_') {
          //result = '<div class="kaj-doc">\n' + (node._html || '') + '\n</div>';
          result = (node._html || '').replace(/^\n+|\n+$/g, '');
        } else {
          result = node._html || '';
        }
        delete node._html;
    }
  });
  return result;
};

Renderer.prototype.b_section = function (node, root, helpers) {
  var type = (node.size === 1) ? 'div' : 'section';
  return Renderer.getBlock(type, {
    id: node.$id || node.id,
    class: mergeClasses('kaj-section', node.$class),
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_heading = function (node, root, helpers) {
  // http://www.w3.org/html/wg/drafts/html/master/sections.html#headings-and-sections
  var part = node.link ?
      Renderer.getSpan('a', {href: encodeURI(node.link)}, node.text || '') :
      Renderer.getSpan('span', node.text || '');
  var type = (node.size < 7) ? ('h' + node.size) : 'p';
  return Renderer.getSpan(type, {
    id: node.$id,
    class: mergeClasses('kaj-title', node.$class),
    style: node.$style,
    title: node.$title
  }, part, false, true);
};
Renderer.prototype.b_ul_item = function (node, root, helpers) {
  var className = '';
  switch (node.mark) {
    case '*': className = 'kaj-item-x'; break;
    case '+': className = 'kaj-item-y'; break;
    case '-': className = 'kaj-item-z'; break;
    default: break;
  }
  return Renderer.getSpan('li', {
    id: node.$id,
    class: mergeClasses(className, node.$class),
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_ul_block = function (node, root, helpers) {
  return Renderer.getBlock('ul', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_ol_item = function (node, root, helpers) {
  return Renderer.getSpan('li', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_ol_block = function (node, root, helpers) {
  return Renderer.getBlock('ol', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_lb_line = function (node, root, helpers) {
  return Renderer.getSpan('div', {
    id: node.$id,
    class: mergeClasses('kaj-line', node.$class),
    style: node.$style,
    title: node.$title
  }, node._html ? node._html : Renderer.getSpan('br', '', true), false, true);
};
Renderer.prototype.b_lb_block = function (node, root, helpers) {
  return Renderer.getBlock('div', {
    id: node.$id,
    class: mergeClasses('kaj-line-block', node.$class),
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_code = function (node, root, helpers) {
  var result;
  var highlight = this.options.highlight;
  if (highlight) {
    result = highlight(node.text, node.lang);
  }
  return Renderer.getBlock('pre', {
    id: node.$id,
    class: mergeClasses(
        node.lang && ('lang-' + node.lang), node.class, node.$class),
    style: node.$style,
    title: node.$title
  }, result ? result : node.text, false, !!result);
};
Renderer.prototype.b_oneliner = function (node, root, helpers) {
  var result;
  var highlight = this.options.highlight;
  if (highlight) {
    result = highlight(node.text, node.lang);
  }
  return Renderer.getSpan('pre', {
    id: node.$id,
    class: mergeClasses('kaj-oneliner', node.$class),
    style: node.$style,
    title: node.$title
  }, result ? result : node.text, false, !!result);
};
Renderer.prototype.b_paragraph = function (node, root, helpers) {
  if ((node.parentNode.type === 'b_ul_item') ||
      (node.parentNode.type === 'b_ol_item')) {
    if (!node.parentNode.parentNode.complex) {
      return node._html || '';
    }
  }
  return Renderer.getSpan('p', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_indented = function (node, root, helpers) {
  return Renderer.getBlock('blockquote', {
    id: node.$id,
    class: mergeClasses('kaj-indented', node.$class),
    style: node.$style,
    title: node.$title
  }, node._html || '', false, true);
};
Renderer.prototype.b_raw = function (node, root, helpers) {
  return node.text ? node.text : '';
};
Renderer.prototype.i_raw = function (node, root, helpers) {
  return node.text || '';
};
Renderer.prototype.i_text = function (node, root, helpers) {
  return Renderer.escape(node.text);
};
Renderer.prototype.i_bold = function (node, root, helpers) {
  return Renderer.getSpan('b', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node.text);
};
Renderer.prototype.i_italic = function (node, root, helpers) {
  return Renderer.getSpan('i', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node.text);
};
Renderer.prototype.i_standout = function (node, root, helpers) {
  return Renderer.getSpan('b', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, Renderer.getSpan('i', node.text), false, true);
};
Renderer.prototype.i_code = function (node, root, helpers) {
  return Renderer.getSpan('code', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node.text);
};
Renderer.prototype.i_keystroke = function (node, root, helpers) {
  return Renderer.getSpan('kbd', {
    id: node.$id,
    class: node.$class,
    style: node.$style,
    title: node.$title
  }, node.text);
};
Renderer.prototype.i_literal = function (node, root, helpers) {
  return Renderer.getSpan('span', {
    id: node.$id,
    class: mergeClasses('kaj-inline-literal', node.$class),
    style: node.$style,
    title: node.$title
  }, node.text);
};
Renderer.prototype.i_link = function (node, root, helpers) {
  if (!node.link) {
    node.link = node.text;
  } else {
    var matches;
    if (matches = /^=(\d\d*(?:\.\d\d*)*)=$/.exec(node.link)) {
      node.link = '#kaj-section-' + matches[1].replace(/\./g, '-');
    } else if (matches = /^#(.+)#$/.exec(node.link)) {
      node.link = '#kaj-anchor-def-' + matches[1];
    } else if (matches = /^~(.+)~$/.exec(node.link)) {
      node.link = /^\d\d*$/.test(matches[1]) ?
          ('#kaj-note-def-' + matches[1]) : ('#kaj-cite-def-' + matches[1]);
    }
  }
  var type = (node.link[0] === '#') ? 'internal' : 'external';
  return Renderer.getSpan('a', {
    id: node.$id,
    class: mergeClasses('kaj-link-' + type,
                        (node.link === node.text) ? 'kaj-link-raw' : null,
                        node.$class),
    style: node.$style,
    title: node.$title,
    href: encodeURI(node.link)
  }, node.text);
};
Renderer.prototype.i_anchor = function (node, root, helpers) {
  if (!node.name) { return ''; }
  return Renderer.getSpan('span', {
    id: node.$id || ('kaj-anchor-def-' + node.name),
    class: mergeClasses('kaj-anchor-def', node.$class),
    style: node.$style,
    title: node.$title
  }, '');
};
Renderer.prototype.i_pipe = function (node, root, helpers) {
  if (!node.name) { return ''; }
  return Renderer.getSpan('span', {
    id: node.$id,
    class: mergeClasses('kaj-pipe', node.$class),
    style: node.$style,
    title: node.$title
  }, node.name);
};
Renderer.prototype.i_note = function (node, root, helpers) {
  if (!node.name) { return ''; }
  if (/^\d\d*$/.test(node.name)) {
    return Renderer.getSpan('a', {
      id: node.$id,
      class: mergeClasses('kaj-note-ref', node.$class),
      style: node.$style,
      title: node.$title,
      href: '#kaj-note-def-' + node.name
    }, Renderer.getSpan('sup', node.name), false, true);
  } else {
    return Renderer.getSpan('a', {
      id: node.$id,
      class: mergeClasses('kaj-cite-ref', node.$class),
      style: node.$style,
      title: node.$title,
      href: '#kaj-cite-def-' + encodeURI(node.name)
    }, node.name);
  }
};
Renderer.prototype.i_role = function (node, root, helpers) {
  if (/^[ \t\f]*$/.test(node.name || '')) { return ''; }
  var roles = this.options.roles;
  if (roles[node.name]) {
    return roles[node.name](node, this._ast, this._helpers);
  }
  return Renderer.getSpan('span', {
    id: node.$id,
    class: mergeClasses('kaj-role-' + node.name, node.$class),
    style: node.$style,
    title: node.$title
  }, node.text);
};

module.exports = Renderer;
