'use strict';
const { getDb } = require('@/lib/db');
const { readSession } = require('@/lib/auth');
const { createAdminUsersHandlers } = require('../../../../../../shared/userAdminHandlers');
const handlers = createAdminUsersHandlers({ getDb, readSession, appId: 'inventory' });
export const DELETE = handlers.DELETE;
