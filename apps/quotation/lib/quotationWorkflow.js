'use strict';

const TRANSITIONS = Object.freeze({
  submit: Object.freeze({ draft: 'waiting_quotation_approval' }),
  accept: Object.freeze({ quotation_approved: 'customer_approved' }),
  decline: Object.freeze({ quotation_approved: 'customer_rejected' }),
  contract: Object.freeze({ customer_approved: 'project_created' }),
});

function nextQuotationStatus(currentStatus, action) {
  return TRANSITIONS[action]?.[currentStatus] || null;
}

module.exports = { TRANSITIONS, nextQuotationStatus };
