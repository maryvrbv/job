-- "Вакансия удалена": the posting was taken down before I applied.
-- closed_at is the day I noticed, so closed_at - posted_at is how long the vacancy lived.
alter table public.jobs add column if not exists closed_at date;
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check check (status in (
  'Не откликалась', 'Откликнулась', 'Написала рекрутеру', 'Скрининг с HR',
  'Собес с лидом', 'Тестовое', 'Финальный собес', 'Оффер', 'Отказ', 'Не подходит', 'Вакансия удалена'));
