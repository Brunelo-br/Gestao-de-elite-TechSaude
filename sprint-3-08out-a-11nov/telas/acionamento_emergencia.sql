-- Migração aplicada no Supabase (Techsaude01) em 10/11/2026: criar_acionamento_emergencia
-- Só acrescenta uma tabela; nenhuma tabela existente foi alterada.
create table public.acionamento_emergencia (
  id           bigint generated always as identity primary key,
  usuario_id   int not null references public.usuario(id) on delete cascade,
  contato_id   int references public.contato_emergencia(id) on delete set null,
  acionado_em  timestamptz not null default now(),
  latitude     numeric(9,6) check (latitude between -90 and 90),
  longitude    numeric(9,6) check (longitude between -180 and 180),
  canal        varchar(10) not null default 'ligacao' check (canal in ('ligacao','sms')),
  status       varchar(20) not null default 'iniciado'
               check (status in ('iniciado','ligacao_aberta','sms_aberto','sem_contato','falhou')),
  constraint acionamento_coordenadas_juntas check ((latitude is null) = (longitude is null))
);
create index acionamento_emergencia_usuario_idx on public.acionamento_emergencia (usuario_id, acionado_em desc);
alter table public.acionamento_emergencia enable row level security;
create policy dono_le on public.acionamento_emergencia for select to anon, authenticated
  using (usuario_id = (select public.app_usuario_id()));
create policy dono_registra on public.acionamento_emergencia for insert to anon, authenticated
  with check (usuario_id = (select public.app_usuario_id()));
revoke update, delete on public.acionamento_emergencia from anon, authenticated;
