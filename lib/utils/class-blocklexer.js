var clone = require('clone');
var extend = require('extend');
var helpers = require('./helpers.js');
var parseOptions = helpers.parseOptions;
var throwError = helpers.throwError;
var getIndent = helpers.getIndent;
var trim = helpers.trim;
var pad = helpers.pad;

var Tnode = require('./class-tnode.js');

var BlockLexer = function (opts) {
  var InlineLexer = require('./class-inlinelexer.js');
  var Renderer = require('./class-renderer.js');
  this.options = opts;
  this._inlineLexer = new InlineLexer(opts);
  this._helpers = extend(clone(helpers, false), {
    clone: clone,
    extend: extend,
    options: this.options,
    blockLexer: this,
    inlineLexer: this._inlineLexer,
    Tnode: Tnode,
    InlineLexer: InlineLexer,
    BlockLexer: BlockLexer,
    Renderer: Renderer
  });
  this.lines = [];
  this.ast = new Tnode({type: '_root_'}, true);
  this._markers = {
    'b_section': /^(==*)(.*)/,
    'b_ul_item': /^([*+\-]) (.*)/,
    'b_ol_item': /^#(\d\d*(?:\.\d\d*)*) (.*)/,
    'b_lb_line': /^\|(?: (.*)|$)/,
    'b_code': /^~\/\/([^ \t\f]*)(.*)/,
    'b_oneliner': /^~\/ (.*)/,
    'b_directive': /^\.\.(?: ([^ \t\f\{]+)\{([^{}]*)\}(.*)| (.*)|$)/,
    'b_paragraph': null
  };
  this._directives = {};
  this._directiveQueues = {
    'before': [],  // before inline-lexing
    'after': []    // after inline-lexing
  };
  for (var state in opts.directives) {
    var directives = opts.directives[state];
    for (var name in directives) {
      this.registerDirective(state, name, directives[name]);
    }
  }
  var directiveSection = this.getDirective('#section');
  if (directiveSection) {
    this.scheduleDirective(directiveSection);
  }
};

BlockLexer.lex = function (src, opts) {
  return (new BlockLexer(opts)).lex(src);
};

BlockLexer.prototype.lex = function (src) {
  this.lines = src.split(/(?:\n|\r\n?)/);
  var lastIndex = this.tokenize(this.ast, 0, 0);
  this.lines.splice(0, lastIndex);
  this.executeDirective('before');
  var inlineLexer = this._inlineLexer;
  this.ast.traverse(function (node) {
    if (/^(?:b_paragraph|b_lb_line|_fragment_)$/.test(node.type)) {
      inlineLexer.lex(node);
    }
  });
  this.executeDirective('after');
  return this.ast;
};

BlockLexer.prototype.tokenize = function (root, row, indent, type) {
  var lines = this.lines;
  var markers = this._markers;
  var node;
  for (var i = row, l = lines.length; i < l; i++) {
    var line = lines[i];
    var lineIndent = getIndent(line);
    if (lineIndent === false) {
      if (type !== 'i_text') {
        continue;  // ignore blank lines
      }
    } else if (lineIndent < indent) {
      return i;
    } else if (lineIndent > indent) {
      if (type !== 'i_text') {
        if (!type) {
          node = new Tnode({type: 'b_indented'}, true);
          node.parentNode = root;
          i = this.tokenize(node, i, lineIndent) - 1;
          root.addNode(node);
          continue;
        } else {
          return i;
        }
      }
    }
    line = line.substr(indent);

    if (type === 'i_text') {
      root.addNode(new Tnode({type: 'i_text', text: line}));
      continue;
    }

    LOOP_MARKER:
    for (var markerName in markers) {
      var marker = markers[markerName];
      var matches = null;
      switch (markerName) {

        case 'b_section':
          if (matches = marker.exec(line)) {
            var sectTitle = trim(matches[2]).replace(/ *==*$/, '');
            if ((matches[2][0] !== ' ') && sectTitle) {
              break;
            }
            if (type && (markerName !== type)) { return i; }
            var sectSize = matches[1].length;
            if (sectTitle) {
              if ((root.type === markerName) && (root.size >= sectSize)) {
                return i;
              }
              node = new Tnode({
                type: markerName,
                size: sectSize
              }, true);
              node.addNode(new Tnode({
                type: 'b_heading',
                size: sectSize,
                text: sectTitle
              }));
              node.parentNode = root;
              i = this.tokenize(node, i + 1, indent) - 1;
              if ((root.type === markerName) && (sectSize - root.size > 1)) {
                sectSize = sectSize - 1;
                while (sectSize > root.size) {
                  node = new Tnode({
                    type: markerName,
                    size: sectSize
                  }, node);
                  sectSize = sectSize - 1;
                }
              } else if ((root.type !== markerName) && (sectSize > 1)) {
                sectSize = sectSize - 1;
                while (sectSize > 0) {
                  node = new Tnode({
                    type: markerName,
                    size: sectSize
                  }, node);
                  sectSize = sectSize - 1;
                }
              }
              root.addNode(node);
            } else {
              if ((root.type === markerName) && (root.size > sectSize)) {
                return i;
              }
            }
            break LOOP_MARKER;
          }
          break;

        case 'b_ul_item':
          if (matches = marker.exec(line)) {
            if (type && (markerName !== type)) { return i; }
            if (root.type === 'b_ul_block') {
              node = new Tnode({
                type: markerName,
                mark: matches[1]
              }, true);
              var ulIndent = 2;
              var ulIndex = i;
              this.lines[ulIndex] = pad(indent + ulIndent) + matches[2];
              node.parentNode = root;
              i = this.tokenize(node, i, indent + ulIndent) - 1;
              this.lines[ulIndex] = pad(indent) + line;
              if (node.childNodes.length > 1) {
                root.complex = true;
              }
            } else {
              node = new Tnode({type: 'b_ul_block'}, true);
              node.parentNode = root;
              i = this.tokenize(node, i, indent, markerName) - 1;
            }
            root.addNode(node);
            break LOOP_MARKER;
          }
          break;

        case 'b_ol_item':
          if (matches = marker.exec(line)) {
            if (type && (markerName !== type)) { return i; }
            if (root.type === 'b_ol_block') {
              node = new Tnode({
                type: markerName,
                mark: matches[1]
              }, true);
              var olIndent = matches[1].length + 2;
              var olIndex = i;
              this.lines[olIndex] = pad(indent + olIndent) + matches[2];
              node.parentNode = root;
              i = this.tokenize(node, i, indent + olIndent) - 1;
              this.lines[olIndex] = pad(indent) + line;
              if (node.childNodes.length > 1) {
                root.complex = true;
              }
            } else {
              node = new Tnode({type: 'b_ol_block'}, true);
              node.parentNode = root;
              i = this.tokenize(node, i, indent, markerName) - 1;
            }
            root.addNode(node);
            break LOOP_MARKER;
          }
          break;

        case 'b_lb_line':
          if (matches = marker.exec(line)) {
            if (type && (markerName !== type)) { return i; }
            if (root.type === 'b_lb_block') {
              node = new Tnode({
                type: markerName,
                text: trim(matches[1] || '')
              });
            } else {
              node = new Tnode({type: 'b_lb_block'}, true);
              node.parentNode = root;
              i = this.tokenize(node, i, indent, markerName) - 1;
            }
            root.addNode(node);
            break LOOP_MARKER;
          }
          break;

        case 'b_code':
          if (matches = marker.exec(line)) {
            if (type && (markerName !== type)) { return i; }
            node = new Tnode({
              type: markerName,
              lang: matches[1],
              class: trim(matches[2])
            }, true);
            node.parentNode = root;
            i = this.tokenize(node, i + 1, indent + 3, 'i_text') - 1;
            node.text = node.getTextFromNodes('text', '\n');
            node.childNodes = null;
            root.addNode(node);
            break LOOP_MARKER;
          }
          break;

        case 'b_oneliner':
          if (matches = marker.exec(line)) {
            if (type && (markerName !== type)) { return i; }
            node = new Tnode({
              type: markerName,
              text: matches[1]
            });
            root.addNode(node);
            break LOOP_MARKER;
          }
          break;

        case 'b_directive':
          if (matches = marker.exec(line)) {
            if (type && (markerName !== type)) { return i; }
            var directiveName = matches[4] ? 'comment' : (matches[1] || '');
            if (directiveName) {
              var directive = this.getDirective(directiveName);
              if (!directive) {
                throwError('Directive "' + directiveName + '" does not exist.');
              }
              if (this.isSameDirective(directiveName, 'header') ||
                  this.isSameDirective(directiveName, 'footer')) {
                if (root.type === 'b_section') {
                  return i;
                }
              }
              node = new Tnode({
                type: markerName,
                row: i,
                indent: indent,
                queue: directive.queue,
                name: directiveName,
                args: trim(matches[2] || ''),
                text: trim(matches[3] || matches[4] || '')
              }, true);
              if (directiveName === 'comment') {
                if (matches[4]) {
                  node.args = 'true';
                  node.isImplicitComment = true;
                }
              }
              i = this.tokenize(node, i + 1, indent + 3, 'i_text') - 1;
              directive = this.setupDirective(directive, node);
              root.addNode(node);
              if (directive.queue === 'immediate') {
                this.executeDirective(directive);
              } else {
                this.scheduleDirective(directive);
              }
            }
            break LOOP_MARKER;
          }
          break;

        case 'b_paragraph':
          if (type && (markerName !== type)) { return i; }
          node = new Tnode({
            type: markerName,
            text: trim(line)
          });
          root.addNode(node);
          break LOOP_MARKER;

        default:
          throw new Error(
              'Block element "' + markerName + '" does not have a handler.');
      }
    }
  }
  return i;
};

BlockLexer.prototype.setupDirective = function (directive, node) {
  var data = {};
  if (node.childNodes && node.childNodes.length) {
    data = parseOptions(node.getTextFromNodes('text', '\n'));
  }
  if (node.text && data.normalText) {
    if ((directive.name !== 'comment') || !node.isImplicitComment) {
      throwError('Each directive can not have more than one body.');
    }
  }
  if (directive.name !== 'comment') {
    if (!data.normalText) {
      node.isOneliner = true;
    } else {
      node.text = data.normalText;
    }
  } else {
    node.text = node.text + (data.normalText ? ('\n' + data.normalText) : '');
  }
  node.opts = data.options || {};
  node.childNodes = null;
  var newDirective = {
    queue: directive.queue,
    action: directive.action.bind(null),
    node: node
  };
  return newDirective;
};

BlockLexer.prototype.getDirective = function (name) {
  return this._directives[name] || null;
};

BlockLexer.prototype.isSameDirective = function (nameA, nameB) {
  return this._directives[nameA].action === this._directives[nameB].action;
};

BlockLexer.prototype.registerDirective = function (queue, name, callback) {
  this._directives[name] = {
    name: name,
    queue: queue,
    action: callback
  };
};

BlockLexer.prototype.scheduleDirective = function (directive) {
  if (directive.queue === 'before') {
    this.setupDirective(directive, new Tnode({type: '#directive'}));
  }
  this._directiveQueues[directive.queue].push(directive);
};

BlockLexer.prototype.executeDirective = function (obj) {
  if (typeof obj === 'string') {
    var queue = this._directiveQueues[obj];
    for (var i = 0, l = queue.length; i < l; i++) {
      this.executeDirective(queue[i]);
    }
  } else {
    obj.action(obj.node, this.ast, this._helpers);
  }
};

module.exports = BlockLexer;
