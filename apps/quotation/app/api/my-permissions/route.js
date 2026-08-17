'use strict';
const { getDb } = require('@/lib/db');
const { readSession } = require('@/lib/auth');
const { createRolePermissionHandlers } = require('../../../../shared/rolePermissionHandlers');
const handlers = createRolePermissionHandlers({ getDb, readSession, appId: 'quotation' });
export const GET = handlers.MY;
