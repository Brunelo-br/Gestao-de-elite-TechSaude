-- SEGURANÇA 1/2 — estruturas novas (não quebra o app antigo)
-- Sessões com token, limite de tentativas, log mais completo e funções que o app chama.

-- 1) Sessões: o navegador guarda só o token; o banco guarda o resumo (SHA-256) dele.
create table if not exists public.sessao (
  id bigint generated always as identity primary key,
  usuario_id int not null references public.usuario(id) on delete cascade,
  token_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '90 days',
  aparelho varchar(200)
);
create index if not exists sessao_usuario_idx on public.sessao(usuario_id);
alter table public.sessao enable row level security;   -- sem política: ninguém lê pelo app
comment on table public.sessao is 'Sessões de login. O app envia o token no cabeçalho x-sessao; aqui fica só o SHA-256 dele.';

-- 2) Limite de tentativas (cadastro, recuperação de senha, verificação de CPF/e-mail).
create table if not exists public.limite_acesso (
  id bigint generated always as identity primary key,
  acao varchar(30) not null,
  chave varchar(150) not null,
  criado_em timestamptz not null default now()
);
create index if not exists limite_acesso_busca_idx on public.limite_acesso(acao, chave, criado_em);
alter table public.limite_acesso enable row level security;

-- 3) Log de autenticação: IP e motivo (senha errada, bloqueado, conta inexistente...).
alter table public.log_autenticacao add column if not exists ip varchar(64);
alter table public.log_autenticacao add column if not exists motivo varchar(40);
create index if not exists log_autenticacao_ident_idx on public.log_autenticacao(identificador_usado, criado_em);
create index if not exists log_autenticacao_ip_idx on public.log_autenticacao(ip, criado_em);

-- 4) Recuperação de senha: guarda só o resumo do código e conta as tentativas.
alter table public.recuperacao_senha alter column codigo_verificacao type varchar(64);
alter table public.recuperacao_senha add column if not exists tentativas smallint not null default 0;
update public.recuperacao_senha set utilizado = true, codigo_verificacao = 'invalido' where utilizado = false; -- códigos antigos em texto puro
comment on column public.recuperacao_senha.codigo_verificacao is 'SHA-256 do código enviado por e-mail (nunca o código em si).';

-- 5) Foto do perfil: só avatar do app ou arquivo do bucket do app.
alter table public.usuario drop constraint if exists usuario_foto_perfil_url_check;
alter table public.usuario add constraint usuario_foto_perfil_url_check check (
  foto_perfil_url is null
  or foto_perfil_url ~ '^img/avatares/avatar-[0-9]{2}\.svg$'
  or foto_perfil_url like 'https://mbqcazpulgywultkrbvq.supabase.co/storage/v1/object/public/FOTOS-PERFIL/%'
) not valid;
alter table public.usuario validate constraint usuario_foto_perfil_url_check;

-- 6) Quem é o dono da sessão desta requisição (lê o cabeçalho x-sessao enviado pelo app).
create or replace function public.app_usuario_id() returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select s.usuario_id
    from public.sessao s join public.usuario u on u.id = s.usuario_id
   where s.token_hash = encode(extensions.digest(
           coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-sessao', ''), 'sha256'), 'hex')
     and s.expira_em > now()
     and u.status_conta = 'ativo'
   limit 1
$$;
comment on function public.app_usuario_id() is 'Id do usuário dono do token enviado no cabeçalho x-sessao (null se não houver sessão válida). Usado nas políticas RLS.';

-- 7) Funções que as telas chamam.
create or replace function public.app_sessao_valida() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.app_usuario_id() is not null
$$;
create or replace function public.app_sair() returns void
language sql volatile security definer set search_path = public, pg_temp as $$
  delete from public.sessao
   where token_hash = encode(extensions.digest(
           coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-sessao', ''), 'sha256'), 'hex')
$$;
revoke all on function public.app_usuario_id(), public.app_sessao_valida(), public.app_sair() from public;
grant execute on function public.app_usuario_id(), public.app_sessao_valida(), public.app_sair() to anon, authenticated, service_role;

-- 8) Limpeza automática de sessões vencidas e tentativas antigas (chamada pelo login).
create or replace function public.app_limpeza() returns void
language sql volatile security definer set search_path = public, pg_temp as $$
  delete from public.sessao where expira_em < now();
  delete from public.limite_acesso where criado_em < now() - interval '1 day';
  delete from public.recuperacao_senha where expira_em < now() - interval '7 days';
$$;
revoke all on function public.app_limpeza() from public, anon, authenticated;
grant execute on function public.app_limpeza() to service_role;

-- 9) Avisos do Supabase: search_path fixo e índice que faltava.
alter function public.set_atualizado_em() set search_path = public, pg_temp;
create index if not exists aceite_termos_versao_idx on public.aceite_termos(versao_id);

revoke all on public.sessao, public.limite_acesso from anon, authenticated;
