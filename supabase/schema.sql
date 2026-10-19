create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('student', 'teacher', 'administrator');
exception
  when duplicate_object then null;
end
$$;

alter type public.user_role add value if not exists 'administrator';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  venue text not null default '',
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at),
  constraint events_status_check check (status in ('open', 'closed'))
);

alter table public.events add column if not exists venue text not null default '';
alter table public.events add column if not exists description text not null default '';
alter table public.events add column if not exists status text not null default 'open';

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  status text not null default 'present',
  unique (event_id, student_id)
);

alter table public.attendance add column if not exists status text not null default 'present';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_status_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_status_check check (status in ('open', 'closed'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'attendance_status_check'
      and conrelid = 'public.attendance'::regclass
  ) then
    alter table public.attendance
      add constraint attendance_status_check check (status in ('present'));
  end if;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New user'),
    'student'::public.user_role
  );
  return new;
end;
$$;

insert into public.profiles (id, full_name, role)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), 'New user'),
  'student'::public.user_role
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role::text = 'administrator'
  );
$$;

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.current_user_is_administrator() then
    return new;
  end if;

  if new.role::text = 'administrator' then
    raise exception 'Only an administrator can assign the administrator role.';
  end if;

  if tg_op = 'UPDATE' and old.role is distinct from new.role then
    raise exception 'Only an administrator can change account roles.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_attendance_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  attendance_event public.events%rowtype;
  attendance_time timestamptz;
begin
  if auth.uid() is distinct from new.student_id then
    raise exception using errcode = 'P0001', message = 'attendance_unauthorized';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = new.student_id
      and role = 'student'
  ) then
    raise exception using errcode = 'P0001', message = 'attendance_unauthorized';
  end if;

  select * into attendance_event
  from public.events
  where id = new.event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'attendance_event_not_found';
  end if;

  attendance_time := clock_timestamp();

  if attendance_event.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'attendance_event_closed';
  end if;

  if attendance_time < attendance_event.starts_at then
    raise exception using errcode = 'P0001', message = 'attendance_event_not_started';
  end if;

  if attendance_time > attendance_event.ends_at then
    raise exception using errcode = 'P0001', message = 'attendance_event_ended';
  end if;

  new.scanned_at := attendance_time;
  new.status := 'present';
  return new;
end;
$$;

drop trigger if exists validate_attendance_before_insert on public.attendance;
create trigger validate_attendance_before_insert
  before insert on public.attendance
  for each row execute procedure public.validate_attendance_insert();

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
  before insert or update on public.profiles
  for each row execute procedure public.prevent_self_role_change();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users can create their profile" on public.profiles;
create policy "Users can create their profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id and role = 'student');
drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees"
  on public.profiles for select to authenticated using (
    exists (
      select 1
      from public.attendance
      join public.events on events.id = attendance.event_id
      where attendance.student_id = profiles.id
        and events.created_by = auth.uid()
    )
  );
drop policy if exists "Administrators can manage all profiles" on public.profiles;
create policy "Administrators can manage all profiles"
  on public.profiles for all to authenticated
  using (public.current_user_is_administrator())
  with check (public.current_user_is_administrator());
drop policy if exists "Administrators can read all profiles" on public.profiles;
create policy "Administrators can read all profiles"
  on public.profiles for select to authenticated
  using (public.current_user_is_administrator());

drop policy if exists "Anyone authenticated can read events" on public.events;
create policy "Anyone authenticated can read events"
  on public.events for select to authenticated using (true);
drop policy if exists "Administrators can read all events" on public.events;
create policy "Administrators can read all events"
  on public.events for select to authenticated
  using (public.current_user_is_administrator());
drop policy if exists "Teachers can create events" on public.events;
create policy "Teachers can create events"
  on public.events for insert to authenticated
  with check (
    auth.uid() = created_by and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );
drop policy if exists "Teachers can update their events" on public.events;
create policy "Teachers can update their events"
  on public.events for update to authenticated
  using (
    auth.uid() = created_by and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  )
  with check (
    auth.uid() = created_by and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );
drop policy if exists "Teachers can delete their events" on public.events;
create policy "Teachers can delete their events"
  on public.events for delete to authenticated
  using (
    auth.uid() = created_by and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );
drop policy if exists "Administrators can manage all events" on public.events;
create policy "Administrators can manage all events"
  on public.events for all to authenticated
  using (public.current_user_is_administrator())
  with check (public.current_user_is_administrator());

drop policy if exists "Students can read their attendance" on public.attendance;
create policy "Students can read their attendance"
  on public.attendance for select to authenticated using (auth.uid() = student_id);
drop policy if exists "Teachers can read attendance for their events" on public.attendance;
create policy "Teachers can read attendance for their events"
  on public.attendance for select to authenticated using (
    exists (select 1 from public.events where events.id = attendance.event_id and events.created_by = auth.uid())
  );
drop policy if exists "Students can record their attendance" on public.attendance;
create policy "Students can record their attendance"
  on public.attendance for insert to authenticated
  with check (
    auth.uid() = student_id and
    exists (
      select 1
      from public.profiles
      where id = auth.uid() and role = 'student'
    )
  );
drop policy if exists "Administrators can manage all attendance" on public.attendance;
create policy "Administrators can manage all attendance"
  on public.attendance for all to authenticated
  using (public.current_user_is_administrator())
  with check (public.current_user_is_administrator());

-- After registering your account, promote it once in the Supabase SQL Editor:
-- update public.profiles
-- set role = 'administrator', updated_at = now()
-- where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');r