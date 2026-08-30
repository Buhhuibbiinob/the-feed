-- Run this once in the Supabase SQL editor, same as the others.
--
-- Two nullable columns so a sticker can have a separate position on a
-- phone. Null means "use the existing position", so nothing already
-- placed moves. Safe to run more than once.

-- ---------- Per-viewport sticker placement ----------
-- A sticker's x and y are both percentages of the page's WIDTH. That keeps
-- a sticker still while the page grows taller, which is what it was chosen
-- for - but it means the same y lands somewhere completely different on a
-- phone, where the page is half as wide and twice as tall because the two
-- columns become one.
--
-- Nullable on purpose. Null means "no separate phone position, use the one
-- you already have", so every sticker anybody has already placed renders
-- exactly as it does today and nobody's page moves. A phone position is
-- only written when somebody actually drags a sticker on a phone.
alter table public.profile_stickers add column if not exists mobile_x numeric;
alter table public.profile_stickers add column if not exists mobile_y numeric;
