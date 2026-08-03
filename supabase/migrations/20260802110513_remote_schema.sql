-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION public.assign_ticket (
  p_ticket_id uuid,
  p_agent_id  uuid,
  p_method    text,
  p_rule_id   uuid DEFAULT NULL::uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_caller_role text;
  v_prev_agent_id uuid;
begin
  if p_method not in ('manual', 'rule') then
    raise exception 'Invalid assignment method: %', p_method;
  end if;

  -- Authorization lives here, not just RLS, because security definer
  -- bypasses RLS entirely — this function IS the trust boundary now.
  -- Assumes only staff ever call this, including for rule-triggered
  -- assignment. Revisit if item 4's rule engine ends up running as a
  -- cron/service job with no authenticated staff user in context —
  -- that will need a separate service-role path, not this check.
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role not in ('admin', 'agent') then
    raise exception 'Not authorized to assign tickets.';
  end if;

  select assigned_to_id into v_prev_agent_id
  from public.tickets where id = p_ticket_id;

  if not found then
    raise exception 'Ticket % not found.', p_ticket_id;
  end if;

  update public.tickets
  set assigned_to_id = p_agent_id
  where id = p_ticket_id;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'ticket.assigned',
    'ticket',
    p_ticket_id,
    jsonb_build_object(
      'from', v_prev_agent_id,
      'to', p_agent_id,
      'method', p_method,
      'rule_id', p_rule_id
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_act_on_ticket (
  _ticket_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.tickets t
    where t.id = _ticket_id
    and (
      public.is_admin()
      or t.assigned_to_id = auth.uid()
      or (t.assigned_to_id is null and public.current_role() = 'agent')
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_event (
  _event_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.events e
    join public.profiles owner on owner.id = e.owner_id
    where e.id = _event_id
    and (
      public.is_admin()
      or (public.current_role() = 'manager' and owner.department = public.current_department())
      or (public.current_role() = 'agent'   and e.owner_id = auth.uid())
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_ticket (
  _ticket_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.tickets t
    where t.id = _ticket_id
    and (
      t.assigned_to_id = auth.uid()
      or public.is_admin()
      or public.current_role() = 'agent'
      or (
        public.current_role() = 'manager'
        and t.department = public.current_department()
      )
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.close_ticket_via_qr (
  _ticket_id           uuid,
  _scanned_employee_no text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_employee_id     uuid;
  v_current_status  ticket_status;
begin
  if not public.can_act_on_ticket(_ticket_id) then
    raise exception 'Not authorized to close this ticket';
  end if;
 
  v_employee_id := public.verify_scanned_employee(_ticket_id, _scanned_employee_no);
 
  select status into v_current_status from public.tickets where id = _ticket_id;
 
  perform set_config('app.confirming_employee_id', v_employee_id::text, true);
 
  if v_current_status is distinct from 'resolved' then
    update public.tickets set status = 'resolved', resolved_at = now() where id = _ticket_id;
  end if;
 
  update public.tickets set status = 'closed', closed_at = now() where id = _ticket_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_ticket_creation_via_qr (
  _ticket_id           uuid,
  _scanned_employee_no text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_employee_id uuid;
  v_status      ticket_status;
begin
  if not public.can_act_on_ticket(_ticket_id) then
    raise exception 'Not authorized to confirm this ticket';
  end if;
 
  select status into v_status from public.tickets where id = _ticket_id;
  if v_status is distinct from 'pending_confirmation' then
    raise exception 'Ticket is not awaiting confirmation (current status: %)', v_status;
  end if;
 
  v_employee_id := public.verify_scanned_employee(_ticket_id, _scanned_employee_no);
 
  perform set_config('app.confirming_employee_id', v_employee_id::text, true);
  update public.tickets set status = 'open' where id = _ticket_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_pending_tickets (
  cutoff interval DEFAULT '24:00:00'::interval
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  affected integer;
begin
  -- No app.confirming_employee_id set here — this isn't tied to any
  -- one employee. changed_by_profile_id will also end up null, since
  -- there's no signed-in session on a scheduled job. Neither is meant
  -- to read as "no one did this" — the note below states the fact
  -- plainly instead: the request was cancelled, full stop.
  perform set_config(
    'app.status_change_note',
    'Ticket request has been cancelled after remaining unconfirmed for ' || cutoff::text || '.',
    true
  );
 
  update public.tickets
  set status = 'cancelled'
  where status = 'pending_confirmation'
    and created_at < now() - cutoff;
 
  get diagnostics affected = row_count;
  return affected;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_year int := extract(year from now())::int;
  v_code text;
  v_seq  bigint;
begin
  select code into v_code
  from public.ticket_categories
  where id = new.category_id;
 
  if v_code is null then
    raise exception 'Ticket category % has no prefix code configured', new.category_id;
  end if;
 
  -- Atomic upsert: this single statement is what prevents two concurrent
  -- submissions in the same category from ever getting the same number —
  -- same principle as the room-reservation EXCLUDE constraint, just solved
  -- with a locked counter row instead of a range check.
  insert into public.ticket_number_counters (year, category_id, last_value)
  values (v_year, new.category_id, 1)
  on conflict (year, category_id)
  do update set last_value = ticket_number_counters.last_value + 1
  returning last_value into v_seq;
 
  -- Always server-generated — overwrites anything a client may have sent.
  new.ticket_number := v_code || '-' || v_year || '-' || lpad(v_seq::text, 6, '0');
 
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_caller_department()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select department from public.profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_caller_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select role from public.profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.profiles (id, full_name, role, department)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'agent'),
    new.raw_user_meta_data ->> 'department'
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.log_sla_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'sla.created' else 'sla.updated' end,
    'sla',
    new.id,
    jsonb_build_object(
      'priority', new.priority,
      'first_response_minutes', new.first_response_minutes,
      'resolution_minutes', new.resolution_minutes
    )
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_employee_id uuid;
  v_note        text;
begin
  if new.status is distinct from old.status then
    
    -- Transaction-local, set right before the update by whatever
    -- function is performing it; automatically clears itself once the
    -- transaction ends, so an unrelated later transaction never picks
    -- up a stale value. Both default to null for a plain staff update
    -- that doesn't set either.
    v_employee_id := nullif(current_setting('app.confirming_employee_id', true), '')::uuid;
    v_note        := nullif(current_setting('app.status_change_note', true), '');
 
    insert into public.ticket_status_history
      (ticket_id, from_status, to_status, changed_by_profile_id, changed_by_employee_id, note)
    values (new.id, old.status, new.status, auth.uid(), v_employee_id, v_note);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_ticket_created()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'ticket.draft_created',
    'ticket',
    new.id,
    jsonb_build_object('status', new.status, 'priority', new.priority)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_ticket_soft_delete()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'ticket.deleted',
    'ticket',
    new.id,
    jsonb_build_object('status_at_deletion', new.status)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_ticket_status_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  if new.status is distinct from old.status then
    insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      case
        when old.status = 'pending_confirmation' and new.status = 'open'
          then 'ticket.verified'
        else 'ticket.status_changed'
      end,
      'ticket',
      new.id,
      jsonb_build_object('from_status', old.status, 'to_status', new.status)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.override_close_ticket (
  _ticket_id uuid,
  _reason    text DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_current_status ticket_status;
begin
  if not public.can_act_on_ticket(_ticket_id) then
    raise exception 'Not authorized to close this ticket';
  end if;

  select status into v_current_status from public.tickets where id = _ticket_id;

  if v_current_status = 'closed' then
    raise exception 'Ticket is already closed';
  end if;

  perform set_config(
    'app.status_change_note',
    coalesce(_reason, 'Closed via staff override — not QR-confirmed by requester.'),
    true
  );

  if v_current_status is distinct from 'resolved' then
    update public.tickets set status = 'resolved', resolved_at = now() where id = _ticket_id;
  end if;

  update public.tickets set status = 'closed', closed_at = now() where id = _ticket_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_role_department_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.department is distinct from old.department then
      raise exception 'Only admins may change role or department';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_events_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_ticket_department()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  select department into new.department
  from public.employees
  where id = new.requester_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_ticket_sla_deadlines()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_sla public.slas;
begin
  if new.status = 'open' and old.status = 'pending_confirmation' then
    select * into v_sla from public.slas where priority = new.priority;
    if found then
      new.first_response_due_at := now() + (v_sla.first_response_minutes || ' minutes')::interval;
      new.due_at := now() + (v_sla.resolution_minutes || ' minutes')::interval;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_employee_record (
  _employee_no text,
  _full_name   text,
  _department  text,
  _email       text DEFAULT NULL::text
)
  RETURNS public.employees
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_row public.employees;
begin
  update public.employees
  set full_name  = _full_name,
      department = _department,
      email      = coalesce(_email, email),
      updated_at = now()
  where employee_no = _employee_no
  returning * into v_row;
 
  if v_row.id is null then
    raise exception 'Employee % not found — scan-time sync only refreshes existing records, it does not create new ones', _employee_no;
  end if;
 
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verify_scanned_employee (
  _ticket_id           uuid,
  _scanned_employee_no text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_requester_id uuid;
  v_scanned_id   uuid;
begin
  select requester_id into v_requester_id from public.tickets where id = _ticket_id;
 
  select id into v_scanned_id
  from public.employees
  where employee_no = _scanned_employee_no and is_active;
 
  if v_scanned_id is null then
    raise exception 'Scanned employee ID not recognized';
  end if;
 
  if v_scanned_id is distinct from v_requester_id then
    raise exception 'Scanned employee does not match this ticket''s requester';
  end if;
 
  return v_scanned_id;
end;
$function$;

ALTER VIEW public.dashboard_recent_activity SET (security_invoker=on);

REVOKE ALL ON public.dashboard_recent_activity FROM anon;

ALTER VIEW public.dashboard_recent_tickets SET (security_invoker=on);

REVOKE ALL ON public.dashboard_recent_tickets FROM anon;

ALTER VIEW public.dashboard_ticket_counts SET (security_invoker=on);

REVOKE ALL ON public.dashboard_ticket_counts FROM anon;

ALTER VIEW public.dashboard_tickets_by_category SET (security_invoker=on);

REVOKE ALL ON public.dashboard_tickets_by_category FROM anon;

ALTER VIEW public.dashboard_tickets_opened_daily SET (security_invoker=on);

REVOKE ALL ON public.dashboard_tickets_opened_daily FROM anon;

ALTER POLICY activity_log_select_staff ON public.activity_log USING ((( SELECT auth.role() AS ROLE) = 'authenticated'::text));

ALTER POLICY employees_manage_admin ON public.employees TO authenticated;

ALTER POLICY employees_select_staff ON public.employees TO authenticated;

ALTER POLICY employees_select_staff ON public.employees USING ((public."current_role"() = 'agent'::public.roles));

ALTER POLICY events_insert_own ON public.events WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

ALTER POLICY profiles_select ON public.profiles
  USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public."current_role"() = ANY (ARRAY['agent'::public.roles, 'manager'::public.roles]))));

ALTER POLICY profiles_update_own ON public.profiles USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));

ALTER POLICY profiles_update_own ON public.profiles WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));

ALTER POLICY slas_manage_admin ON public.slas TO authenticated;

ALTER POLICY slas_select_all ON public.slas USING ((( SELECT auth.role() AS ROLE) = 'authenticated'::text));

ALTER POLICY attachments_delete ON public.ticket_attachments USING ((((uploaded_by_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_attachments.tickets_id) AND (t.status = 'pending_confirmation'::public.ticket_status))))));

ALTER POLICY attachments_insert ON public.ticket_attachments WITH CHECK (((uploaded_by_id = ( SELECT auth.uid() AS uid)) AND public.can_act_on_ticket(tickets_id)));

ALTER POLICY categories_select_all ON public.ticket_categories USING ((( SELECT auth.role() AS ROLE) = 'authenticated'::text));

ALTER POLICY comments_insert ON public.ticket_comments WITH
  CHECK
  (((user_id = ( SELECT auth.uid() AS uid)) AND public.can_view_ticket(ticket_id) AND (public."current_role"() = ANY (ARRAY['agent'::public.roles, 'admin'::public.roles,
  'manager'::public.roles]))));

ALTER POLICY comments_update ON public.ticket_comments USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));

ALTER POLICY comments_update ON public.ticket_comments WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));

ALTER POLICY watchers_manage_self ON public.ticket_watchers USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));

ALTER POLICY watchers_manage_self ON public.ticket_watchers WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin()));

ALTER POLICY tickets_select ON public.tickets
  USING
  (((assigned_to_id = ( SELECT auth.uid() AS uid)) OR public.is_admin() OR (public."current_role"() = 'agent'::public.roles) OR ((public."current_role"() = 'manager'::public.roles)
  AND (department = public.current_department()))));

ALTER POLICY tickets_update_staff ON public.tickets
  USING ((public.is_admin() OR ((public."current_role"() = 'agent'::public.roles) AND ((assigned_to_id IS NULL) OR (assigned_to_id = ( SELECT auth.uid() AS uid))))));

ALTER POLICY tickets_update_staff ON public.tickets WITH
  CHECK ((public.is_admin() OR ((public."current_role"() = 'agent'::public.roles) AND ((assigned_to_id IS NULL) OR (assigned_to_id = ( SELECT auth.uid() AS uid))))));
