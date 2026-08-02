// app/(authenticated)/calendar/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getEventOwners } from '@/lib/calendar-actions';
import { redirect } from 'next/navigation';
import { CalendarShell } from './components/CalendarShell';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, department')
    .eq('id', user.id)
    .single();

  if (error || !profile) redirect('/error');

  const owners = await getEventOwners();

  return (
    // Added a wrapper div here with max-width, margin-auto for centering, and padding
    <div className="mx-auto max-w-5xl px-4 py-8 w-full">
      <CalendarShell
        currentUserId={profile.id}
        currentUserRole={profile.role}
        currentUserDepartment={profile.department}
        owners={owners}
      />
    </div>
  );
}