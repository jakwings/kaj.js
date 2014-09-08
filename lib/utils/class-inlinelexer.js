var throwError = require('./helpers.js').throwError;
var trim = require('./helpers.js').trim;

var Tnode = require('./class-tnode.js');

var InlineLexer = function (opts) {
  this.options = opts;
  this._markers = {
    'i_bold':       ['{*', '*}'],
    'i_italic':     ['{/', '/}'],
    'i_standout':   ['{%', '%}'],
    'i_code':       ['{`', '`}'],
    'i_keystroke':  ['{:', ':}'],
    'i_literal':    ['``', '``'],
    'i_link':       ['[[', ']]'],
    'i_raw':        ['{{', '}}'],
    'i_role':       ['{~', '~}'],
    'i_note':       ['{[', ']}'],
    'i_anchor':     ['{#', '#}'],
    'i_pipe':       ['{|', '|}']
  };
  this._markerNames = [
    'i_bold', 'i_italic', 'i_standout', 'i_code', 'i_keystroke', 'i_literal',
    'i_link', 'i_raw', 'i_role', 'i_note', 'i_anchor', 'i_pipe'];
};

InlineLexer.lex = function (node, opts) {
  return (new InlineLexer(opts)).lex(node);
};

InlineLexer.prototype.lex = function (node) {
  if (node.childNodes || !('text' in node)) {
    return;
  }
  node.childNodes = [];
  var markers = this._markers;
  var markerNames = this._markerNames;
  var src = node.text || '';
  var chunk = '';
  while (src) {
    var step = 1;  // prefers code points, than code units
    LOOP_MARKER:
    for (var i = 0, l = markerNames.length; i < l; i++) {
      var markerName = markerNames[i];
      var marker = markers[markerName];
      var markerLeftIndex = marker[0].length;
      if (src.substr(0, markerLeftIndex) !== marker[0]) {
        continue;
      }
      var markerRightIndex = src.indexOf(marker[1], markerLeftIndex);
      if (markerRightIndex < 0) {
        throwError(
            'Inline markup "' + marker[0] + '" without "' + marker[1] + '".');
      }
      var text = src.substring(markerLeftIndex, markerRightIndex);
      if (chunk) {
        node.addNode(new Tnode({type: 'i_text', text: chunk}));
        chunk = '';
      }
      step = marker[0].length + text.length + marker[1].length;
      switch (markerName) {

        case 'i_bold':
        case 'i_italic':
        case 'i_standout':
        case 'i_literal':
          node.addNode(new Tnode({type: markerName, text: trim(text)}));
          break LOOP_MARKER;

        case 'i_code':
        case 'i_keystroke':
        case 'i_raw':
          node.addNode(new Tnode({type: markerName, text: text}));
          break LOOP_MARKER;

        case 'i_link':
          var matches = /^(.*?)(?:\|(.*))?$/.exec(text);
          node.addNode(new Tnode({
            type: markerName,
            text: trim(matches[1]),
            link: trim(matches[2] || '')
          }));
          break LOOP_MARKER;

        case 'i_role':
          var index = text.indexOf('~');
          node.addNode(new Tnode({
            type: markerName,
            name: (index < 0) ? 'general' : trim(text.substr(0, index)),
            text: (index < 0) ? text : text.substr(index + 1)
          }));
          break LOOP_MARKER;

        case 'i_note':
        case 'i_anchor':
        case 'i_pipe':
          node.addNode(new Tnode({type: markerName, name: trim(text)}));
          break LOOP_MARKER;

        default:
          throw new Error(
              'Span element "' + markerName + '" does not have a handler.');
      }
    }
    if (step === 1) {
      var spaceCount;
      for (spaceCount = 0; src[spaceCount] === ' '; spaceCount++) { ; }
      if (spaceCount > 0) {
        node.addNode(new Tnode({type: 'i_text', text: ' '}));
        chunk = '';
        src = src.substr(spaceCount);
      } else {
        chunk += src[0];
        src = src.substr(1);
        if (!src || (src[0] === ' ')) {
          node.addNode(new Tnode({type: 'i_text', text: chunk}));
          chunk = '';
        }
      }
    } else {
      src = src.substr(step);
    }
  }
  if (!node.text) {
    node.addNode(new Tnode({type: 'i_text', text: ''}));
    chunk = '';
  }
  delete node.text;
};

module.exports = InlineLexer;
