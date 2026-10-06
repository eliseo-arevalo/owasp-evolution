// Conservative compaction: protect literals and regexes, retain newlines for ASI.
// This deliberately avoids renaming bindings or changing expression semantics.
export function compactJavaScript(source) {
  const literals = [];
  const protectedSource = source.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\*[^]*?\*\/|\/\/[^\n]*|\/(?:\\.|[^/\n\\])+\/[dgimsuvy]*/g, value => {
    if (value.startsWith('//')) return '';
    if (value.startsWith('/*')) return value.includes('\n') ? '\n' : ' ';
    const index = literals.push(value) - 1;
    return `\u0001${index}\u0002`;
  });
  return protectedSource.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n')
    .replace(/ *([,;(){}\[\]]) */g, '$1').trim()
    .replace(/\u0001(\d+)\u0002/g, (_, index) => literals[index]);
}
