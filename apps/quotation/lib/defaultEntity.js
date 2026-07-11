'use strict';

/* Wood Works is the default entity everywhere a new record starts —
   never remembered from a previous selection, never IAAE. Matched by
   code (not array position) so it stays correct regardless of API
   ordering or future renames of this same constant. */

const DEFAULT_ENTITY_CODE = 'WW-03';

function pickDefaultEntityId(entities) {
  const list = entities || [];
  const def = list.find(e => e.code === DEFAULT_ENTITY_CODE);
  return def ? def.id : (list[0] ? list[0].id : '');
}

module.exports = { DEFAULT_ENTITY_CODE, pickDefaultEntityId };
