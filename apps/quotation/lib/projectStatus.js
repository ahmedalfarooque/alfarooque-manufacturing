'use strict';

/* qt_quotations.project_status holds two different vocabularies over a
   quotation's life: first the Projects-side review decision
   (pending/accepted/on_hold/rejected — Part 7), then once a project is
   actually created, the live pm_projects status (Upcoming/Running/
   Completed/On Hold — Part 10, whatever apps/projects itself supports
   today). This maps either into the right StatusBadge key so the UI
   never has to know which phase it's looking at. */

const REQUEST_STATUSES = ['pending', 'accepted', 'on_hold', 'rejected'];

function projectStatusBadgeKey(raw) {
  if (!raw) return null;
  if (REQUEST_STATUSES.includes(raw)) return 'pr_' + raw;
  return 'proj_' + String(raw).toLowerCase().replace(/\s+/g, '_');
}

module.exports = { projectStatusBadgeKey };
