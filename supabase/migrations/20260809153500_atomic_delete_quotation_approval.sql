-- Atomically unlink and delete a Quotation Approval request.
create or replace function public.qt_delete_quotation_approval_request(
  p_request_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_request public.project_requests;
begin
  select * into v_request
  from public.project_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Quotation Approval request not found.' using errcode = 'P0002';
  end if;
  if v_request.project_id is not null then
    raise exception 'This approval already has a linked project and cannot be deleted.' using errcode = 'P0001';
  end if;

  perform 1 from public.qt_quotations
  where id = v_request.quotation_id
  for update;

  update public.qt_quotations set
    status = 'draft',
    project_status = null,
    project_request_id = null,
    rejection_reason = null,
    rejected_by = null,
    rejected_at = null,
    updated_at = now()
  where id = v_request.quotation_id
    and project_request_id = p_request_id;

  insert into public.qt_quotation_events (quotation_id, event, detail, actor_id)
  values (
    v_request.quotation_id,
    'quotation_approval_deleted',
    jsonb_build_object(
      'previous_status', v_request.status,
      'request_id', p_request_id,
      'department', 'Quotation'
    ),
    p_actor_id
  );

  delete from public.project_requests where id = p_request_id;

  return jsonb_build_object('ok', true, 'quotation_id', v_request.quotation_id);
end;
$$;

revoke execute on function public.qt_delete_quotation_approval_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.qt_delete_quotation_approval_request(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
