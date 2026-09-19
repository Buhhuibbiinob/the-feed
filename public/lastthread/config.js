/* LastThread: where the site finds its database.

   Both values below are meant to be public. The anon key is designed to sit in
   a web page; what it can actually do is decided by the row level security
   policies in supabase/migrations/020-lastthread.sql, not by keeping it secret.
   Never put the service role key here. That one is a skeleton key.

   To switch accounts on:
     1. Supabase dashboard, Settings, API.
     2. Copy the Project URL and the anon public key into the two lines below.
     3. Run supabase/migrations/020-lastthread.sql in the SQL editor.

   Left blank, the site still works exactly as it did before: everything saves
   in your own browser and nothing is shared. */

window.LASTTHREAD_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: ''
};
