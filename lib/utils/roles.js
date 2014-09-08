module.exports = {

  /**
   * helpers = {
   *   options: kaj.options,
   *   Tnode: kaj.Tnode,
   *   BlockLexer: kaj.BlockLexer,
   *   InlineLexer: kaj.InlineLexer,
   *   renderer: (renderer),
   *   Renderer: kaj.Renderer,
   *   ltrimTextBlock: ltrimTextBlock,
   *   rtrimTextBlock: rtrimTextBlock,
   *   mergeClasses: mergeClasses,
   *   parseOptions: parseOptions,
   *   throwError: throwError,
   *   getIndent: getIndent,
   *   trim: trim,
   *   pad: pad
   * }
   */
  general: function (node, root, helpers) {
    return helpers.Renderer.getSpan('span', {
      id: node.$id,
      class: helpers.mergeClasses('kaj-general', node.$class),
      style: node.$style,
      title: node.$title
    }, helpers.trim(node.text));
  //},

  //email: function (node, root, helpers) {
  //  return helpers.Renderer.getSpan('span', {
  //    id: node.$id,
  //    class: helpers.mergeClasses('kaj-role-email', node.$class),
  //    style: (node.$style ? (node.$style + ';') : '') +
  //        'unicode-bidi:bidi-override;direction:rtl',
  //    title: node.$title
  //  }, helpers.trim(node.text).split('').reverse().join(''));
  //},
  //ruby: function (node, root, helpers) {
  //  var index = node.text.indexOf('~');
  //  var Renderer = helpers.Renderer;
  //  if (index >= 0) {
  //    return Renderer.getSpan('ruby', {
  //      id: node.$id,
  //      class: node.$class,
  //      style: node.$style,
  //      title: node.$title
  //    }, Renderer.escape(helpers.trim(node.text.substr(0, index))) +
  //        Renderer.getSpan('rp', '（') +
  //        Renderer.getSpan('rt', helpers.trim(node.text.substr(index + 1))) +
  //        Renderer.getSpan('rp', '）'),
  //    false, true);
  //  } else {
  //    return Renderer.getSpan('ruby', helpers.trim(node.text));
  //  }
  //},
  //latex: function (node, root, helpers) {
  //    var preview = helpers.Renderer.getSpan('span', {
  //      type: 'code',
  //      id: node.$id,
  //      class: helpers.mergeClasses('MathJax_Preview', node.$class),
  //      style: node.$style,
  //      title: node.$title
  //    }, node.text);
  //    return preview + helpers.Renderer.getSpan('script', {
  //      type: 'math/tex',
  //      class: 'kaj-role-latex'
  //    }, node.text);
  //  });
  }

};
