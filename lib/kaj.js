// TODO: add syntax checker

var clone = require('clone');
var extend = require('extend');
var helpers = require('./utils/helpers.js');
var roles = require('./utils/roles.js');
var directives = require('./utils/directives.js');
var Renderer = require('./utils/class-renderer.js');
var BlockLexer = require('./utils/class-blocklexer.js');
var InlineLexer = require('./utils/class-inlinelexer.js');
var Tnode = require('./utils/class-tnode.js');

var fs = require('fs');
var path = require('path');

//var applyDirectiveInclude = function (src, opts) {
//  // Directive @include START
//  var name = '@include';
//  var iDirectives = opts.directives.immediate;
//  var directive = iDirectives[name];
//  if (typeof directive === 'function') {
//    var quotemeta = function (str) {
//      return str.replace(/([.\\+*?\^\[\]$(){}])/g, '\\$1');
//    };
//    var names = [];
//    for (var k in iDirectives) {
//      if (Object.prototype.hasOwnProperty.call(iDirectives, k)) {
//        if (iDirectives[k] === directive) {
//          names.push(k);
//        }
//      }
//    }
//    var regex = new RegExp('^.. (?:' + names.map(function (s) {
//      return quotemeta(s);
//    }).join('|') + ')\\{[^{}]*\\}(.*)$', 'gm');
//    src = src.replace(regex, function (match, filePath) {
//      filePath = helpers.trim(filePath);
//      filePath = path.resolve(opts.cwd, filePath);
//      return '..\n' + kaj.readFileSync(filePath) + '\n..';
//    });
//  }
//  // Directive @include END
//  return src;
//};

var kaj = function (src, opts) {
  var options = clone(opts ? opts : kaj.options);
  //return Renderer.render(
  //    BlockLexer.lex(applyDirectiveInclude(src, options), options), options);
  return Renderer.render(BlockLexer.lex(src, options), options);
};
kaj.lex = function (src, opts) {
  var options = opts ? opts : clone(kaj.options);
  //return BlockLexer.lex(applyDirectiveInclude(src, options), options);
  return BlockLexer.lex(src, options);
};
kaj.render = function (ast, opts) {
  var options = opts ? opts : clone(kaj.options);
  return Renderer.render(ast, options);
};

kaj.InlineLexer = InlineLexer;
kaj.BlockLexer = BlockLexer;
kaj.Renderer = Renderer;
kaj.Tnode = Tnode;

kaj.setDirective = function (queue, name, callback) {
  if (!name || /^[ \t\f]|[ \t\f]$/.test(name) || /[{}]/.test(name)) {
    throw new Error('Directive name is invalid.');
  }
  if (queue !== 'before' && queue !== 'immediate' && queue !== 'after') {
    throw new Error('Directive queue is invalid.');
  }
  var directives = kaj.options.directives;
  var queue = directives[queue];
  if ((queue === 'before' &&
        (directives['immediate'][name] || directives['after'][name])) ||
      (queue === 'immediate' &&
        (directives['before'][name] || directives['after'][name])) ||
      (queue === 'after' &&
        (directives['before'][name] || directives['immediate'][name]))) {
    throw new Error('Directive ' + name + ' exists in other queue.');
  }
  var type = typeof callback;
  if (type === 'string') {
    queue[name] = queue[callback];  // alias
  } else if (type === 'function') {
    queue[name] = callback;
  } else {
    delete queue[name];
  }
};
kaj.setRole = function (name, callback) {
  if (!name || /^[ \t\f~]|[ \t\f~]$/.test(name || '')) {
    throw new Error('Role name is invalid.');
  }
  var type = typeof callback;
  if (type === 'string') {
    kaj.options.roles[name] = kaj.options.roles[callback];  // alias
  } else if (type === 'function') {
    kaj.options.roles[name] = callback;
  } else {
    delete kaj.options.roles[name];
  }
};

kaj.options = {
  directives: directives,
  roles: roles,
  highlight: null,  // @type function(code:string, lang:string): {(string|false)}
  cwd: './'
};

kaj.readFileSync = function (filePath) {
  if (!filePath) { return ''; }
  filePath = path.resolve(kaj.options.cwd, filePath);
  if (!fs.existsSync(filePath)) { return ''; }
  return fs.readFileSync(filePath, {encoding: 'utf8'}) || '';
};

//kaj.setDirective('immediate', '@include', function (node, root, helpers) {
//  node.parentNode.removeNode(node);
//});

kaj.setDirective('immediate', '@include', function (node, root, helpers) {
  var filePath = helpers.ltrimTextBlock(node.text);
  if (!filePath) {
    node.parentNode.removeNode(node);
    return;
  }
  filePath = path.resolve(helpers.options.cwd, filePath);
  if (!fs.existsSync(filePath)) {
    node.parentNode.removeNode(node);
    return;
  }
  var src = fs.readFileSync(filePath, {encoding: 'utf8'}) || '';
  var opts = helpers.clone(helpers.options);
  for (var k in opts.directives.before) {
    if (k[0] === '#') {
      delete opts.directives.before[k];
    }
  }
  var lexer = new helpers.BlockLexer(opts);
  lexer.ast = node.parentNode;
  node.parentNode.removeNode(node);
  lexer.lex(src, lexer.options);
  while (lexer.lines.length) {
    if (lexer.ast.parentNode) {
      lexer.ast = lexer.ast.parentNode;
      lexer.lex(lexer.lines.join('\n'), lexer.options);
    } else {
      break;
    }
  }
});

kaj.setDirective('immediate', '@embed', function (node, root, helpers) {
  var filePath = helpers.ltrimTextBlock(node.text);
  if (!filePath) {
    node.parentNode.removeNode(node);
    return;
  }
  filePath = path.resolve(helpers.options.cwd, filePath);
  if (!fs.existsSync(filePath)) {
    node.parentNode.removeNode(node);
    return;
  }
  var opts = node.opts;
  var className = opts.class;
  if (className) {
    className = className.split(/[ \t\f]+/);
  }
  var src = fs.readFileSync(filePath, {encoding: 'utf8'}) || '';
  var newNode = helpers.BlockLexer.lex(src, helpers.options);
  newNode.type = 'div';
  newNode.$id = opts.id;
  newNode.$class = helpers.mergeClasses('kaj-doc-embedded', className);
  newNode.$style = opts.style;
  node.parentNode.replaceNode(node, new helpers.Tnode({
    type: 'b_raw',
    text: helpers.Renderer.render(newNode, helpers.options)
  }));
});

module.exports = kaj;
