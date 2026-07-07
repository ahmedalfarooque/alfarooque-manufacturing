'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: pr } = await sb.from('pm_purchase_requests').select('project_id').eq('id', params.id).maybeSingle();
  if (!pr) return json({ error: 'Purchase request not found.' }, 404);
  if (!(await isAssignedOrAdmin(session, pr.project_id))) return json({ error: 'Not permitted.' }, 403);

  const { data, error } = await sb
    .from('pm_purchase_request_comments')
    .select('*, platform_users(full_name, email)')
    .eq('purchase_request_id', params.id)
    .order('created_at', { ascending: true });
  if (error) { console.error('[pr-comments] list failed:', error.message); return json({ error: 'Could not load comments.' }, 500); }

  const comments = (data || []).map(c => ({ ...c, author_name: c.platform_users?.full_name || c.platform_users?.email || null, platform_users: undefined }));
  return json({ comments });
}

export async function POST(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: pr } = await sb.from('pm_purchase_requests').select('project_id').eq('id', params.id).maybeSingle();
  if (!pr) return json({ error: 'Purchase request not found.' }, 404);
  if (!(await isAssignedOrAdmin(session, pr.project_id))) return json({ error: 'Not permitted.' }, 403);

  const body = await req.json().catch(() => ({}));
  const comment = String(body.comment || '').trim();
  if (!comment) return json({ error: 'Comment cannot be empty.' }, 400);

  const { data, error } = await sb.from('pm_purchase_request_comments').insert({
    purchase_request_id: params.id,
    author_id: session.sub,
    comment,
  }).select('*, platform_users(full_name, email)').single();
  if (error) { console.error('[pr-comments] create failed:', error.message); return json({ error: 'Could not add comment.' }, 500); }

  return json({ comment: { ...data, author_name: data.platform_users?.full_name || data.platform_users?.email || null, platform_users: undefined } }, 201);
}
