'use strict';

/* Shared pm_projects row shape — used by both the manual "New Project"
   form (app/api/projects/route.js) and the "Project Start" endpoint that
   auto-creates a project from an accepted quotation request. Keeping
   this in one place means both paths stay in sync with the same
   required/optional fields and defaults. */

const { autoProjectName } = require('./autoProjectName');

function buildProjectRow(body) {
  const projectDetails = String(body.project_details || '').trim();
  const projectName = String(body.project_name || '').trim();
  return {
    customer_id: body.customer_id || null,
    customer_name: body.customer_name,
    company_name: body.company_name || null,
    contact_person: body.contact_person || null,
    contact_email: body.contact_email || null,
    contact_phone: body.contact_phone || null,
    address: body.address || null,
    project_name: projectName || autoProjectName(projectDetails),
    short_summary: body.short_summary || null,
    project_details: projectDetails || null,
    value: body.value ? Number(body.value) : 0,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    status: body.status || 'Upcoming',
    progress: body.progress != null ? Math.max(0, Math.min(100, Number(body.progress))) : 0,
    notes: body.notes || null,
  };
}

module.exports = { buildProjectRow };
