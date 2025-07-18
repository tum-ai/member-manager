This folder contains all the Deno functions present in Supabase at the time of commit. This serves zero purpose for the React Frontend, this is present just for SCM support for Deno functions since Supabase doesn't have that.

Until I find a systematic way to do this, I shall place all TS files here.
One other way I already know is to use Supabase CLI, fetch all the functions to this folder and maintain. That way we can batch process the deployment whenever we make a change.