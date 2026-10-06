'use strict';

/* Request-body hygiene for vehicle create/update, shared by
   /api/cars and /api/cars/[id]:
   - blank date strings become NULL (a '' sent to a Postgres date column
     is a hard error — clearing a date in the form must mean "not set");
   - the three columns added by migration v13 are only written when they
     can exist, so the app keeps working (and says why) on a database
     where that migration has not been applied yet. */

const { validateVehicleDates } = require('./fleetExpiry');

const DATE_FIELDS = ['insurance_expiry', 'registration_expiry', 'last_service_date', 'next_service_date', 'purchase_date',
  'insurance_start_date', 'periodic_inspection_last_date', 'periodic_inspection_expiry'];
const V13_FIELDS = ['insurance_start_date', 'periodic_inspection_last_date', 'periodic_inspection_expiry'];

const blank = v => v == null || String(v).trim() === '';

/* `existing` = the stored row for updates, or null for inserts. Returns
   { values, touchesV13 } where `values` holds only keys to write. */
function prepareVehicleValues(input, existing) {
  const values = {};
  let touchesV13 = false;
  for (const [k, raw] of Object.entries(input)) {
    const isDate = DATE_FIELDS.includes(k);
    const v = isDate ? (blank(raw) ? null : String(raw).trim()) : raw;
    if (V13_FIELDS.includes(k)) {
      /* Nothing to clear if the column does not exist (update), and
         nothing to write for a blank value on insert. */
      if (blank(raw) && (!existing || !(k in existing))) continue;
      touchesV13 = true;
    }
    values[k] = v;
  }
  return { values, touchesV13 };
}

/* Returns { field, code } or null. Validates the merged picture so a
   partial update (only the expiry changed) is checked against the stored
   start/last-taken date. */
function checkDates(values, existing) {
  return validateVehicleDates({ ...(existing || {}), ...values });
}

const DATE_ERRORS = {
  invalidDate: 'One of the dates is not a valid calendar date.',
  insuranceRange: 'Insurance expiry date cannot be earlier than the insurance start date.',
  inspectionRange: 'Next inspection expiry date cannot be earlier than the last inspection date.',
};

module.exports = { DATE_FIELDS, V13_FIELDS, prepareVehicleValues, checkDates, DATE_ERRORS };
