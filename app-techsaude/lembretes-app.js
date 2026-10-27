/* =====================================================================
   TechSaúde — LEMBRETES DE CONSULTA (vale para todas as telas do app)
   ---------------------------------------------------------------------
   - A cada 30 s confere as consultas do usuário logado e mostra o aviso
     quando chega a hora de cada lembrete (1 dia, 2 h, 1 h ou 30 min antes).
   - O aviso aparece como pop-up dentro do app, com som, e também como
     notificação do celular/computador (se a pessoa permitir).
   - Funciona em qualquer tela aberta do app. Com o app totalmente fechado,
     o navegador não executa nada (isso exigiria um servidor de push).
   - Lê as consultas direto do Supabase (REST) e guarda uma cópia local.
   ===================================================================== */
(function(){
  'use strict';

  var SUPABASE_URL = 'https://mbqcazpulgywultkrbvq.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_gPi7EG8MoRlUbvIjNmG0zA_wRkEfzuq';
  var CHAVE_CACHE = 'techsaude_consultas_v2';          // mesma chave da tela de Consultas e do Calendário
  var CHAVE_MOSTRADOS = 'techsaude_lembretes_mostrados';
  var INTERVALO_VERIFICACAO = 30 * 1000;
  var INTERVALO_BANCO = 5 * 60 * 1000;

  var OPCOES = [
    { valor: '1d',  texto: '1 dia antes',       ms: 24 * 60 * 60 * 1000 },
    { valor: '2h',  texto: '2 horas antes',     ms: 2 * 60 * 60 * 1000 },
    { valor: '1h',  texto: '1 hora antes',      ms: 60 * 60 * 1000 },
    { valor: '30m', texto: '30 minutos antes',  ms: 30 * 60 * 1000 }
  ];
  var PADRAO = ['1d', '2h'];

  // ---------- utilidades de lembrete (usadas também pela tela de Consultas) ----------
  // O banco guarda os lembretes como texto separado por vírgula: "1d,2h".
  function lerLembretes(valor){
    if(!valor) return [];
    if(Array.isArray(valor)) valor = valor.join(',');
    var validos = OPCOES.map(function(o){ return o.valor; });
    return String(valor).split(',').map(function(v){ return v.trim(); })
      .filter(function(v, i, arr){ return validos.indexOf(v) !== -1 && arr.indexOf(v) === i; })
      .sort(function(a, b){ return validos.indexOf(a) - validos.indexOf(b); });
  }
  function gravarLembretes(lista){
    var l = lerLembretes(lista);
    return l.length ? l.join(',') : null;
  }
  function textoLembretes(valor){
    var l = lerLembretes(valor);
    if(!l.length) return '';
    return l.map(function(v){ return OPCOES.filter(function(o){ return o.valor === v; })[0].texto.replace(' antes', ''); })
      .join(', ').replace(/, ([^,]*)$/, ' e $1') + ' antes';
  }

  // ---------- sessão ----------
  function usuarioId(){
    try{
      var u = JSON.parse(localStorage.getItem('usuario_logado') || localStorage.getItem('usuarioLogado') || 'null');
      if(Array.isArray(u)) u = u[0];
      var n = Number(u && (u.id != null ? u.id : u.id_usuario));
      return Number.isFinite(n) && n > 0 ? n : null;
    }catch(e){ return null; }
  }

  // ---------- dados ----------
  function lerCache(){
    try{ var d = JSON.parse(localStorage.getItem(CHAVE_CACHE) || '[]'); return Array.isArray(d) ? d : []; }catch(e){ return []; }
  }
  function normalizar(c){
    return {
      id: Number(c.id != null ? c.id : c.id_consulta),
      medico: c.medico || '',
      especialidade: c.especialidade || '',
      data: c.data_consulta || c.data || '',
      hora: (c.hora_consulta || c.hora || '').slice(0, 5),
      local: c.local_atendimento || c.local || '',
      lembrete: c.lembrete || null,
      confirmado: Boolean(c.confirmado)
    };
  }
  function quando(c){
    if(!c.data) return null;
    var d = new Date(String(c.data).slice(0, 10) + 'T' + (c.hora || '08:00') + ':00');
    return isNaN(d) ? null : d;
  }

  function rest(caminho, opcoes){
    opcoes = opcoes || {};
    var headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
    return fetch(SUPABASE_URL + '/rest/v1/' + caminho, { method: opcoes.method || 'GET', headers: headers, body: opcoes.body ? JSON.stringify(opcoes.body) : undefined })
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.status === 204 ? null : r.json(); });
  }

  var ultimaBusca = 0;
  function atualizarDoBanco(){
    var uid = usuarioId();
    if(!uid || !window.fetch) return Promise.resolve();
    ultimaBusca = Date.now();
    return rest('consulta?select=*&usuario_id=eq.' + uid).then(function(dados){
      if(Array.isArray(dados)){
        try{ localStorage.setItem(CHAVE_CACHE, JSON.stringify(dados)); }catch(e){}
      }
    }).catch(function(){ /* sem internet: usa a cópia local */ });
  }

  // ---------- controle do que já foi mostrado ----------
  function lerMostrados(){
    try{ var m = JSON.parse(localStorage.getItem(CHAVE_MOSTRADOS) || '{}'); return m && typeof m === 'object' ? m : {}; }catch(e){ return {}; }
  }
  function marcarMostrado(chave){
    var m = lerMostrados(); m[chave] = Date.now();
    // limpa registros com mais de 60 dias
    var limite = Date.now() - 60 * 24 * 60 * 60 * 1000;
    Object.keys(m).forEach(function(k){ if(m[k] < limite) delete m[k]; });
    try{ localStorage.setItem(CHAVE_MOSTRADOS, JSON.stringify(m)); }catch(e){}
  }
  function chaveLembrete(c, valor){ return c.id + '|' + c.data + 'T' + c.hora + '|' + valor; }

  // ---------- texto "falta quanto" ----------
  function faltaTexto(alvo){
    var min = Math.round((alvo - new Date()) / 60000);
    if(min <= 1) return 'agora';
    if(min < 60) return 'em ' + min + ' minutos';
    if(min < 24 * 60){
      var h = Math.floor(min / 60), m = min % 60;
      if(m < 5) return 'em ' + h + (h === 1 ? ' hora' : ' horas');
      return 'em ' + h + 'h' + String(m).padStart(2, '0');
    }
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dia = new Date(alvo); dia.setHours(0, 0, 0, 0);
    var dias = Math.round((dia - hoje) / 86400000);
    return dias === 1 ? 'amanhã' : 'em ' + dias + ' dias';
  }
  function horaBR(d){ return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function dataBR(d){
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var dia = new Date(d); dia.setHours(0, 0, 0, 0);
    var dif = Math.round((dia - hoje) / 86400000);
    if(dif === 0) return 'Hoje';
    if(dif === 1) return 'Amanhã';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // ---------- verificação ----------
  var fila = [];
  var aberto = null;

  function verificar(){
    var uid = usuarioId();
    if(!uid) return;
    if(Date.now() - ultimaBusca > INTERVALO_BANCO){ atualizarDoBanco().then(verificar); return; }
    var agora = new Date();
    var mostrados = lerMostrados();
    lerCache().map(normalizar).forEach(function(c){
      var alvo = quando(c);
      if(!alvo || alvo <= agora) return;
      var vencidos = lerLembretes(c.lembrete).filter(function(v){
        var op = OPCOES.filter(function(o){ return o.valor === v; })[0];
        return agora >= new Date(alvo - op.ms) && !mostrados[chaveLembrete(c, v)];
      });
      if(!vencidos.length) return;
      // Vários lembretes vencidos de uma vez (app ficou fechado): mostra um só aviso.
      vencidos.forEach(function(v){ marcarMostrado(chaveLembrete(c, v)); });
      if(!fila.some(function(f){ return f.id === c.id; }) && !(aberto && aberto.id === c.id)) fila.push(c);
    });
    proximo();
  }

  // ---------- pop-up ----------
  var CSS = '' +
    '.tsl-overlay{position:fixed;inset:0;background:rgba(10,20,14,.6);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Trebuchet MS","Segoe UI",Verdana,sans-serif;}' +
    '.tsl-card{background:#f3efdc;border:2px solid #cdbf95;border-radius:24px;max-width:420px;width:100%;padding:26px 22px 22px;text-align:center;color:#26332a;box-shadow:0 30px 60px rgba(0,0,0,.4);max-height:92vh;overflow-y:auto;}' +
    '.tsl-icone{width:64px;height:64px;border-radius:50%;background:#1b3a26;color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;}' +
    '.tsl-icone svg{width:32px;height:32px;}' +
    '.tsl-card .tsl-tag{margin:0 0 4px;font-size:.8rem;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#2f6b46;}' +
    '.tsl-card *{text-transform:none;letter-spacing:normal;}' +
    '.tsl-titulo{margin:0 0 12px;font-size:1.35rem;line-height:1.25;font-weight:900;color:#1b3a26;}' +
    '.tsl-quando{margin:0 0 4px;font-size:1.6rem;font-weight:900;color:#1b3a26;}' +
    '.tsl-info{margin:0 0 4px;font-size:1rem;font-weight:600;line-height:1.4;}' +
    '.tsl-local{margin:0 0 18px;font-size:.95rem;color:#55604f;font-weight:600;}' +
    '.tsl-acoes{display:flex;flex-direction:column;gap:10px;}' +
    '.tsl-card .tsl-btn{text-transform:uppercase;letter-spacing:.3px;}' +
    '.tsl-btn{min-height:52px;border-radius:999px;font:inherit;font-size:1rem;font-weight:800;text-transform:uppercase;letter-spacing:.3px;cursor:pointer;border:2px solid #1b3a26;}' +
    '.tsl-btn.prim{background:linear-gradient(180deg,#234a34,#1b3a26);color:#f3efdc;}' +
    '.tsl-btn.sec{background:#fff;color:#1b3a26;}' +
    '.tsl-btn.ter{background:transparent;border-color:transparent;color:#1b3a26;text-decoration:underline;min-height:44px;}' +
    '.tsl-btn:focus-visible{outline:3px solid #2f9e8f;outline-offset:2px;}';
  var ICONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M5 3h2M13 3h2"/><path d="M10 13v2a4.5 4.5 0 0 0 9 0v-2"/><circle cx="19" cy="11" r="2"/></svg>';

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }

  function proximo(){
    if(aberto || !fila.length) return;
    aberto = fila.shift();
    mostrarPopup(aberto);
  }

  function mostrarPopup(c){
    if(!document.getElementById('tsl-css')){
      var st = document.createElement('style'); st.id = 'tsl-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    var alvo = quando(c);
    var falta = faltaTexto(alvo);
    var quem = (c.medico || 'Consulta') + (c.especialidade ? ' — ' + c.especialidade : '');
    var ov = document.createElement('div');
    ov.className = 'tsl-overlay';
    ov.setAttribute('role', 'alertdialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'tsl-titulo');
    ov.innerHTML =
      '<div class="tsl-card">' +
        '<div class="tsl-icone">' + ICONE + '</div>' +
        '<p class="tsl-tag">🔔 Lembrete de consulta</p>' +
        '<h2 class="tsl-titulo" id="tsl-titulo">Sua consulta é ' + esc(falta) + '</h2>' +
        '<p class="tsl-quando">' + dataBR(alvo) + ' às ' + horaBR(alvo) + '</p>' +
        '<p class="tsl-info">' + esc(quem) + '</p>' +
        (c.local ? '<p class="tsl-local">📍 ' + esc(c.local) + '</p>' : '<p class="tsl-local"></p>') +
        '<div class="tsl-acoes">' +
          (c.confirmado ? '' : '<button type="button" class="tsl-btn prim" data-acao="confirmar">✅ Confirmar presença</button>') +
          '<button type="button" class="tsl-btn sec" data-acao="remarcar">📅 Preciso remarcar</button>' +
          '<button type="button" class="tsl-btn ter" data-acao="fechar">Fechar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var primeiro = ov.querySelector('.tsl-btn'); if(primeiro) primeiro.focus();
    ov.addEventListener('click', function(e){
      var b = e.target.closest('[data-acao]'); if(!b) return;
      var acao = b.dataset.acao;
      if(acao === 'confirmar') confirmarPresenca(c);
      fecharPopup(ov);
      if(acao === 'remarcar') window.location.href = 'lembretedeconsultas.html?editar=' + encodeURIComponent(c.id);
    });
    tocarSom();
    notificar('Consulta ' + falta + ' — ' + horaBR(alvo), quem + (c.local ? '\n' + c.local : ''), 'consulta-' + c.id);
    window.dispatchEvent(new CustomEvent('techsaude:lembrete-consulta', { detail: c }));
  }

  function fecharPopup(ov){
    if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
    aberto = null;
    proximo();
  }

  function confirmarPresenca(c){
    var uid = usuarioId();
    var cache = lerCache();
    cache.forEach(function(x){ if(Number(x.id) === Number(c.id)) x.confirmado = true; });
    try{ localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache)); }catch(e){}
    if(uid) rest('consulta?id=eq.' + c.id + '&usuario_id=eq.' + uid, { method: 'PATCH', body: { confirmado: true } }).catch(function(){});
    window.dispatchEvent(new CustomEvent('techsaude:consultas-mudaram'));
  }

  // ---------- som ----------
  var audio = null;
  function destravarAudio(){
    try{
      if(!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if(audio.state === 'suspended') audio.resume();
    }catch(e){ audio = null; }
  }
  ['click', 'touchstart', 'keydown'].forEach(function(ev){ document.addEventListener(ev, destravarAudio, { passive: true }); });
  function tocarSom(){
    if(!audio) return;
    var t = audio.currentTime;
    [0, .3, .6].forEach(function(o){
      var osc = audio.createOscillator(), g = audio.createGain();
      osc.frequency.value = 740; g.gain.setValueAtTime(.0001, t + o);
      g.gain.exponentialRampToValueAtTime(.3, t + o + .02); g.gain.exponentialRampToValueAtTime(.0001, t + o + .25);
      osc.connect(g).connect(audio.destination); osc.start(t + o); osc.stop(t + o + .27);
    });
  }

  // ---------- notificação do sistema ----------
  // No Android, o Chrome só mostra notificação por meio de um "service worker" (sw.js).
  // Só funciona com o app publicado em https (não abrindo o arquivo direto do computador).
  var swRegistro = null;
  function podeNotificar(){ return 'Notification' in window && window.isSecureContext; }
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.isSecureContext){
    navigator.serviceWorker.register('sw.js').then(function(r){ swRegistro = r; }).catch(function(){});
  }
  function notificar(titulo, corpo, tag){
    if(!podeNotificar() || Notification.permission !== 'granted') return;
    var op = { body: corpo, tag: tag, icon: 'img/logo.png', badge: 'img/logo.png', renotify: true, requireInteraction: true };
    try{
      if(swRegistro && swRegistro.showNotification){ swRegistro.showNotification(titulo, op); return; }
      new Notification(titulo, op);
    }catch(e){
      if(navigator.serviceWorker && navigator.serviceWorker.ready){
        navigator.serviceWorker.ready.then(function(r){ r.showNotification(titulo, op); }).catch(function(){});
      }
    }
  }
  function estadoNotificacao(){
    if(!('Notification' in window)) return 'indisponivel';
    if(!window.isSecureContext) return 'precisa-https';
    return Notification.permission;     // 'default' | 'granted' | 'denied'
  }
  function pedirPermissao(){
    if(!podeNotificar()) return Promise.resolve(estadoNotificacao());
    return Promise.resolve(Notification.requestPermission()).then(function(p){
      if(p === 'granted') notificar('Avisos ativados ✅', 'O TechSaúde vai avisar sobre consultas e remédios.', 'teste');
      return p;
    });
  }

  // A pessoa acabou de salvar/alterar a consulta: lembretes que já venceram
  // não precisam aparecer agora (ela está vendo a consulta neste momento).
  function marcarVencidos(consulta){
    var c = normalizar(consulta), alvo = quando(c), agora = new Date();
    if(!alvo) return;
    lerLembretes(c.lembrete).forEach(function(v){
      var op = OPCOES.filter(function(o){ return o.valor === v; })[0];
      if(agora >= new Date(alvo - op.ms)) marcarMostrado(chaveLembrete(c, v));
    });
  }

  // ---------- exporta ----------
  window.TechSaudeLembretes = {
    OPCOES: OPCOES,
    PADRAO: PADRAO,
    ler: lerLembretes,
    gravar: gravarLembretes,
    texto: textoLembretes,
    verificar: verificar,
    marcarVencidos: marcarVencidos,
    atualizarDoBanco: atualizarDoBanco,
    notificar: notificar,
    estadoNotificacao: estadoNotificacao,
    pedirPermissao: pedirPermissao
  };

  function iniciar(){
    if(!usuarioId()) return;
    verificar();
    setInterval(verificar, INTERVALO_VERIFICACAO);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) verificar(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
