'use strict';
const { getDb } = require('@/lib/db');
const { readSession } = require('@/lib/auth');
const { createAdminUsersHandlers } = require('../../../../../shared/userAdminHandlers');
const handlers = createAdminUsersHandlers({ getDb, readSession, appId: 'quotation' });
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
