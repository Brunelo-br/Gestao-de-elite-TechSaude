-- SEGURANÇA 2/2 — cada conta só enxerga e altera os próprios dados.
-- Antes: política "app_acesso" com true em todas as tabelas (qualquer pessoa com a chave pública lia e alterava tudo).

-- 1) Tira privilégios perigosos e que o app não usa.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- 2) Tabelas com usuario_id: só o dono da sessão.
do $$ declare t text; begin
  foreach t in array array['endereco','contato_emergencia','consulta','medicamentos','evento_calendario'] loop
    execute format('drop policy if exists app_acesso on public.%I', t);
    execute format('drop policy if exists dono on public.%I', t);
    execute format($p$create policy dono on public.%I for all to anon, authenticated
                     using (usuario_id = (select public.app_usuario_id()))
                     with check (usuario_id = (select public.app_usuario_id()))$p$, t);
  end loop;
end $$;

-- 3) usuario: lê e altera só a própria linha, e só as colunas permitidas.
--    Senha, CPF, foto, status e criação de conta ficam com o servidor (função techsaude-auth).
drop policy if exists app_acesso on public.usuario;
drop policy if exists dono_le on public.usuario;
drop policy if exists dono_altera on public.usuario;
create policy dono_le on public.usuario for select to anon, authenticated using (id = (select public.app_usuario_id()));
create policy dono_altera on public.usuario for update to anon, authenticated
  using (id = (select public.app_usuario_id())) with check (id = (select public.app_usuario_id()));
revoke all on public.usuario from anon, authenticated;
grant select (id, nome_completo, cpf, rg, telefone, email, foto_perfil_url, status_conta, criado_em, atualizado_em, data_nascimento, notificar_remedios)
  on public.usuario to anon, authenticated;
grant update (nome_completo, rg, telefone, email, data_nascimento, notificar_remedios) on public.usuario to anon, authenticated;

-- 4) Termos: versões só leitura; aceite só da própria conta.
drop policy if exists aceite_termos_leitura on public.aceite_termos;
drop policy if exists aceite_termos_insercao on public.aceite_termos;
create policy dono_le on public.aceite_termos for select to anon, authenticated using (usuario_id = (select public.app_usuario_id()));
create policy dono_aceita on public.aceite_termos for insert to anon, authenticated with check (usuario_id = (select public.app_usuario_id()));
revoke update, delete on public.aceite_termos from anon, authenticated;
revoke insert, update, delete on public.termos_versao from anon, authenticated;
drop policy if exists termos_versao_leitura on public.termos_versao;
create policy termos_versao_leitura on public.termos_versao for select to anon, authenticated using (true);

-- 5) Tabelas internas: só o servidor (service_role) mexe.
drop policy if exists app_acesso on public.log_autenticacao;
drop policy if exists app_acesso on public.recuperacao_senha;
revoke all on public.log_autenticacao, public.recuperacao_senha, public.sessao, public.limite_acesso from anon, authenticated;

-- 6) Tabelas criadas no futuro não ficam abertas para o app sem querer.
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
