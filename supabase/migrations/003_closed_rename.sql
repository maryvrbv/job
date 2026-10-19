-- «Вакансия удалена» → «Отклики закрыты»: the posting often stays up, only applications are closed.
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs disable trigger jobs_touch; -- a rename is not a status change, keep job_events clean
update public.jobs set status = 'Отклики закрыты' where status = 'Вакансия удалена';
alter table public.jobs enable trigger jobs_touch;
update public.job_events set to_status = 'Отклики закрыты' where to_status = 'Вакансия удалена';
update public.job_events set from_status = 'Отклики закрыты' where from_status = 'Вакансия удалена';
alter table public.jobs add constraint jobs_status_check check (status in (
  'Не откликалась', 'Откликнулась', 'Написала рекрутеру', 'Скрининг с HR',
  'Собес с лидом', 'Тестовое', 'Финальный собес', 'Оффер', 'Отказ', 'Не подходит', 'Отклики закрыты'));
