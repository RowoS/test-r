-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE TYPE public.asset_status AS ENUM (
  'active',
  'retired',
  'in_repair'
);

CREATE TYPE public.asset_type AS ENUM (
  'laptop',
  'desktop',
  'monitor',
  'printer',
  'phone',
  'other'
);

CREATE TYPE public.event_type AS ENUM (
  'maintenance',
  'outage',
  'site_visit',
  'staff_availability',
  'other'
);

CREATE TYPE public.roles AS ENUM (
  'agent',
  'admin',
  'manager'
);

CREATE TYPE public.ticket_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE public.ticket_source AS ENUM (
  'web',
  'email',
  'phone',
  'other'
);

CREATE TYPE public.ticket_status AS ENUM (
  'pending_confirmation',
  'open',
  'in_progress',
  'on_hold',
  'resolved',
  'closed',
  'reopened',
  'cancelled'
);

CREATE FUNCTION public."current_role"()
  RETURNS public.roles
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$ select role from public.profiles where id = auth.uid(); $function$;

GRANT ALL ON FUNCTION public."current_role"() TO anon;

GRANT ALL ON FUNCTION public."current_role"() TO authenticated;

GRANT ALL ON FUNCTION public."current_role"() TO service_role;

CREATE FUNCTION public.assign_ticket (
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

GRANT ALL ON FUNCTION public.assign_ticket(uuid, uuid, text, uuid) TO anon;

GRANT ALL ON FUNCTION public.assign_ticket(uuid, uuid, text, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.assign_ticket(uuid, uuid, text, uuid) TO service_role;

CREATE FUNCTION public.can_act_on_ticket (
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

GRANT ALL ON FUNCTION public.can_act_on_ticket(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_act_on_ticket(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_act_on_ticket(uuid) TO service_role;

CREATE FUNCTION public.can_edit_event (
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

GRANT ALL ON FUNCTION public.can_edit_event(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_edit_event(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_edit_event(uuid) TO service_role;

CREATE FUNCTION public.can_view_ticket (
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

GRANT ALL ON FUNCTION public.can_view_ticket(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_view_ticket(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_view_ticket(uuid) TO service_role;

CREATE FUNCTION public.close_ticket_via_qr (
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

GRANT ALL ON FUNCTION public.close_ticket_via_qr(uuid, text) TO anon;

GRANT ALL ON FUNCTION public.close_ticket_via_qr(uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.close_ticket_via_qr(uuid, text) TO service_role;

CREATE FUNCTION public.confirm_ticket_creation_via_qr (
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

GRANT ALL ON FUNCTION public.confirm_ticket_creation_via_qr(uuid, text) TO anon;

GRANT ALL ON FUNCTION public.confirm_ticket_creation_via_qr(uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.confirm_ticket_creation_via_qr(uuid, text) TO service_role;

CREATE FUNCTION public.current_department()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$ select department from public.profiles where id = auth.uid(); $function$;

GRANT ALL ON FUNCTION public.current_department() TO anon;

GRANT ALL ON FUNCTION public.current_department() TO authenticated;

GRANT ALL ON FUNCTION public.current_department() TO service_role;

CREATE FUNCTION public.expire_stale_pending_tickets (
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

GRANT ALL ON FUNCTION public.expire_stale_pending_tickets(interval) TO service_role;

CREATE FUNCTION public.generate_ticket_number()
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

GRANT ALL ON FUNCTION public.generate_ticket_number() TO anon;

GRANT ALL ON FUNCTION public.generate_ticket_number() TO authenticated;

GRANT ALL ON FUNCTION public.generate_ticket_number() TO service_role;

CREATE FUNCTION public.get_caller_department()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select department from public.profiles where id = auth.uid();
$function$;

GRANT ALL ON FUNCTION public.get_caller_department() TO anon;

GRANT ALL ON FUNCTION public.get_caller_department() TO authenticated;

GRANT ALL ON FUNCTION public.get_caller_department() TO service_role;

CREATE FUNCTION public.get_caller_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select role from public.profiles where id = auth.uid();
$function$;

GRANT ALL ON FUNCTION public.get_caller_role() TO anon;

GRANT ALL ON FUNCTION public.get_caller_role() TO authenticated;

GRANT ALL ON FUNCTION public.get_caller_role() TO service_role;

CREATE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
begin

  insert INTO public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'agent');
  return new;
END;
$function$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

CREATE FUNCTION public.is_admin()
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

GRANT ALL ON FUNCTION public.is_admin() TO anon;

GRANT ALL ON FUNCTION public.is_admin() TO authenticated;

GRANT ALL ON FUNCTION public.is_admin() TO service_role;

CREATE FUNCTION public.log_sla_change()
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

GRANT ALL ON FUNCTION public.log_sla_change() TO anon;

GRANT ALL ON FUNCTION public.log_sla_change() TO authenticated;

GRANT ALL ON FUNCTION public.log_sla_change() TO service_role;

CREATE FUNCTION public.log_status_change()
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

GRANT ALL ON FUNCTION public.log_status_change() TO anon;

GRANT ALL ON FUNCTION public.log_status_change() TO authenticated;

GRANT ALL ON FUNCTION public.log_status_change() TO service_role;

CREATE FUNCTION public.log_ticket_created()
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

GRANT ALL ON FUNCTION public.log_ticket_created() TO anon;

GRANT ALL ON FUNCTION public.log_ticket_created() TO authenticated;

GRANT ALL ON FUNCTION public.log_ticket_created() TO service_role;

CREATE FUNCTION public.log_ticket_soft_delete()
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

GRANT ALL ON FUNCTION public.log_ticket_soft_delete() TO anon;

GRANT ALL ON FUNCTION public.log_ticket_soft_delete() TO authenticated;

GRANT ALL ON FUNCTION public.log_ticket_soft_delete() TO service_role;

CREATE FUNCTION public.log_ticket_status_change()
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

GRANT ALL ON FUNCTION public.log_ticket_status_change() TO anon;

GRANT ALL ON FUNCTION public.log_ticket_status_change() TO authenticated;

GRANT ALL ON FUNCTION public.log_ticket_status_change() TO service_role;

CREATE FUNCTION public.override_close_ticket (
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

GRANT ALL ON FUNCTION public.override_close_ticket(uuid, text) TO anon;

GRANT ALL ON FUNCTION public.override_close_ticket(uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.override_close_ticket(uuid, text) TO service_role;

CREATE FUNCTION public.prevent_role_department_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
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

GRANT ALL ON FUNCTION public.prevent_role_department_change() TO anon;

GRANT ALL ON FUNCTION public.prevent_role_department_change() TO authenticated;

GRANT ALL ON FUNCTION public.prevent_role_department_change() TO service_role;

CREATE FUNCTION public.set_events_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.set_events_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_events_updated_at() TO authenticated;

GRANT ALL ON FUNCTION public.set_events_updated_at() TO service_role;

CREATE FUNCTION public.set_ticket_department()
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

GRANT ALL ON FUNCTION public.set_ticket_department() TO anon;

GRANT ALL ON FUNCTION public.set_ticket_department() TO authenticated;

GRANT ALL ON FUNCTION public.set_ticket_department() TO service_role;

CREATE FUNCTION public.set_ticket_sla_deadlines()
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

GRANT ALL ON FUNCTION public.set_ticket_sla_deadlines() TO anon;

GRANT ALL ON FUNCTION public.set_ticket_sla_deadlines() TO authenticated;

GRANT ALL ON FUNCTION public.set_ticket_sla_deadlines() TO service_role;

CREATE FUNCTION public.verify_scanned_employee (
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

GRANT ALL ON FUNCTION public.verify_scanned_employee(uuid, text) TO anon;

GRANT ALL ON FUNCTION public.verify_scanned_employee(uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.verify_scanned_employee(uuid, text) TO service_role;

CREATE TABLE public.activity_log (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  actor_id    uuid,
  action      text                     NOT NULL,
  entity_type text                     NOT NULL,
  entity_id   uuid                     NOT NULL,
  metadata    jsonb                    DEFAULT '{}'::jsonb NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.activity_log
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);

GRANT ALL ON public.activity_log TO anon;

GRANT ALL ON public.activity_log TO authenticated;

GRANT ALL ON public.activity_log TO service_role;

CREATE INDEX activity_log_actor_id_idx ON public.activity_log (actor_id);

CREATE INDEX activity_log_entity_type_entity_id_idx ON public.activity_log (entity_type, entity_id);

CREATE INDEX activity_log_created_at_idx ON public.activity_log (created_at);

CREATE POLICY activity_log_select_staff ON public.activity_log
  FOR SELECT
  USING ((auth.role() = 'authenticated'::text));

CREATE TABLE public.assets (
  id                  uuid                DEFAULT gen_random_uuid() NOT NULL,
  name                text                NOT NULL,
  asset_tag           text                NOT NULL,
  type                public.asset_type   NOT NULL,
  assigned_to_id      uuid,
  status              public.asset_status DEFAULT 'active'::public.asset_status NOT NULL,
  purchased_at        date,
  warranty_expires_at date
);

ALTER TABLE public.assets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_asset_tag_key UNIQUE (asset_tag);

ALTER TABLE public.assets
  ADD CONSTRAINT assets_pkey PRIMARY KEY (id);

GRANT ALL ON public.assets TO anon;

GRANT ALL ON public.assets TO authenticated;

GRANT ALL ON public.assets TO service_role;

CREATE POLICY assets_staff_all ON public.assets
  USING ((public."current_role"() = ANY (ARRAY['agent'::public.roles, 'admin'::public.roles])))
  WITH CHECK ((public."current_role"() = ANY (ARRAY['agent'::public.roles, 'admin'::public.roles])));

CREATE TABLE public.employees (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  employee_no text                     NOT NULL,
  full_name   text                     NOT NULL,
  email       text,
  department  text,
  is_active   boolean                  DEFAULT true NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

CREATE FUNCTION public.sync_employee_record (
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

GRANT ALL ON FUNCTION public.sync_employee_record(text, text, text, text) TO anon;

GRANT ALL ON FUNCTION public.sync_employee_record(text, text, text, text) TO authenticated;

GRANT ALL ON FUNCTION public.sync_employee_record(text, text, text, text) TO service_role;

ALTER TABLE public.employees
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_no_key UNIQUE (employee_no);

ALTER TABLE public.employees
  ADD CONSTRAINT employees_pkey PRIMARY KEY (id);

ALTER TABLE public.assets
  ADD CONSTRAINT assets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.employees(id);

GRANT ALL ON public.employees TO anon;

GRANT ALL ON public.employees TO authenticated;

GRANT ALL ON public.employees TO service_role;

CREATE INDEX employees_department_idx ON public.employees (department);

CREATE POLICY employees_manage_admin ON public.employees
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY employees_select_staff ON public.employees
  FOR SELECT
  USING ((public."current_role"() = ANY (ARRAY['agent'::public.roles, 'admin'::public.roles])));

CREATE TABLE public.events (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  title       text                     NOT NULL,
  description text,
  event_type  public.event_type        NOT NULL,
  ticket_id   uuid,
  owner_id    uuid                     NOT NULL,
  starts_at   timestamp with time zone NOT NULL,
  ends_at     timestamp with time zone NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.events
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events
  ADD CONSTRAINT events_pkey PRIMARY KEY (id);

ALTER TABLE public.events
  ADD CONSTRAINT events_time_range_check CHECK (ends_at > starts_at);

GRANT ALL ON public.events TO anon;

GRANT ALL ON public.events TO authenticated;

GRANT ALL ON public.events TO service_role;

CREATE INDEX events_owner_id_idx ON public.events (owner_id);

CREATE INDEX events_type_idx ON public.events (event_type);

CREATE INDEX events_ticket_id_idx ON public.events (ticket_id)
  WHERE ticket_id IS NOT NULL;

CREATE INDEX events_starts_at_idx ON public.events (starts_at);

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_events_updated_at();

CREATE POLICY events_delete_permitted ON public.events
  FOR DELETE
  TO authenticated
  USING (public.can_edit_event(id));

CREATE POLICY events_insert_own ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK ((owner_id = auth.uid()));

CREATE POLICY events_select_all ON public.events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY events_update_permitted ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_event(id))
  WITH CHECK (public.can_edit_event(id));

CREATE TABLE public.profiles (
  id         uuid                     NOT NULL,
  full_name  text,
  role       public.roles             DEFAULT 'agent'::public.roles NOT NULL,
  department text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);

ALTER TABLE public.events
  ADD CONSTRAINT events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

GRANT ALL ON public.profiles TO anon;

GRANT ALL ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

CREATE INDEX profiles_department_idx ON public.profiles (department);

CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  USING (((id = auth.uid()) OR public.is_admin() OR (public."current_role"() = ANY (ARRAY['agent'::public.roles, 'manager'::public.roles]))));

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE
  USING (((id = auth.uid()) OR public.is_admin()))
  WITH CHECK (((id = auth.uid()) OR public.is_admin()));

CREATE TABLE public.slas (
  id                     uuid                   DEFAULT gen_random_uuid() NOT NULL,
  name                   text                   NOT NULL,
  priority               public.ticket_priority NOT NULL,
  first_response_minutes integer                NOT NULL,
  resolution_minutes     integer                NOT NULL
);

ALTER TABLE public.slas
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.slas
  ADD CONSTRAINT slas_pkey PRIMARY KEY (id);

ALTER TABLE public.slas
  ADD CONSTRAINT slas_priority_unique UNIQUE (priority);

GRANT ALL ON public.slas TO anon;

GRANT ALL ON public.slas TO authenticated;

GRANT ALL ON public.slas TO service_role;

CREATE TRIGGER trg_log_sla_change
  AFTER INSERT OR UPDATE ON public.slas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_sla_change();

CREATE POLICY slas_manage_admin ON public.slas
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY slas_select_all ON public.slas
  FOR SELECT
  USING ((auth.role() = 'authenticated'::text));

CREATE TABLE public.ticket_attachments (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  tickets_id        uuid                     NOT NULL,
  uploaded_by_id    uuid                     NOT NULL,
  storage_path      text                     NOT NULL,
  original_filename text                     NOT NULL,
  mime_type         text,
  size_bytes        integer,
  created_at        timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.ticket_attachments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_attachments
  ADD CONSTRAINT ticket_attachments_pkey PRIMARY KEY (id);

ALTER TABLE public.ticket_attachments
  ADD CONSTRAINT ticket_attachments_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES public.profiles(id);

GRANT ALL ON public.ticket_attachments TO anon;

GRANT ALL ON public.ticket_attachments TO authenticated;

GRANT ALL ON public.ticket_attachments TO service_role;

CREATE POLICY attachments_insert ON public.ticket_attachments
  FOR INSERT
  WITH CHECK (((uploaded_by_id = auth.uid()) AND public.can_act_on_ticket(tickets_id)));

CREATE POLICY attachments_select ON public.ticket_attachments
  FOR SELECT
  USING (public.can_view_ticket(tickets_id));

CREATE TABLE public.ticket_categories (
  id               uuid                   DEFAULT gen_random_uuid() NOT NULL,
  name             text                   NOT NULL,
  default_priority public.ticket_priority DEFAULT 'medium'::public.ticket_priority NOT NULL,
  default_sla_id   uuid,
  parent_id        uuid,
  code             text                   NOT NULL
);

ALTER TABLE public.ticket_categories
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_categories
  ADD CONSTRAINT ticket_categories_code_key UNIQUE (code);

ALTER TABLE public.ticket_categories
  ADD CONSTRAINT ticket_categories_default_sla_id_fkey FOREIGN KEY (default_sla_id) REFERENCES public.slas(id);

ALTER TABLE public.ticket_categories
  ADD CONSTRAINT ticket_categories_pkey PRIMARY KEY (id);

ALTER TABLE public.ticket_categories
  ADD CONSTRAINT ticket_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ticket_categories(id);

GRANT ALL ON public.ticket_categories TO anon;

GRANT ALL ON public.ticket_categories TO authenticated;

GRANT ALL ON public.ticket_categories TO service_role;

CREATE POLICY categories_manage_admin ON public.ticket_categories
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY categories_select_all ON public.ticket_categories
  FOR SELECT
  USING ((auth.role() = 'authenticated'::text));

CREATE TABLE public.ticket_comments (
  id          uuid                     DEFAULT gen_random_uuid() NOT NULL,
  ticket_id   uuid                     NOT NULL,
  user_id     uuid                     NOT NULL,
  body        text                     NOT NULL,
  is_internal boolean                  DEFAULT false NOT NULL,
  created_at  timestamp with time zone DEFAULT now() NOT NULL,
  updated_at  timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.ticket_comments
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_comments
  ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);

ALTER TABLE public.ticket_comments
  ADD CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

GRANT ALL ON public.ticket_comments TO anon;

GRANT ALL ON public.ticket_comments TO authenticated;

GRANT ALL ON public.ticket_comments TO service_role;

CREATE POLICY comments_insert ON public.ticket_comments
  FOR INSERT
  WITH
    CHECK
    (((user_id = auth.uid()) AND public.can_view_ticket(ticket_id) AND (public."current_role"() = ANY (ARRAY['agent'::public.roles, 'admin'::public.roles,
    'manager'::public.roles]))));

CREATE POLICY comments_select ON public.ticket_comments
  FOR SELECT
  USING
    ((public.can_view_ticket(ticket_id) AND ((is_internal = false) OR (public."current_role"() = ANY (ARRAY['agent'::public.roles, 'admin'::public.roles,
    'manager'::public.roles])))));

CREATE POLICY comments_update ON public.ticket_comments
  FOR UPDATE
  USING (((user_id = auth.uid()) OR public.is_admin()))
  WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));

CREATE TABLE public.ticket_number_counters (
  year        integer NOT NULL,
  category_id uuid    NOT NULL,
  last_value  bigint  DEFAULT 0 NOT NULL
);

ALTER TABLE public.ticket_number_counters
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_number_counters
  ADD CONSTRAINT ticket_number_counters_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);

ALTER TABLE public.ticket_number_counters
  ADD CONSTRAINT ticket_number_counters_pkey PRIMARY KEY (year, category_id);

GRANT ALL ON public.ticket_number_counters TO anon;

GRANT ALL ON public.ticket_number_counters TO authenticated;

GRANT ALL ON public.ticket_number_counters TO service_role;

CREATE TABLE public.ticket_status_history (
  id                     uuid                     DEFAULT gen_random_uuid() NOT NULL,
  ticket_id              uuid                     NOT NULL,
  from_status            public.ticket_status,
  to_status              public.ticket_status     NOT NULL,
  changed_by_profile_id  uuid,
  changed_by_employee_id uuid,
  note                   text,
  created_at             timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.ticket_status_history
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_status_history
  ADD CONSTRAINT ticket_status_history_changed_by_employee_id_fkey FOREIGN KEY (changed_by_employee_id) REFERENCES public.employees(id);

ALTER TABLE public.ticket_status_history
  ADD CONSTRAINT ticket_status_history_changed_by_profile_id_fkey FOREIGN KEY (changed_by_profile_id) REFERENCES public.profiles(id);

ALTER TABLE public.ticket_status_history
  ADD CONSTRAINT ticket_status_history_pkey PRIMARY KEY (id);

GRANT ALL ON public.ticket_status_history TO anon;

GRANT ALL ON public.ticket_status_history TO authenticated;

GRANT ALL ON public.ticket_status_history TO service_role;

CREATE POLICY status_history_select ON public.ticket_status_history
  FOR SELECT
  USING (public.can_view_ticket(ticket_id));

CREATE TABLE public.ticket_watchers (
  id        uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  user_id   uuid NOT NULL
);

ALTER TABLE public.ticket_watchers
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ticket_watchers
  ADD CONSTRAINT ticket_watchers_pkey PRIMARY KEY (id);

ALTER TABLE public.ticket_watchers
  ADD CONSTRAINT ticket_watchers_ticket_id_user_id_key UNIQUE (ticket_id, user_id);

ALTER TABLE public.ticket_watchers
  ADD CONSTRAINT ticket_watchers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

GRANT ALL ON public.ticket_watchers TO anon;

GRANT ALL ON public.ticket_watchers TO authenticated;

GRANT ALL ON public.ticket_watchers TO service_role;

CREATE POLICY watchers_manage_self ON public.ticket_watchers
  USING (((user_id = auth.uid()) OR public.is_admin()))
  WITH CHECK (((user_id = auth.uid()) OR public.is_admin()));

CREATE POLICY watchers_select ON public.ticket_watchers
  FOR SELECT
  USING (public.can_view_ticket(ticket_id));

CREATE TABLE public.tickets (
  id                    uuid                     DEFAULT gen_random_uuid() NOT NULL,
  ticket_number         text                     NOT NULL,
  title                 text                     NOT NULL,
  description           text                     NOT NULL,
  requester_id          uuid                     NOT NULL,
  assigned_to_id        uuid,
  category_id           uuid                     NOT NULL,
  priority              public.ticket_priority   DEFAULT 'medium'::public.ticket_priority NOT NULL,
  status                public.ticket_status     DEFAULT 'pending_confirmation'::public.ticket_status NOT NULL,
  source                public.ticket_source     DEFAULT 'web'::public.ticket_source NOT NULL,
  department            text,
  due_at                timestamp with time zone,
  first_response_at     timestamp with time zone,
  resolved_at           timestamp with time zone,
  closed_at             timestamp with time zone,
  asset_id              uuid,
  created_at            timestamp with time zone DEFAULT now() NOT NULL,
  updated_at            timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at            timestamp with time zone,
  first_response_due_at timestamp with time zone
);

CREATE POLICY attachments_delete ON public.ticket_attachments
  FOR DELETE
  USING ((((uploaded_by_id = auth.uid()) OR public.is_admin()) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = ticket_attachments.tickets_id) AND (t.status = 'pending_confirmation'::public.ticket_status))))));

ALTER TABLE public.tickets
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.profiles(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.ticket_categories(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);

ALTER TABLE public.events
  ADD CONSTRAINT events_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_attachments
  ADD CONSTRAINT ticket_attachments_tickets_id_fkey FOREIGN KEY (tickets_id) REFERENCES public.tickets(id);

ALTER TABLE public.ticket_comments
  ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

ALTER TABLE public.ticket_status_history
  ADD CONSTRAINT ticket_status_history_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

ALTER TABLE public.ticket_watchers
  ADD CONSTRAINT ticket_watchers_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.employees(id);

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);

GRANT ALL ON public.tickets TO anon;

GRANT ALL ON public.tickets TO authenticated;

GRANT ALL ON public.tickets TO service_role;

CREATE INDEX tickets_department_idx ON public.tickets (department);

CREATE INDEX tickets_requester_id_idx ON public.tickets (requester_id);

CREATE INDEX tickets_assigned_to_id_idx ON public.tickets (assigned_to_id);

CREATE INDEX tickets_status_idx ON public.tickets (status);

CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_number();

CREATE TRIGGER trg_log_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_status_change();

CREATE TRIGGER trg_log_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ticket_created();

CREATE TRIGGER trg_log_ticket_soft_delete
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  WHEN (old.deleted_at IS NULL AND new.deleted_at IS NOT NULL)
  EXECUTE FUNCTION public.log_ticket_soft_delete();

CREATE TRIGGER trg_log_ticket_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ticket_status_change();

CREATE TRIGGER trg_set_ticket_department
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_department();

CREATE TRIGGER trg_set_ticket_sla_deadlines
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_sla_deadlines();

CREATE POLICY tickets_insert ON public.tickets
  FOR INSERT
  WITH CHECK ((public."current_role"() = ANY (ARRAY['admin'::public.roles, 'agent'::public.roles])));

CREATE POLICY tickets_select ON public.tickets
  FOR SELECT
  USING
    (((assigned_to_id = auth.uid()) OR public.is_admin() OR (public."current_role"() = 'agent'::public.roles) OR ((public."current_role"() = 'manager'::public.roles) AND
    (department = public.current_department()))));

CREATE POLICY tickets_update_staff ON public.tickets
  FOR UPDATE
  USING ((public.is_admin() OR ((public."current_role"() = 'agent'::public.roles) AND ((assigned_to_id IS NULL) OR (assigned_to_id = auth.uid())))))
  WITH CHECK ((public.is_admin() OR ((public."current_role"() = 'agent'::public.roles) AND ((assigned_to_id IS NULL) OR (assigned_to_id = auth.uid())))));

CREATE VIEW public.dashboard_recent_activity AS SELECT al.id,
    al.actor_id,
    p.full_name AS actor_name,
    al.action,
    al.entity_type,
    al.entity_id,
    al.metadata,
    al.created_at
   FROM (public.activity_log al
     LEFT JOIN public.profiles p ON ((p.id = al.actor_id)))
  WHERE (public.get_caller_role() = 'admin'::text)
  ORDER BY al.created_at DESC
 LIMIT 20;

GRANT ALL ON public.dashboard_recent_activity TO authenticated;

GRANT ALL ON public.dashboard_recent_activity TO service_role;

CREATE VIEW public.dashboard_recent_tickets AS SELECT id,
    ticket_number,
    title,
    priority,
    status,
    category_id,
    created_at
   FROM public.tickets
  WHERE ((deleted_at IS NULL) AND ((public.get_caller_role() = 'admin'::text) OR ((public.get_caller_role() = 'agent'::text) AND (assigned_to_id = auth.uid()))))
  ORDER BY created_at DESC
 LIMIT 20;

GRANT ALL ON public.dashboard_recent_tickets TO authenticated;

GRANT ALL ON public.dashboard_recent_tickets TO service_role;

CREATE VIEW public.dashboard_ticket_counts AS SELECT count(*) FILTER (WHERE (status = 'open'::public.ticket_status)) AS open_count,
    count(*) FILTER (WHERE (status = 'in_progress'::public.ticket_status)) AS in_progress_count,
    count(*) FILTER (WHERE ((status <> ALL (ARRAY['resolved'::public.ticket_status, 'closed'::public.ticket_status])) AND (((first_response_at IS NULL) AND (first_response_due_at IS NOT NULL) AND (first_response_due_at > now()) AND (first_response_due_at <= (now() + '01:00:00'::interval))) OR ((due_at IS NOT NULL) AND (due_at > now()) AND (due_at <= (now() + '01:00:00'::interval)))))) AS approaching_sla_count,
    count(*) FILTER (WHERE (((first_response_at IS NULL) AND (first_response_due_at IS NOT NULL) AND (first_response_due_at <= now())) OR ((resolved_at IS NULL) AND (due_at IS NOT NULL) AND (due_at <= now())))) AS breached_sla_count
   FROM public.tickets
  WHERE ((deleted_at IS NULL) AND ((public.get_caller_role() = ANY (ARRAY['admin'::text, 'agent'::text])) OR ((public.get_caller_role() = 'manager'::text) AND (NOT (department IS DISTINCT FROM public.get_caller_department())))));

GRANT ALL ON public.dashboard_ticket_counts TO authenticated;

GRANT ALL ON public.dashboard_ticket_counts TO service_role;

CREATE VIEW public.dashboard_tickets_by_category AS SELECT root.id AS category_id,
    root.name AS category_name,
    count(t.id) AS ticket_count
   FROM ((public.ticket_categories root
     LEFT JOIN public.ticket_categories child ON ((child.parent_id = root.id)))
     LEFT JOIN public.tickets t ON (((t.deleted_at IS NULL) AND ((t.category_id = root.id) OR (t.category_id = child.id)) AND ((public.get_caller_role() = 'admin'::text) OR ((public.get_caller_role() = 'agent'::text) AND (t.assigned_to_id = auth.uid())) OR ((public.get_caller_role() = 'manager'::text) AND (NOT (t.department IS DISTINCT FROM public.get_caller_department())))))))
  WHERE ((root.parent_id IS NULL) AND (public.get_caller_role() = ANY (ARRAY['admin'::text, 'agent'::text, 'manager'::text])))
  GROUP BY root.id, root.name
  ORDER BY (count(t.id)) DESC;

GRANT ALL ON public.dashboard_tickets_by_category TO authenticated;

GRANT ALL ON public.dashboard_tickets_by_category TO service_role;

CREATE VIEW public.dashboard_tickets_opened_daily AS SELECT date_trunc('day'::text, created_at) AS day,
    priority,
    count(*) AS ticket_count
   FROM public.tickets
  WHERE ((deleted_at IS NULL) AND ((public.get_caller_role() = ANY (ARRAY['admin'::text, 'agent'::text])) OR ((public.get_caller_role() = 'manager'::text) AND (NOT (department IS DISTINCT FROM public.get_caller_department())))))
  GROUP BY (date_trunc('day'::text, created_at)), priority
  ORDER BY (date_trunc('day'::text, created_at)) DESC;

GRANT ALL ON public.dashboard_tickets_opened_daily TO authenticated;

GRANT ALL ON public.dashboard_tickets_opened_daily TO service_role;
