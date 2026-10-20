Reference code only. NOT connected to Myler Feed. Never run end to end.
Written: a_head.html (UI/CSS), b_core.js (utils, catalog, audio, persistence adapter), c1_gfx.js (renderer, textures, models), c2_world.js (store, bedroom, crate, selection ring).
Not written: game logic (input, state machine, hand tweening, sequences, overlays wiring).
Persistence in b_core.js targets a sandbox-only database; replace with the app's server API.
