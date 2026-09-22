import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';

test('makePossibilityLayer rejects malformed input, totally (no throw)', () => {
  assert.equal(K.makePossibilityLayer(null).ok, false);
  assert.equal(K.makePossibilityLayer([]).ok, false);
  assert.equal(K.makePossibilityLayer([1, 2]).ok, false);
  assert.equal(K.makePossibilityLayer(['a', 'a']).ok, false);
  const good = K.makePossibilityLayer(['a0', 'a1', 'a2', 'a3', 'a4']);
  assert.equal(good.ok, true);
  assert.deepEqual(good.layer.addresses, ['a0', 'a1', 'a2', 'a3', 'a4']);
});

test('collapseOnIntent("alpha") pins index 3 / render a3, shadow keeps the other 4', () => {
  const { layer } = K.makePossibilityLayer(['a0', 'a1', 'a2', 'a3', 'a4']);
  const result = K.collapseOnIntent(layer, 'alpha');
  assert.equal(result.ok, true);
  assert.equal(result.record.index, 3);
  assert.equal(result.record.render, 'a3');
  assert.deepEqual(result.record.shadow, ['a0', 'a1', 'a2', 'a4']);
});

test('collapseOnIntent is deterministic and never mutates the input layer', () => {
  const { layer } = K.makePossibilityLayer(['a0', 'a1', 'a2', 'a3', 'a4']);
  const r1 = K.collapseOnIntent(layer, 'alpha');
  const r2 = K.collapseOnIntent(layer, 'alpha');
  assert.deepEqual(r1.record, r2.record);
  assert.deepEqual(layer.addresses, ['a0', 'a1', 'a2', 'a3', 'a4']);
});

test('collapseOnIntent("beta") pins index 2 / render a2; render+shadow reconstruct the whole set with no merge', () => {
  const { layer } = K.makePossibilityLayer(['a0', 'a1', 'a2', 'a3', 'a4']);
  const result = K.collapseOnIntent(layer, 'beta');
  assert.equal(result.ok, true);
  assert.equal(result.record.index, 2);
  assert.equal(result.record.render, 'a2');
  const reunited = new Set([result.record.render, ...result.record.shadow]);
  assert.deepEqual([...reunited].sort(), ['a0', 'a1', 'a2', 'a3', 'a4']);
  assert.equal(result.record.shadow.includes(result.record.render), false);
});

test('collapseOnIntent is total: bad layer / bad seed return ok:false, never throw', () => {
  const { layer } = K.makePossibilityLayer(['a0', 'a1']);
  assert.equal(K.collapseOnIntent(null, 'x').ok, false);
  assert.equal(K.collapseOnIntent({ addresses: [] }, 'x').ok, false);
  assert.equal(K.collapseOnIntent(layer, 123).ok, false);
  assert.equal(K.collapseOnIntent(layer, '').ok, false);
});

test('collapseOnIntent rejects a non-object layer even when it carries a genuinely valid addresses array (typeof guard cannot be bypassed by shape alone)', () => {
  // A=!layer is false (truthy), C=!Array.isArray(...) is false (real array) —
  // only B (typeof !== 'object') is true here. This is the one input shape that
  // separates the intended (A||B||C) from both (A&&B)||C and (A||B)&&C, and also
  // from a typeof !==/=== flip: every one of those mutants would let this through
  // and return ok:true instead of refusing it.
  const fn = function () {};
  fn.addresses = ['a0', 'a1'];
  const result = K.collapseOnIntent(fn, 'seed');
  assert.equal(result.ok, false);
  assert.equal(result.why, 'invalid layer');
});

test('collapseOnIntent rejects a present, well-typed object that is simply missing the addresses field', () => {
  // A=false, B=false, C=true (layer.addresses is undefined, not an array).
  // Pins the addresses-array guard on its own, independent of the typeof/falsy checks.
  const result = K.collapseOnIntent({}, 'seed');
  assert.equal(result.ok, false);
  assert.equal(result.why, 'invalid layer');
});

test('collapseOnIntent rejects an object whose addresses field is present but not an array', () => {
  const result = K.collapseOnIntent({ addresses: 'a0,a1' }, 'seed');
  assert.equal(result.ok, false);
  assert.equal(result.why, 'invalid layer');
});

test('foldBack releases the render plus retained shadow, and rejects a merged/malformed record', () => {
  const { layer } = K.makePossibilityLayer(['a0', 'a1', 'a2', 'a3', 'a4']);
  const { record } = K.collapseOnIntent(layer, 'alpha');
  const folded = K.foldBack(record);
  assert.equal(folded.ok, true);
  assert.equal(folded.released, 'a3');
  assert.deepEqual(folded.retained, ['a0', 'a1', 'a2', 'a4']);

  assert.equal(K.foldBack(null).ok, false);
  assert.equal(K.foldBack({ render: 'a3', shadow: ['a3', 'a1'] }).ok, false);
});
