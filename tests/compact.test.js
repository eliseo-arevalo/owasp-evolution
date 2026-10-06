import test from 'node:test';
import assert from 'node:assert/strict';
import {compactJavaScript} from '../scripts/compact.js';
test('compaction preserves literals, regex escapes, templates and ASI',()=>{
 const source = 'const text = "https://example.com/a b";\nconst regex = /a\\/b/;\nconst template = `line  one\\nline two`;\n// comment\nfunction value() { return\n  text; }\nreturn [text, regex.source, template, value()];';
 assert.deepEqual(Function(compactJavaScript(source))(),Function(source)());
 assert.ok(compactJavaScript(source).length < source.length);
});
