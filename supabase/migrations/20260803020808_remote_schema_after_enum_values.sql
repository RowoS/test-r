-- Migration unit 2: after_enum_values
-- Transaction mode: transactional
-- Boundary reason: enum_value_visibility

SET check_function_bodies = false;

CREATE FUNCTION public.annotate_deleted_reservation_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update public.events
  set room_reservation_id = null,
      description = 'Room reservation was deleted. This event is no longer tied to a specific room.'
  where room_reservation_id = old.id;
 
  return old;
end;
$function$;

GRANT ALL ON FUNCTION public.annotate_deleted_reservation_event() TO anon;

GRANT ALL ON FUNCTION public.annotate_deleted_reservation_event() TO authenticated;

GRANT ALL ON FUNCTION public.annotate_deleted_reservation_event() TO service_role;

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

CREATE FUNCTION public.can_manage_reservation (
  _reservation_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from public.room_reservations r
    where r.id = _reservation_id
    and (
      r.organizer_id = auth.uid()
      or public.is_admin()
    )
  );
$function$;

GRANT ALL ON FUNCTION public.can_manage_reservation(uuid) TO anon;

GRANT ALL ON FUNCTION public.can_manage_reservation(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.can_manage_reservation(uuid) TO service_role;

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

CREATE FUNCTION public.log_conference_room_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'conference_room.created' else 'conference_room.updated' end,
    'conference_room',
    new.id,
    jsonb_build_object('name', new.name, 'location', new.location, 'capacity', new.capacity, 'is_active', new.is_active)
  );
 
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.log_conference_room_change() TO anon;

GRANT ALL ON FUNCTION public.log_conference_room_change() TO authenticated;

GRANT ALL ON FUNCTION public.log_conference_room_change() TO service_role;

CREATE FUNCTION public.log_room_reservation_activity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_attach_event_id uuid;
begin
  if tg_op = 'INSERT' then
    -- Same setting create_room_reservation hands to the calendar-sync
    -- trigger; reading it here too records whether this booking
    -- attached to an existing event or created a fresh one.
    v_attach_event_id := nullif(current_setting('app.attach_to_event_id', true), '')::uuid;
 
    insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'room_reservation.created',
      'room_reservation',
      new.id,
      jsonb_build_object(
        'room_id', new.room_id,
        'title', new.title,
        'starts_at', new.starts_at,
        'ends_at', new.ends_at,
        'attached_to_event_id', v_attach_event_id
      )
    );
 
    return new;
  end if;
 
  if tg_op = 'UPDATE' then
    if new.cancelled_at is not null and old.cancelled_at is null then
      insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (
        auth.uid(),
        'room_reservation.cancelled',
        'room_reservation',
        new.id,
        jsonb_build_object('cancelled_by', new.cancelled_by)
      );
      return new;
    end if;
 
    if new.cancelled_at is null and old.cancelled_at is not null then
      insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (
        auth.uid(),
        'room_reservation.reactivated',
        'room_reservation',
        new.id,
        jsonb_build_object('room_id', new.room_id, 'starts_at', new.starts_at, 'ends_at', new.ends_at)
      );
      return new;
    end if;
 
    if new.cancelled_at is null and (
      new.title     is distinct from old.title or
      new.starts_at is distinct from old.starts_at or
      new.ends_at   is distinct from old.ends_at or
      new.room_id   is distinct from old.room_id
    ) then
      insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
      values (
        auth.uid(),
        'room_reservation.updated',
        'room_reservation',
        new.id,
        jsonb_build_object(
          'from', jsonb_build_object('room_id', old.room_id, 'title', old.title, 'starts_at', old.starts_at, 'ends_at', old.ends_at),
          'to',   jsonb_build_object('room_id', new.room_id, 'title', new.title, 'starts_at', new.starts_at, 'ends_at', new.ends_at)
        )
      );
    end if;
 
    return new;
  end if;
 
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.log_room_reservation_activity() TO anon;

GRANT ALL ON FUNCTION public.log_room_reservation_activity() TO authenticated;

GRANT ALL ON FUNCTION public.log_room_reservation_activity() TO service_role;

CREATE FUNCTION public.log_room_reservation_deleted()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.activity_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'room_reservation.deleted',
    'room_reservation',
    old.id,
    jsonb_build_object('room_id', old.room_id, 'title', old.title, 'starts_at', old.starts_at, 'ends_at', old.ends_at)
  );
 
  return old;
end;
$function$;

GRANT ALL ON FUNCTION public.log_room_reservation_deleted() TO anon;

GRANT ALL ON FUNCTION public.log_room_reservation_deleted() TO authenticated;

GRANT ALL ON FUNCTION public.log_room_reservation_deleted() TO service_role;

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

CREATE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;

GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;

GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

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

CREATE FUNCTION public.sync_room_reservation_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_room_name       text;
  v_attach_event_id uuid;
begin
  if tg_op = 'INSERT' then
    v_attach_event_id := nullif(current_setting('app.attach_to_event_id', true), '')::uuid;
    select name into v_room_name from public.conference_rooms where id = new.room_id;
 
    if v_attach_event_id is not null then
      -- public.create_room_reservation already checked that this event
      -- exists, is unclaimed, and the caller is allowed to edit it —
      -- but that check and this update aren't atomic with each other,
      -- so re-check room_reservation_id IS NULL here too. If two
      -- attach attempts race, only the first UPDATE finds a matching
      -- row; the second hits "not found" and raises instead of
      -- stealing the event out from under the first.
      update public.events
      set room_reservation_id = new.id,
          title       = new.title,
          description = 'Conference room reservation — ' || coalesce(v_room_name, 'room'),
          starts_at   = new.starts_at,
          ends_at     = new.ends_at
      where id = v_attach_event_id
        and room_reservation_id is null;
 
      if not found then
        raise exception 'Event % is no longer available to attach this reservation to.', v_attach_event_id;
      end if;
    else
      insert into public.events (title, description, event_type, room_reservation_id, owner_id, starts_at, ends_at)
      values (
        new.title,
        'Conference room reservation — ' || coalesce(v_room_name, 'room'),
        'room_reservation',
        new.id,
        new.organizer_id,
        new.starts_at,
        new.ends_at
      );
    end if;
 
    return new;
  end if;
 
  if tg_op = 'UPDATE' then
    -- Cancelling frees the room but leaves the event on the calendar —
    -- it just stops pointing at this reservation, since the meeting
    -- may still occur elsewhere. The description is updated so anyone
    -- looking at the event understands the room fell through.
    if new.cancelled_at is not null and old.cancelled_at is null then
      update public.events
      set room_reservation_id = null,
          description = 'Room reservation was cancelled. This event is no longer tied to a specific room.'
      where room_reservation_id = new.id;
      return new;
    end if;
 
    -- Reactivating a previously-cancelled reservation creates a new
    -- calendar entry, since the reservation no longer has one linked
    -- (cancellation unlinked it rather than deleting it — see above).
    if new.cancelled_at is null and old.cancelled_at is not null then
      select name into v_room_name from public.conference_rooms where id = new.room_id;
 
      insert into public.events (title, description, event_type, room_reservation_id, owner_id, starts_at, ends_at)
      values (
        new.title,
        'Conference room reservation — ' || coalesce(v_room_name, 'room'),
        'room_reservation',
        new.id,
        new.organizer_id,
        new.starts_at,
        new.ends_at
      );
 
      return new;
    end if;
 
    -- Otherwise, keep the existing event's title/description/timing in
    -- sync with whatever changed on the reservation (room, title, or
    -- time range).
    if new.cancelled_at is null and (
      new.title     is distinct from old.title or
      new.starts_at is distinct from old.starts_at or
      new.ends_at   is distinct from old.ends_at or
      new.room_id   is distinct from old.room_id
    ) then
      select name into v_room_name from public.conference_rooms where id = new.room_id;
 
      update public.events
      set title       = new.title,
          description = 'Conference room reservation — ' || coalesce(v_room_name, 'room'),
          starts_at   = new.starts_at,
          ends_at     = new.ends_at
      where room_reservation_id = new.id;
    end if;
 
    return new;
  end if;
 
  return new;
end;
$function$;

GRANT ALL ON FUNCTION public.sync_room_reservation_event() TO anon;

GRANT ALL ON FUNCTION public.sync_room_reservation_event() TO authenticated;

GRANT ALL ON FUNCTION public.sync_room_reservation_event() TO service_role;

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

CREATE TABLE public.conference_rooms (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  name       text                     NOT NULL,
  location   text,
  capacity   integer                  NOT NULL,
  is_active  boolean                  DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.conference_rooms
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conference_rooms
  ADD CONSTRAINT conference_rooms_capacity_check CHECK (capacity > 0);

ALTER TABLE public.conference_rooms
  ADD CONSTRAINT conference_rooms_name_key UNIQUE (name);

ALTER TABLE public.conference_rooms
  ADD CONSTRAINT conference_rooms_pkey PRIMARY KEY (id);

GRANT ALL ON public.conference_rooms TO anon;

GRANT ALL ON public.conference_rooms TO authenticated;

GRANT ALL ON public.conference_rooms TO service_role;

CREATE TRIGGER trg_conference_rooms_updated_at
  BEFORE UPDATE ON public.conference_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_log_conference_room_change
  AFTER INSERT OR UPDATE ON public.conference_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.log_conference_room_change();

CREATE POLICY conference_rooms_manage_admin ON public.conference_rooms
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY conference_rooms_select_all ON public.conference_rooms
  FOR SELECT
  USING ((auth.role() = 'authenticated'::text));

ALTER TABLE public.events
  ADD COLUMN room_reservation_id uuid;

CREATE UNIQUE INDEX events_room_reservation_id_uidx ON public.events (room_reservation_id)
  WHERE room_reservation_id IS NOT NULL;

CREATE TABLE public.room_reservation_attendees (
  id             uuid DEFAULT gen_random_uuid() NOT NULL,
  reservation_id uuid NOT NULL,
  employee_id    uuid NOT NULL
);

ALTER TABLE public.room_reservation_attendees
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.room_reservation_attendees
  ADD CONSTRAINT room_reservation_attendees_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);

ALTER TABLE public.room_reservation_attendees
  ADD CONSTRAINT room_reservation_attendees_pkey PRIMARY KEY (id);

ALTER TABLE public.room_reservation_attendees
  ADD CONSTRAINT room_reservation_attendees_unique UNIQUE (reservation_id, employee_id);

GRANT ALL ON public.room_reservation_attendees TO anon;

GRANT ALL ON public.room_reservation_attendees TO authenticated;

GRANT ALL ON public.room_reservation_attendees TO service_role;

CREATE POLICY reservation_attendees_manage ON public.room_reservation_attendees
  USING (public.can_manage_reservation(reservation_id))
  WITH CHECK (public.can_manage_reservation(reservation_id));

CREATE POLICY reservation_attendees_select ON public.room_reservation_attendees
  FOR SELECT
  USING ((( SELECT auth.role() AS ROLE) = 'authenticated'::text));

CREATE TABLE public.room_reservations (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  room_id      uuid                     NOT NULL,
  organizer_id uuid                     NOT NULL,
  title        text                     NOT NULL,
  starts_at    timestamp with time zone NOT NULL,
  ends_at      timestamp with time zone NOT NULL,
  cancelled_at timestamp with time zone,
  cancelled_by uuid,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

CREATE FUNCTION public.create_room_reservation (
  p_room_id   uuid,
  p_title     text,
  p_starts_at timestamp with time zone,
  p_ends_at   timestamp with time zone,
  p_event_id  uuid                     DEFAULT NULL::uuid
)
  RETURNS public.room_reservations
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_row public.room_reservations;
begin
  if p_event_id is not null then
    if not exists (
      select 1 from public.events e
      where e.id = p_event_id
        and e.room_reservation_id is null
        and public.can_edit_event(p_event_id)
    ) then
      raise exception 'That event is not available to attach a room reservation to.';
    end if;
 
    perform set_config('app.attach_to_event_id', p_event_id::text, true);
  end if;
 
  insert into public.room_reservations (room_id, organizer_id, title, starts_at, ends_at)
  values (p_room_id, auth.uid(), p_title, p_starts_at, p_ends_at)
  returning * into v_row;
 
  return v_row;
end;
$function$;

GRANT ALL ON FUNCTION public.create_room_reservation(uuid, text, timestamp WITH time zone, timestamp WITH time zone, uuid) TO anon;

GRANT ALL ON FUNCTION public.create_room_reservation(uuid, text, timestamp WITH time zone, timestamp WITH time zone, uuid) TO authenticated;

GRANT ALL ON FUNCTION public.create_room_reservation(uuid, text, timestamp WITH time zone, timestamp WITH time zone, uuid) TO service_role;

ALTER TABLE public.room_reservations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id);

ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_no_overlap EXCLUDE USING gist (room_id WITH =, tstzrange(starts_at, ends_at, '[)'::text) WITH &&) WHERE (cancelled_at IS NULL);

ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.profiles(id);

ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_pkey PRIMARY KEY (id);

ALTER TABLE public.events
  ADD CONSTRAINT events_room_reservation_id_fkey FOREIGN KEY (room_reservation_id) REFERENCES public.room_reservations(id) ON DELETE SET NULL;

ALTER TABLE public.room_reservation_attendees
  ADD CONSTRAINT room_reservation_attendees_reservation_id_fkey FOREIGN KEY (reservation_id) REFERENCES public.room_reservations(id) ON DELETE CASCADE;

ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.conference_rooms(id);

ALTER TABLE public.room_reservations
  ADD CONSTRAINT room_reservations_time_range_check CHECK (ends_at > starts_at);

GRANT ALL ON public.room_reservations TO anon;

GRANT ALL ON public.room_reservations TO authenticated;

GRANT ALL ON public.room_reservations TO service_role;

CREATE INDEX room_reservations_room_id_starts_at_idx ON public.room_reservations (room_id, starts_at);

CREATE INDEX room_reservations_organizer_id_idx ON public.room_reservations (organizer_id);

CREATE TRIGGER trg_annotate_deleted_reservation_event
  BEFORE DELETE ON public.room_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.annotate_deleted_reservation_event();

CREATE TRIGGER trg_log_room_reservation_activity
  AFTER INSERT OR UPDATE ON public.room_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_room_reservation_activity();

CREATE TRIGGER trg_log_room_reservation_deleted
  BEFORE DELETE ON public.room_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_room_reservation_deleted();

CREATE TRIGGER trg_room_reservations_updated_at
  BEFORE UPDATE ON public.room_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sync_room_reservation_event
  AFTER INSERT OR UPDATE ON public.room_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_room_reservation_event();

CREATE POLICY room_reservations_delete_admin ON public.room_reservations
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY room_reservations_insert_own ON public.room_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK ((organizer_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY room_reservations_select_all ON public.room_reservations
  FOR SELECT
  USING ((( SELECT auth.role() AS ROLE) = 'authenticated'::text));

CREATE POLICY room_reservations_update_own ON public.room_reservations
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_reservation(id))
  WITH CHECK (public.can_manage_reservation(id));
