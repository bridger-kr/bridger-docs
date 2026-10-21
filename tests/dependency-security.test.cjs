const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const lock = require('../package-lock.json');
const root = path.resolve(__dirname, '..');
const installedPaths = Object.keys(lock.packages).filter(key => key.endsWith('/braces'));
assert.ok(installedPaths.length > 0);
for (const installedPath of installedPaths) {
  const braces = require(path.join(root, installedPath));
  const metadata = require(path.join(root, installedPath, 'package.json'));


  test('the reviewed depth-guard backport is installed', () => {
    assert.equal(metadata.name, '@bleedingdev/braces');
    assert.equal(metadata.version, '3.0.4');
  });

  test('normal brace expansion, ranges, and regex compilation remain compatible', () => {
    assert.deepEqual(braces.expand('src/{landing,dashboard}/file{1..3}.css'), [
      'src/landing/file1.css', 'src/landing/file2.css', 'src/landing/file3.css',
      'src/dashboard/file1.css', 'src/dashboard/file2.css', 'src/dashboard/file3.css',
    ]);
    assert.deepEqual(braces('a/{b,c}/d'), ['a/(b|c)/d']);
    assert.equal(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
  });

  const boundedError = { name: 'SyntaxError', message: /AST nesting depth exceeds/ };

  test('deep balanced, unbalanced, and parenthesized patterns fail before stack exhaustion', () => {
    for (const pattern of [
      '{'.repeat(3000) + 'x' + '}'.repeat(3000),
      '{'.repeat(3000) + 'x',
      '('.repeat(3000) + 'x' + ')'.repeat(3000),
    ]) {
      for (const run of [braces, braces.parse, braces.expand]) {
        assert.throws(() => run(pattern), boundedError);
      }
    }
  });

  test('direct AST callers cannot bypass the recursive walker guards', () => {
    const ast = { type: 'root', nodes: [] };
    let parent = ast;
    for (let i = 0; i < 300; i++) {
      const child = { type: 'brace', nodes: [], open: true, close: true, commas: 1, parent };
      parent.nodes.push(child);
      parent = child;
    }
    parent.nodes.push({ type: 'text', value: 'x' });
    for (const run of [braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => run(ast), boundedError);
    }
  });

}
