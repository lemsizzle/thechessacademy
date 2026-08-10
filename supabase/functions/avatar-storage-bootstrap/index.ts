import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(() =>
  Response.json(
    { error: "Avatar storage bootstrap is disabled." },
    { status: 410 },
  )
);
