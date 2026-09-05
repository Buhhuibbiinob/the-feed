-- Run this once in the Supabase SQL editor, same as the others.
--
-- Eighteen themes became five, one per decade. This moves everybody who
-- was sitting on a retired one to the decade it was always dressed as.
--
-- Nothing here is load-bearing: the app already maps retired ids in code
-- (RETIRED_THEMES in src/lib/themes.ts), so a site that never runs this
-- renders exactly the same thing. What it buys is that the value in the
-- database matches the value on the screen, so the next person to read
-- the profiles table is not looking at a theme that no longer exists.
--
-- Safe to run more than once.

update public.profiles
set theme = case theme
  -- Web 1.0 and the blog era.
  when 'tumblr'          then 'decade-90s'
  -- Y2K, bling, and the glossy middle of the decade.
  when 'myspace'         then 'decade-00s'
  when 'mcbling'         then 'decade-00s'
  when 'scene'           then 'decade-00s'
  when 'emo'             then 'decade-00s'
  when 'frutiger-aero'   then 'decade-00s'
  when 'champagne-bling' then 'decade-00s'
  when 'zebra-bling'     then 'decade-00s'
  when 'tropical'        then 'decade-00s'
  -- Flat, neon, and the social-network decade.
  when 'twitter'         then 'decade-10s'
  when 'youtube'         then 'decade-10s'
  when 'frutiger-metro'  then 'decade-10s'
  when 'party-rock-2010' then 'decade-10s'
  when 'swag-2018'       then 'decade-10s'
  when 'mm2016'          then 'decade-10s'
  when 'plur-rave'       then 'decade-10s'
  when 'ios7-rainbow'    then 'decade-10s'
  else theme
end
where theme in (
  'tumblr', 'myspace', 'mcbling', 'scene', 'emo', 'frutiger-aero',
  'champagne-bling', 'zebra-bling', 'tropical', 'twitter', 'youtube',
  'frutiger-metro', 'party-rock-2010', 'swag-2018', 'mm2016',
  'plur-rave', 'ios7-rainbow'
);

-- The same for the site-wide theme, if an admin had forced one of them.
update public.site_settings
set value = 'decade-00s'
where key = 'site_theme'
  and value in ('myspace', 'mcbling', 'scene', 'emo', 'frutiger-aero',
                'champagne-bling', 'zebra-bling', 'tropical');

update public.site_settings
set value = 'decade-10s'
where key = 'site_theme'
  and value in ('twitter', 'youtube', 'frutiger-metro', 'party-rock-2010',
                'swag-2018', 'mm2016', 'plur-rave', 'ios7-rainbow');

update public.site_settings
set value = 'decade-90s'
where key = 'site_theme' and value = 'tumblr';

-- Token overrides an admin had tuned on a retired theme would now belong
-- to nothing. They are dropped rather than carried across: five themes
-- were retuned into one, and inheriting one of their palettes at random
-- would quietly override the new theme's own colours.
delete from public.site_theme_tokens
where theme not in (
  'ios-light', 'custom',
  'decade-70s', 'decade-80s', 'decade-90s', 'decade-00s', 'decade-10s'
);
