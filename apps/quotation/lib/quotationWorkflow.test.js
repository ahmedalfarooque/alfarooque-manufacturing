'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { nextQuotationStatus } = require('./quotationWorkflow');

test('allows only the approved quotation workflow transitions', () => {
  assert.equal(nextQuotationStatus('draft', 'submit'), 'waiting_quotation_approval');
  assert.equal(nextQuotationStatus('quotation_approved', 'accept'), 'customer_approved');
  assert.equal(nextQuotationStatus('quotation_approved', 'decline'), 'customer_rejected');
  assert.equal(nextQuotationStatus('customer_approved', 'contract'), 'project_created');
});

test('rejects skipped, repeated, and reversed transitions', () => {
  assert.equal(nextQuotationStatus('draft', 'accept'), null);
  assert.equal(nextQuotationStatus('waiting_quotation_approval', 'accept'), null);
  assert.equal(nextQuotationStatus('customer_approved', 'accept'), null);
  assert.equal(nextQuotationStatus('quotation_rejected', 'contract'), null);
  assert.equal(nextQuotationStatus('project_created', 'contract'), null);
});
