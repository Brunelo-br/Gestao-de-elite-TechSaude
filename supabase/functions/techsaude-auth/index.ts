// TechSaúde — função de autenticação (Supabase Edge Function "techsaude-auth").
// Tudo o que envolve senha, criação de conta, código de recuperação e envio de foto passa por aqui,
// no servidor. O navegador nunca recebe o hash da senha nem os códigos de recuperação.
//
// Ações (POST JSON { acao, ... }):
//   login, verificar_cadastro, cadastro, alterar_senha, foto, foto_avatar, foto_remover,
//   recuperar_enviar, recuperar_validar, recuperar_trocar
// As ações de conta logada usam o cabeçalho x-sessao (o mesmo que as telas mandam ao banco).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_PUBLICA = Deno.env.get('TECHSAUDE_URL_PUBLICA') || URL_SUPABASE; // endereço público do projeto (fotos)
const db = createClient(URL_SUPABASE, CHAVE_SERVICO, { auth: { persistSession: false, autoRefreshToken: false } });

const BUCKET = 'FOTOS-PERFIL';
const PREFIXO_FOTO = `${URL_PUBLICA}/storage/v1/object/public/${BUCKET}/`;
const ITERACOES = 600000;
const DIAS_SESSAO = 90;
const PARENTESCOS = ['Filho(a)', 'Cônjuge / Companheiro(a)', 'Neto(a)', 'Irmão(ã)', 'Pai / Mãe', 'Sobrinho(a)', 'Genro / Nora', 'Amigo(a)', 'Vizinho(a)', 'Cuidador(a)', 'Outro'];
const COLUNAS_USUARIO = 'id, nome_completo, cpf, rg, telefone, email, foto_perfil_url, status_conta, criado_em, atualizado_em, data_nascimento, notificar_remedios';
const EMAILJS = { service_id: 'service_3jv1jer', template_id: 'template_3u4kb9i', user_id: 'ZGRX2l4GdBCXXNBGE' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sessao',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
class Falha extends Error { constructor(public status: number, msg: string, public extra: Record<string, unknown> = {}) { super(msg); } }
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

/* ---------------- utilidades ---------------- */
const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deB64 = (t: string) => Uint8Array.from(atob(t), c => c.charCodeAt(0));
const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const texto = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
async function sha256(t: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(t)));
  return Array.from(h, x => x.toString(16).padStart(2, '0')).join('');
}
function tokenAleatorio() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function codigoSeisDigitos() {
  const limite = 4294000000; // múltiplo de 1.000.000 abaixo de 2^32 (sem viés)
  for (;;) { const n = crypto.getRandomValues(new Uint32Array(1))[0]; if (n < limite) return String(n % 1000000).padStart(6, '0'); }
}

/* ---------------- senha (mesmo formato do password-hash.js) ---------------- */
async function derivar(senha: string, sal: Uint8Array, iter: number) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sal, iterations: iter, hash: 'SHA-256' }, chave, 256));
}
async function gerarHash(senha: string) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERACOES}$${b64(sal)}$${b64(await derivar(senha, sal, ITERACOES))}`;
}
const HASH_FALSO = 'pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
async function conferirSenha(senha: string, guardado: string) {
  if (!guardado) return false;
  if (!guardado.startsWith('pbkdf2-sha256$')) {             // senha antiga em texto puro (migrada no 1º login)
    const a = enc.encode(senha), b = enc.encode(guardado);
    let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] ?? 0) ^ (b[i] ?? 0);
    return d === 0;
  }
  const [, it, salT, espT] = guardado.split('$'); const iter = Number(it);
  if (!Number.isInteger(iter) || iter < 100000 || iter > 2000000) return false;
  try {
    const sal = deB64(salT), esperado = deB64(espT);
    if (sal.length !== 16 || esperado.length !== 32) return false;
    const atual = await derivar(senha, sal, iter);
    let d = 0; for (let i = 0; i < 32; i++) d |= atual[i] ^ esperado[i];
    return d === 0;
  } catch { return false; }
}
const precisaRefazer = (h: string) => !h.startsWith('pbkdf2-sha256$') || Number(h.split('$')[1]) < ITERACOES;
function senhaNoPadrao(s: unknown) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 128 && /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s);
}

/* ---------------- validações (as mesmas do cadastro) ---------------- */
function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const t of [9, 10]) {
    let s = 0; for (let i = 0; i < t; i++) s += Number(cpf[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(cpf[t])) return false;
  }
  return true;
}
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 150;
const telefoneValido = (t: string) => [10, 11].includes(soDigitos(t).length);
function mascaraTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11);
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}
function nascimentoValido(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return false;
  return d <= new Date() && +m[1] >= 1900 && (new Date().getUTCFullYear() - +m[1]) <= 121;
}

/* ---------------- limite de tentativas ---------------- */
async function contarRecentes(acao: string, chave: string, minutos: number) {
  const { count } = await db.from('limite_acesso').select('id', { count: 'exact', head: true })
    .eq('acao', acao).eq('chave', chave).gte('criado_em', new Date(Date.now() - minutos * 60000).toISOString());
  return count ?? 0;
}
async function limitar(acao: string, chave: string, maximo: number, minutos: number, msg: string) {
  if (await contarRecentes(acao, chave, minutos) >= maximo) throw new Falha(429, msg);
  await db.from('limite_acesso').insert({ acao, chave: chave.slice(0, 150) });
}
async function falhasLogin(campo: 'identificador_usado' | 'ip', valor: string, minutos: number) {
  const { count } = await db.from('log_autenticacao').select('id', { count: 'exact', head: true })
    .eq(campo, valor).eq('sucesso', false).gte('criado_em', new Date(Date.now() - minutos * 60000).toISOString());
  return count ?? 0;
}
const registrar = (usuario_id: number | null, ident: string, sucesso: boolean, ip: string, motivo: string) =>
  db.from('log_autenticacao').insert({ usuario_id, identificador_usado: ident.slice(0, 150), sucesso, ip, motivo });

/* ---------------- sessão ---------------- */
async function criarSessao(usuarioId: number, aparelho: string) {
  const token = tokenAleatorio();
  const { error } = await db.from('sessao').insert({
    usuario_id: usuarioId, token_hash: await sha256(token), aparelho: aparelho.slice(0, 200),
    expira_em: new Date(Date.now() + DIAS_SESSAO * 86400000).toISOString(),
  });
  if (error) throw error;
  return token;
}
async function usuarioDaSessao(req: Request) {
  const token = req.headers.get('x-sessao') || '';
  if (token.length < 20) throw new Falha(401, 'Sua sessão terminou. Entre de novo na sua conta.', { sessao: false });
  const { data } = await db.from('sessao').select('id, usuario_id, expira_em, usuario!inner(id, cpf, senha_hash, foto_perfil_url, status_conta)')
    .eq('token_hash', await sha256(token)).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const u = (data as any)?.usuario;
  if (!data || new Date(data.expira_em) < new Date() || !u || u.status_conta !== 'ativo')
    throw new Falha(401, 'Sua sessão terminou. Entre de novo na sua conta.', { sessao: false });
  return { sessaoId: data.id as number, usuario: u as { id: number; cpf: string; senha_hash: string; foto_perfil_url: string | null } };
}
async function situacaoTermos(usuarioId: number) {
  const { data: v } = await db.from('termos_versao').select('id, versao').eq('vigente', true).order('publicada_em', { ascending: false }).limit(1);
  if (!v?.length) return { pendente: false, versao_id: null, versao: null };
  const { data: a } = await db.from('aceite_termos').select('id').eq('usuario_id', usuarioId).eq('versao_id', v[0].id).limit(1);
  return { pendente: !a?.length, versao_id: v[0].id, versao: v[0].versao };
}

/* ---------------- foto ---------------- */
function lerJpeg(base64: unknown) {
  if (typeof base64 !== 'string') throw new Falha(400, 'Foto inválida.');
  const limpo = base64.replace(/^data:image\/jpeg;base64,/, '');
  if (limpo.length > 2_800_000) throw new Falha(413, 'A foto é grande demais.');
  let bytes: Uint8Array;
  try { bytes = deB64(limpo); } catch { throw new Falha(400, 'Foto inválida.'); }
  if (bytes.length < 100 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Falha(400, 'A foto precisa ser uma imagem JPEG.');
  return bytes;
}
async function salvarFoto(usuarioId: number, bytes: Uint8Array) {
  const caminho = `u${usuarioId}/${crypto.randomUUID()}.jpg`;   // nome aleatório: o endereço não revela o CPF
  const { error } = await db.storage.from(BUCKET).upload(caminho, bytes, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
  if (error) throw error;
  return PREFIXO_FOTO + caminho;
}
async function apagarFotoAntiga(url: string | null) {
  if (!url || !url.startsWith(PREFIXO_FOTO)) return;
  const caminho = decodeURIComponent(url.slice(PREFIXO_FOTO.length).split('?')[0]);
  await db.storage.from(BUCKET).remove([caminho]).catch(() => {});
}

/* ---------------- ações ---------------- */
type Corpo = Record<string, unknown>;
const ACOES: Record<string, (c: Corpo, req: Request, ip: string) => Promise<unknown>> = {

  async login(c, req, ip) {
    const ident = texto(c.identificador, 150).toLowerCase();
    const senha = typeof c.senha === 'string' ? c.senha : '';
    if (!ident || !senha) throw new Falha(400, 'Informe o CPF ou e-mail e a senha.');
    if (await falhasLogin('identificador_usado', ident, 15) >= 5 || await falhasLogin('ip', ip, 15) >= 20) {
      await registrar(null, ident, false, ip, 'bloqueado');
      throw new Falha(429, 'Muitas tentativas erradas. Por segurança, espere 15 minutos e tente de novo, ou use "Esqueci minha senha".');
    }
    const usandoEmail = ident.includes('@');
    const { data: achados, error } = usandoEmail
      ? await db.from('usuario').select(COLUNAS_USUARIO + ', senha_hash').eq('email', ident).limit(1)
      : await db.from('usuario').select(COLUNAS_USUARIO + ', senha_hash').eq('cpf', soDigitos(ident)).limit(1);
    if (error) throw error;
    const u = achados?.[0];
    const ok = await conferirSenha(senha, u?.senha_hash || HASH_FALSO);   // confere mesmo sem conta: mesmo tempo de resposta
    if (!u || !ok) {
      await registrar(u?.id ?? null, ident, false, ip, u ? 'senha_errada' : 'conta_inexistente');
      throw new Falha(401, 'Usuário ou senha incorretos. Verifique e tente novamente.');
    }
    if (u.status_conta !== 'ativo') {
      await registrar(u.id, ident, false, ip, 'conta_' + u.status_conta);
      throw new Falha(403, 'Esta conta está desativada. Fale com o suporte do TechSaúde.');
    }
    if (precisaRefazer(u.senha_hash)) await db.from('usuario').update({ senha_hash: await gerarHash(senha) }).eq('id', u.id);
    await registrar(u.id, ident, true, ip, 'ok');
    db.rpc('app_limpeza').then(() => {}, () => {});
    const token = await criarSessao(u.id, req.headers.get('user-agent') || '');
    delete (u as Corpo).senha_hash;
    return { usuario: u, sessao: token, termos: await situacaoTermos(u.id) };
  },

  async verificar_cadastro(c, _req, ip) {
    await limitar('verificar', ip, 30, 15, 'Muitas consultas seguidas. Espere alguns minutos.');
    const cpf = soDigitos(c.cpf), email = texto(c.email, 150).toLowerCase();
    if (cpf) { const { count } = await db.from('usuario').select('id', { count: 'exact', head: true }).eq('cpf', cpf); if (count) return { existe: 'cpf' }; }
    if (email) { const { count } = await db.from('usuario').select('id', { count: 'exact', head: true }).eq('email', email); if (count) return { existe: 'email' }; }
    return { existe: null };
  },

  async cadastro(c, _req, ip) {
    await limitar('cadastro', ip, 5, 60, 'Muitos cadastros seguidos deste aparelho. Tente de novo mais tarde.');
    const nome = texto(c.nome, 120), cpf = soDigitos(c.cpf), rg = texto(c.rg, 15), email = texto(c.email, 150).toLowerCase();
    const telefone = texto(c.telefone, 15), nascimento = texto(c.data_nascimento, 10), senha = c.senha;
    if (nome.length < 3) throw new Falha(400, 'Informe seu nome completo.');
    if (!cpfValido(cpf)) throw new Falha(400, 'Informe um CPF válido.');
    if (rg && !/^\d{2}\.\d{3}\.\d{3}-\d$/.test(rg)) throw new Falha(400, 'O RG precisa ter 9 números.');
    if (!nascimentoValido(nascimento)) throw new Falha(400, 'Confira a data de nascimento.');
    if (!telefoneValido(telefone)) throw new Falha(400, 'Informe um telefone com DDD (10 ou 11 números).');
    if (!emailValido(email)) throw new Falha(400, 'Informe um e-mail válido.');
    if (!senhaNoPadrao(senha)) throw new Falha(400, 'A senha precisa ter pelo menos 8 caracteres, com letras e números.');
    // deno-lint-ignore no-explicit-any
    const e = (c.endereco || {}) as any;
    const endereco = {
      cep: soDigitos(e.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2'), logradouro: texto(e.logradouro, 255), numero: texto(e.numero, 20),
      complemento: texto(e.complemento, 100) || null, bairro: texto(e.bairro, 100), cidade: texto(e.cidade, 100), estado: texto(e.estado, 2).toUpperCase(),
    };
    if (soDigitos(endereco.cep).length !== 8 || !endereco.logradouro || !endereco.numero || !endereco.bairro || !endereco.cidade || !/^[A-Z]{2}$/.test(endereco.estado))
      throw new Falha(400, 'Confira o endereço.');
    const contatos = (Array.isArray(c.contatos) ? c.contatos : []).slice(0, 3).map((x: Corpo, i: number) => ({
      nome_contato: texto(x.nome, 120), grau_parentesco: texto(x.parentesco, 40), telefone: texto(x.telefone, 15),
      email: texto(x.email, 150).toLowerCase() || null, ordem: i + 1,
    }));
    for (const ct of contatos) {
      if (ct.nome_contato.length < 2 || !PARENTESCOS.includes(ct.grau_parentesco) || !telefoneValido(ct.telefone) || (ct.email && !emailValido(ct.email)))
        throw new Falha(400, 'Confira os contatos de emergência.');
    }
    const foto = c.foto ? lerJpeg(c.foto) : null;

    const { data: novo, error } = await db.from('usuario').insert({
      nome_completo: nome, cpf, rg: rg || null, data_nascimento: nascimento, telefone: mascaraTelefone(telefone), email,
      senha_hash: await gerarHash(senha as string),
    }).select('id').single();
    if (error) {
      if (error.code === '23505') throw new Falha(409, 'E-mail ou CPF já cadastrado no sistema.');
      throw error;
    }
    const naoSalvos: string[] = [];
    if ((await db.from('endereco').insert({ usuario_id: novo.id, ...endereco })).error) naoSalvos.push('o endereço');
    if (contatos.length && (await db.from('contato_emergencia').insert(contatos.map(ct => ({ ...ct, usuario_id: novo.id })))).error)
      naoSalvos.push('os contatos de emergência');
    if (foto) {
      try { const url = await salvarFoto(novo.id, foto); await db.from('usuario').update({ foto_perfil_url: url }).eq('id', novo.id); }
      catch { naoSalvos.push('a foto'); }
    }
    return { criado: true, naoSalvos };
  },

  async alterar_senha(c, req, ip) {
    const { usuario, sessaoId } = await usuarioDaSessao(req);
    const chave = 'u' + usuario.id;
    if (await contarRecentes('senha_atual', chave, 15) >= 5)
      throw new Falha(429, 'Muitas tentativas com a senha atual errada. Espere 15 minutos.');
    if (typeof c.atual !== 'string' || !await conferirSenha(c.atual, usuario.senha_hash)) {
      await db.from('limite_acesso').insert({ acao: 'senha_atual', chave });
      await registrar(usuario.id, chave, false, ip, 'troca_senha_atual_errada');
      throw new Falha(400, 'A senha atual está incorreta.', { campo: 'atual' });
    }
    if (!senhaNoPadrao(c.nova)) throw new Falha(400, 'A nova senha precisa ter 8 ou mais caracteres, com letras e números.', { campo: 'nova' });
    if (c.nova === c.atual) throw new Falha(400, 'A nova senha precisa ser diferente da atual.', { campo: 'nova' });
    const { error } = await db.from('usuario').update({ senha_hash: await gerarHash(c.nova as string) }).eq('id', usuario.id);
    if (error) throw error;
    await db.from('sessao').delete().eq('usuario_id', usuario.id).neq('id', sessaoId);   // desconecta os outros aparelhos
    await registrar(usuario.id, chave, true, ip, 'troca_senha');
    return { alterada: true };
  },

  async foto(c, req) {
    const { usuario } = await usuarioDaSessao(req);
    await limitar('foto', 'u' + usuario.id, 20, 60, 'Muitas fotos enviadas seguidas. Tente de novo mais tarde.');
    const url = await salvarFoto(usuario.id, lerJpeg(c.imagem));
    const { error } = await db.from('usuario').update({ foto_perfil_url: url }).eq('id', usuario.id);
    if (error) throw error;
    await apagarFotoAntiga(usuario.foto_perfil_url);
    return { foto_perfil_url: url };
  },

  async foto_avatar(c, req) {
    const { usuario } = await usuarioDaSessao(req);
    const avatar = String(c.avatar || '');
    if (!/^img\/avatares\/avatar-[0-9]{2}\.svg$/.test(avatar)) throw new Falha(400, 'Avatar inválido.');
    const { error } = await db.from('usuario').update({ foto_perfil_url: avatar }).eq('id', usuario.id);
    if (error) throw error;
    await apagarFotoAntiga(usuario.foto_perfil_url);
    return { foto_perfil_url: avatar };
  },

  async foto_remover(_c, req) {
    const { usuario } = await usuarioDaSessao(req);
    const { error } = await db.from('usuario').update({ foto_perfil_url: null }).eq('id', usuario.id);
    if (error) throw error;
    await apagarFotoAntiga(usuario.foto_perfil_url);
    return { foto_perfil_url: null };
  },

  async recuperar_enviar(c, _req, ip) {
    const email = texto(c.email, 150).toLowerCase();
    if (!emailValido(email)) throw new Falha(400, 'Informe um e-mail válido.');
    await limitar('recuperar_ip', ip, 10, 15, 'Muitos pedidos seguidos. Espere 15 minutos.');
    await limitar('recuperar_email', email, 3, 15, 'Já enviamos alguns códigos para este e-mail. Confira sua caixa de entrada (e o spam) ou espere 15 minutos.');
    const { data: u } = await db.from('usuario').select('id, email, status_conta').eq('email', email).maybeSingle();
    if (u && u.status_conta === 'ativo') {
      const codigo = codigoSeisDigitos();
      await db.from('recuperacao_senha').update({ utilizado: true }).eq('usuario_id', u.id).eq('utilizado', false);
      const { error } = await db.from('recuperacao_senha').insert({
        usuario_id: u.id, codigo_verificacao: await sha256(u.id + ':' + codigo),
        expira_em: new Date(Date.now() + 15 * 60000).toISOString(),
      });
      if (error) throw error;
      const r = await fetch(Deno.env.get('EMAILJS_URL') || 'https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...EMAILJS, accessToken: Deno.env.get('EMAILJS_PRIVATE_KEY') || undefined,
          template_params: { to_email: u.email, codigo_recuperacao: codigo } }),
      });
      if (!r.ok) {
        console.error('EmailJS recusou o envio:', r.status, await r.text());
        throw new Falha(502, 'Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos.');
      }
    }
    // Mesma resposta com ou sem conta: não revela quais e-mails estão cadastrados.
    return { enviado: true };
  },

  async recuperar_validar(c) { await conferirCodigo(c); return { valido: true }; },

  async recuperar_trocar(c, _req, ip) {
    if (!senhaNoPadrao(c.nova)) throw new Falha(400, 'A senha precisa ter pelo menos 8 caracteres, com letras e números.');
    const { usuarioId, recId } = await conferirCodigo(c);
    const { error } = await db.from('usuario').update({ senha_hash: await gerarHash(c.nova as string) }).eq('id', usuarioId);
    if (error) throw error;
    await db.from('recuperacao_senha').update({ utilizado: true }).eq('id', recId);
    await db.from('sessao').delete().eq('usuario_id', usuarioId);   // sai de todos os aparelhos
    await registrar(usuarioId, texto(c.email, 150).toLowerCase(), true, ip, 'recuperacao_senha');
    return { alterada: true };
  },
};

async function conferirCodigo(c: Corpo) {
  const email = texto(c.email, 150).toLowerCase(), codigo = soDigitos(c.codigo);
  const invalido = new Falha(400, 'Código inválido, expirado ou já utilizado.');
  if (!emailValido(email) || codigo.length !== 6) throw invalido;
  const { data: u } = await db.from('usuario').select('id').eq('email', email).maybeSingle();
  if (!u) throw invalido;
  const { data: rec } = await db.from('recuperacao_senha').select('id, codigo_verificacao, tentativas')
    .eq('usuario_id', u.id).eq('utilizado', false).gt('expira_em', new Date().toISOString())
    .order('criado_em', { ascending: false }).limit(1).maybeSingle();
  if (!rec || rec.tentativas >= 5) throw invalido;
  if (rec.codigo_verificacao !== await sha256(u.id + ':' + codigo)) {
    const tent = rec.tentativas + 1;
    await db.from('recuperacao_senha').update({ tentativas: tent, utilizado: tent >= 5 }).eq('id', rec.id);
    throw tent >= 5 ? new Falha(400, 'Código errado muitas vezes. Peça um novo código.') : invalido;
  }
  return { usuarioId: u.id as number, recId: rec.id as number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ ok: false, erro: 'Método não permitido.' }, 405);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'desconhecido';
  let corpo: Corpo;
  try { corpo = await req.json(); } catch { return resposta({ ok: false, erro: 'Pedido inválido.' }, 400); }
  const acao = ACOES[String(corpo?.acao)];
  if (!acao) return resposta({ ok: false, erro: 'Ação desconhecida.' }, 400);
  try {
    return resposta({ ok: true, ...(await acao(corpo, req, ip) as object) });
  } catch (e) {
    if (e instanceof Falha) return resposta({ ok: false, erro: e.message, ...e.extra }, e.status);
    console.error('Erro em ' + corpo.acao + ':', e);
    return resposta({ ok: false, erro: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
});
