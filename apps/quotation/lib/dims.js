'use strict';

/* Canonical implementation moved to apps/shared/dims.js so Inventory's
   Materials page (same field model) doesn't duplicate this logic. This
   file re-exports it unchanged — every existing import of '@/lib/dims'
   in this app keeps working with no behavior change. */
module.exports = require('../../shared/dims');
