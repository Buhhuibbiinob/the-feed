/* LastThread: where the site finds its database.

   On the live site you do not need to touch this file. /lastthread/env.js is
   served by the app from the project's own environment variables, and it runs
   first. This file only fills in the gap when that is not available, which
   means opening the pages straight off your disk.

   If you ever do want to hardcode them, both values are safe to publish: the
   URL is an address, and the publishable (anon) key can only do what the row
   level security policies in supabase/migrations/020-lastthread.sql allow.
   Never put a secret or service_role key here. */

window.LASTTHREAD_CONFIG = (window.LASTTHREAD_CONFIG && window.LASTTHREAD_CONFIG.supabaseUrl)
  ? window.LASTTHREAD_CONFIG
  : {
      supabaseUrl: '',
      supabaseAnonKey: ''
    };
