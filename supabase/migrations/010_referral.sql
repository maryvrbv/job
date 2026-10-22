-- Marks a vacancy that came through a referral (someone recommended Masha); shown as a chip and settable in the card
alter table public.jobs add column if not exists referral boolean not null default false;
