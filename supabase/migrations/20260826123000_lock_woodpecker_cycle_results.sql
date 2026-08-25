drop policy if exists "No direct access to Woodpecker cycle results" on public.student_woodpecker_cycle_results;

create policy "No direct access to Woodpecker cycle results"
on public.student_woodpecker_cycle_results
for all
to anon, authenticated
using (false)
with check (false);
