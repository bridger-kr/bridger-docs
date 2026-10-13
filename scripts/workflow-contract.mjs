export const OUTCOME = Object.freeze({Success: 'success', Empty: 'empty', Partial: 'partial', Error: 'error'});
export const COMPONENT_STATUS = Object.freeze({Available: 'available', Unavailable: 'unavailable'});
export const BUNDLES = Object.freeze({
  business_check: ['business_status', 'location'],
  place_brief: ['location', 'weather', 'air_quality', 'charging'],
});
export const UNAVAILABLE = Object.freeze([
  'missing_key', 'provider_error', 'timeout', 'stale', 'unsupported_region',
  'ambiguous', 'no_match', 'invalid_input', 'missing_asof', 'unsupported_address',
]);
const timestamp = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000', '') === value;
const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
  && Object.keys(object).sort().join(',') === [...keys].sort().join(',');

export function classifyWorkflow(components) {
  const usable = components.filter((c) => c.status === COMPONENT_STATUS.Available && c.rows.length > 0);
  if (usable.length === components.length && components.length > 0) return OUTCOME.Success;
  if (usable.length > 0) return OUTCOME.Partial;
  return components.some((c) => c.status === COMPONENT_STATUS.Available) ? OUTCOME.Empty : OUTCOME.Error;
}

// This validates a proposed normalized workflow envelope, not provider wire
// schemas. It cannot prove upstream reachability, rights or real adoption.
export function validateWorkflowFixture(fixture, sources) {
  const errors = [];
  const fail = (reason) => errors.push(reason);
  if (!exactKeys(fixture, ['version', 'id', 'evidence', 'bundle', 'scenario', 'requested', 'components', 'outcome', 'adopted'])) {
    return ['envelope_keys'];
  }
  if (fixture.version !== 1 || typeof fixture.id !== 'string'
    || !/^synthetic-\d{2}$/.test(fixture.id) || fixture.evidence !== 'synthetic') fail('identity');
  if (typeof fixture.scenario !== 'string' || !/^[a-z_]+$/.test(fixture.scenario)) fail('scenario');
  const allowed = typeof fixture.bundle === 'string' && Object.hasOwn(BUNDLES, fixture.bundle) ? BUNDLES[fixture.bundle] : null;
  if (!allowed || !Array.isArray(fixture.requested) || fixture.requested.length === 0
    || new Set(fixture.requested).size !== fixture.requested.length
    || fixture.requested.some((name) => !allowed.includes(name))
    || (fixture.bundle === 'business_check' && !fixture.requested.includes('business_status'))
    || (fixture.bundle === 'place_brief' && allowed.some((name) => !fixture.requested.includes(name)))) fail('requested');
  if (!Array.isArray(fixture.components) || fixture.components.length === 0) return [...errors, 'components'];
  if (!sources || typeof sources !== 'object' || Array.isArray(sources)) return [...errors, 'source_registry'];
  const names = fixture.components.map((c) => c?.name);
  if (new Set(names).size !== names.length || names.sort().join(',') !== [...(Array.isArray(fixture.requested) ? fixture.requested : [])].sort().join(',')) fail('component_set');
  for (const component of fixture.components) {
    if (!exactKeys(component, ['name', 'status', 'source', 'asOf', 'unavailable', 'rows'])) {fail('component_keys'); continue;}
    if (!Object.values(COMPONENT_STATUS).includes(component.status)) fail('component_status');
    if (typeof component.source !== 'string' || !Object.hasOwn(sources, component.source)
      || sources[component.source]?.component !== component.name) fail('source');
    if (!Array.isArray(component.rows) || component.rows.some((row) => !exactKeys(row, ['sample'])
      || !Number.isInteger(row.sample) || row.sample < 1)) fail('synthetic_rows');
    if (component.status === COMPONENT_STATUS.Available) {
      if (!timestamp(component.asOf) || component.unavailable !== null) fail('available_metadata');
    } else if (!UNAVAILABLE.includes(component.unavailable) || !Array.isArray(component.rows) || component.rows.length !== 0
      || (component.asOf !== null && !timestamp(component.asOf))) fail('unavailable_metadata');
  }
  if (!Object.values(OUTCOME).includes(fixture.outcome)) fail('outcome');
  if (!errors.length && fixture.outcome !== classifyWorkflow(fixture.components)) fail('false_success');
  if (typeof fixture.adopted !== 'boolean' || (fixture.adopted && fixture.outcome !== OUTCOME.Success)) fail('false_adoption');
  return errors;
}
