// kernel.mjs
// PossibilityNode — pure kernel.
// A possibility-layer holds N candidate fold-addresses. collapseOnIntent(layer, seed)
// deterministically renders exactly ONE candidate and returns the rest as an
// un-collapsed shadow set, without ever mutating the layer passed in. foldBack(record)
// releases the render and returns it alongside the retained shadow, refusing any
// record where the render has leaked into the shadow (a merge).
// No I/O. No throws — every function is total: bad input returns {ok:false, why}.

function isNonEmptyString(x) {
  return typeof x === 'string' && x.length > 0;
}

function hashSeed(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function makePossibilityLayer(addresses) {
  if (!Array.isArray(addresses)) {
    return { ok: false, why: 'addresses must be an array' };
  }
  if (addresses.length === 0) {
    return { ok: false, why: 'addresses must be non-empty' };
  }
  if (!addresses.every(isNonEmptyString)) {
    return { ok: false, why: 'each address must be a non-empty string' };
  }
  const seen = new Set();
  for (const a of addresses) {
    if (seen.has(a)) {
      return { ok: false, why: `duplicate address: ${a}` };
    }
    seen.add(a);
  }
  return { ok: true, layer: { addresses: addresses.slice() } };
}

export function collapseOnIntent(layer, seed) {
  if (!layer || typeof layer !== 'object' || !Array.isArray(layer.addresses)) {
    return { ok: false, why: 'invalid layer' };
  }
  const addresses = layer.addresses.slice(); // never mutate the input layer
  if (addresses.length === 0) {
    return { ok: false, why: 'layer has no candidates' };
  }
  if (!isNonEmptyString(seed)) {
    return { ok: false, why: 'seed must be a non-empty string' };
  }
  const index = hashSeed(seed) % addresses.length;
  const render = addresses[index];
  const shadow = addresses.filter((_, i) => i !== index);
  return {
    ok: true,
    record: { render, index, shadow, seed, total: addresses.length },
  };
}

export function foldBack(record) {
  if (!record || typeof record !== 'object') {
    return { ok: false, why: 'invalid record' };
  }
  const { render, shadow } = record;
  if (!isNonEmptyString(render)) {
    return { ok: false, why: 'record missing render' };
  }
  if (!Array.isArray(shadow)) {
    return { ok: false, why: 'record missing shadow' };
  }
  if (shadow.includes(render)) {
    return { ok: false, why: 'render must not appear in shadow (merge detected)' };
  }
  return { ok: true, released: render, retained: shadow.slice() };
}
