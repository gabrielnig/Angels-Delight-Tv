/**
 * Flags literal user facing text in files that are wired to the message catalog (M34-S04 AC2). Copy belongs in
 * packages/shared/src/messages/en-ng.ts and is read with msg('key'). The rule looks at:
 *  - JSX text with letters,
 *  - JSX attributes that a person reads or hears (aria-label, title, placeholder, alt, aria-description),
 *  - plain strings that read like a sentence: a capital letter first and at least two words.
 * Strings inside msg(...) calls, import and export sources, and the `allow` option are ignored.
 * The rule is switched on per file in eslint.config.js, so files not yet moved over stay quiet.
 */
const READ_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'aria-description']);
/** Object keys that hold words a person reads, so a single capitalised word there is copy as well. */
const LABEL_KEYS = new Set(['label', 'title', 'hint', 'description', 'text', 'heading']);
const SENTENCE = /^[A-Z][A-Za-z0-9'’,.:;?!%(){}\-/ ]*\s[A-Za-z0-9'’,.:;?!%(){}\-/ ]+$/;

export default {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      copy: 'Move this text to the message catalog and read it with msg(). Allowlist exact text in eslint.config.js only when it is not copy.',
    },
  },
  create(context) {
    const allow = new Set(context.options[0]?.allow ?? []);
    const report = (node, text) => {
      if (!allow.has(text.trim())) context.report({ node, messageId: 'copy' });
    };
    const insideMsg = (node) =>
      node.parent?.type === 'CallExpression' &&
      node.parent.callee.type === 'Identifier' &&
      node.parent.callee.name === 'msg';
    /** One word literals: the branches of a ternary inside aria-label and friends, or a label like property. */
    const readByPerson = (node) => {
      let cursor = node;
      while (
        cursor.parent &&
        (cursor.parent.type === 'ConditionalExpression' ||
          cursor.parent.type === 'LogicalExpression') &&
        cursor.parent.test !== cursor
      )
        cursor = cursor.parent;
      const holder = cursor.parent;
      if (holder?.type === 'JSXExpressionContainer' && holder.parent?.type === 'JSXAttribute')
        return READ_ATTRS.has(holder.parent.name.name) && /[A-Za-z]/.test(node.value);
      return (
        holder?.type === 'Property' &&
        holder.value === cursor &&
        holder.key.type === 'Identifier' &&
        LABEL_KEYS.has(holder.key.name) &&
        /^[A-Z]/.test(node.value)
      );
    };
    return {
      JSXText(node) {
        if (/[A-Za-z]/.test(node.value)) report(node, node.value);
      },
      Literal(node) {
        if (typeof node.value !== 'string' || insideMsg(node)) return;
        const parent = node.parent;
        if (
          parent.type === 'ImportDeclaration' ||
          parent.type === 'ExportAllDeclaration' ||
          parent.type === 'ExportNamedDeclaration' ||
          parent.type === 'ImportExpression' ||
          parent.type === 'TSLiteralType' ||
          parent.type === 'TSImportType' ||
          (parent.type === 'ExpressionStatement' && parent.directive)
        )
          return;
        if (parent.type === 'JSXAttribute') {
          if (READ_ATTRS.has(parent.name.name) && /[A-Za-z]/.test(node.value))
            report(node, node.value);
          return;
        }
        if (readByPerson(node)) return report(node, node.value);
        if (SENTENCE.test(node.value)) report(node, node.value);
      },
      TemplateLiteral(node) {
        if (insideMsg(node) || node.parent.type === 'TSLiteralType') return;
        const text = node.quasis.map((q) => q.value.cooked).join('{}');
        if (SENTENCE.test(text)) report(node, text);
      },
    };
  },
};
