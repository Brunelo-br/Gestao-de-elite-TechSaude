/* =====================================================================
   TechSaúde — Assistente de Voz
   Como usar: <script src="assistente-voz.js"></script> antes do </body>
   Usa a Web Speech API (funciona no Chrome/Edge/Safari; Firefox não suporta
   reconhecimento de voz). Requer HTTPS ou localhost para usar o microfone.
   ===================================================================== */
(function () {
  'use strict';

  var NOME_ASSISTENTE = 'Téc';

  // ---------- Utilidades ----------
  function norm(t) {
    return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function tem(txt, lista) {
    return lista.some(function (p) { return txt.indexOf(p) !== -1; });
  }
  function primeiroNome() {
    try {
      var u = JSON.parse(localStorage.getItem('usuario_logado') || localStorage.getItem('usuarioLogado'));
      return u && u.nome_completo ? u.nome_completo.split(' ')[0] : '';
    } catch (e) { return ''; }
  }

  // ---------- Fala (TTS) ----------
  var vozPT = null;
  function carregarVoz() {
    if (!window.speechSynthesis) return;
    var vozes = speechSynthesis.getVoices();
    vozPT = vozes.find(function (v) { return v.lang === 'pt-BR'; }) ||
            vozes.find(function (v) { return v.lang.indexOf('pt') === 0; }) || null;
  }
  if (window.speechSynthesis) { carregarVoz(); speechSynthesis.onvoiceschanged = carregarVoz; }

  function falar(texto, aoTerminar) {
    mostrarResposta(texto);
    if (!window.speechSynthesis) { if (aoTerminar) aoTerminar(); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR'; u.rate = 0.95;
    if (vozPT) u.voice = vozPT;
    u.onend = function () { if (aoTerminar) aoTerminar(); };
    u.onerror = u.onend;
    speechSynthesis.speak(u);
  }


  // ---------- Supabase (mesmo projeto das páginas) ----------
  var SUPABASE_URL = 'https://mbqcazpulgywultkrbvq.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_gPi7EG8MoRlUbvIjNmG0zA_wRkEfzuq';
  var sb = null;

  function getSB() {
    return new Promise(function (resolve) {
      if (sb) return resolve(sb);
      function criar() {
        try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { sb = null; }
        resolve(sb);
      }
      if (window.supabase) return criar();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = criar; s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  function usuarioObj() {
    try {
      var p = JSON.parse(localStorage.getItem('usuario_logado') || localStorage.getItem('usuarioLogado'));
      return Array.isArray(p) ? p[0] : p;
    } catch (e) { return null; }
  }
  // medicamentos.html usa o id como TEXTO; lembretedeconsultas.html como NÚMERO
  function idMedicamentos() {
    var u = usuarioObj() || {};
    return String(u.id_usuario || u.id || u.cpf || 'offline');
  }
  function idNumerico() {
    var u = usuarioObj() || {};
    var n = Number(u.id_usuario != null ? u.id_usuario : (u.id != null ? u.id : u.usuario_id));
    return isFinite(n) && n > 0 ? n : 1;
  }

  // ---------- Datas e números falados ----------
  function dataFalada(d) {
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function horaFalada(d) {
    var h = d.getHours(), m = d.getMinutes();
    return h + ' horas' + (m ? ' e ' + m + ' minutos' : '');
  }
  function relativo(d) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var alvo = new Date(d); alvo.setHours(0, 0, 0, 0);
    var dias = Math.round((alvo - hoje) / 86400000);
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanhã';
    return dataFalada(d);
  }
  function inputLocal(d) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  var NUMS = { 'meio dia': '12', 'um': '1', 'uma': '1', 'dois': '2', 'duas': '2', 'tres': '3', 'quatro': '4', 'cinco': '5',
    'seis': '6', 'sete': '7', 'oito': '8', 'nove': '9', 'dez': '10', 'onze': '11', 'doze': '12', 'treze': '13',
    'catorze': '14', 'quatorze': '14', 'quinze': '15', 'dezesseis': '16', 'dezessete': '17', 'dezoito': '18',
    'dezenove': '19', 'vinte': '20' };
  function numerosEmDigitos(t) {
    t = t.replace(/vinte e (um|uma|dois|duas|tres|quatro)/g, function (_, w) { return String(20 + parseInt(NUMS[w], 10)); });
    t = t.replace(/(\d+) e meia/g, '$1 30');
    Object.keys(NUMS).forEach(function (w) { t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), NUMS[w]); });
    return t;
  }
  function parseNumero(t) {
    var m = numerosEmDigitos(t).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function tipoDuracao(t) {
    if (/\bdias?\b/.test(t)) return 'dias';
    if (/\bdoses?\b/.test(t)) return 'doses';
    if (tem(t, ['continuo', 'sem data para terminar'])) return 'continuo';
    return null;
  }
  function parseHora(t) {
    if (tem(t, ['agora', 'ja'])) return new Date();
    var x = numerosEmDigitos(t);
    var m = x.match(/(\d{1,2})(?:\D+?(\d{2}))?/);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0;
    if (tem(x, ['tarde', 'noite']) && h < 12) h += 12;
    if (h > 23 || min > 59) return null;
    var d = new Date(); d.setHours(h, min, 0, 0);
    if (d.getTime() < Date.now() - 60000) d.setDate(d.getDate() + 1);
    return d;
  }
  function capitalizar(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // ---------- Diálogo em etapas ----------
  var aguardando = null; // function(textoNormalizado, textoOriginal) -> string (erro) | undefined
  function perguntar(pergunta, handler) {
    falar(pergunta, function () {
      aguardando = function (t, orig) {
        var erro = handler(t, orig);
        if (typeof erro === 'string') perguntar(erro, handler);
      };
      ouvir();
    });
  }
  function confirmar(pergunta, aoConfirmar) {
    perguntar(pergunta, function (t) {
      if (tem(t, ['sim', 'confirmo', 'pode', 'quero', 'isso'])) aoConfirmar();
      else if (tem(t, ['nao', 'cancela'])) falar('Tudo bem, cancelei.');
      else return 'Não entendi. Diga sim ou não.';
    });
  }

  // ---------- Medicamentos ----------
  function proximaOcorrencia(a) {
    if (!a.ativo) return null;
    var agora = new Date(), ini = new Date(a.primeiraDose), ms = a.intervaloHoras * 3600000;
    if (a.duracaoTipo === 'continuo') {
      if (agora <= ini) return ini;
      return new Date(ini.getTime() + Math.ceil((agora - ini) / ms) * ms);
    }
    var n = a.duracaoTipo === 'doses' ? a.duracaoValor : Math.floor(a.duracaoValor * 86400000 / ms) + 1;
    for (var i = 0; i < n; i++) {
      var d = new Date(ini.getTime() + i * ms);
      if (d >= agora) return d;
    }
    return null;
  }
  function lerAlarmesLocais() {
    var u = usuarioObj() || {};
    try { return JSON.parse(localStorage.getItem('medicamentos_' + (u.id || u.cpf || 'offline')) || '[]'); } catch (e) { return []; }
  }
  async function carregarAlarmes() {
    var c = await getSB();
    if (c) {
      var r = await c.from('medicamentos').select('*').eq('usuario_id', idMedicamentos());
      if (!r.error && r.data && r.data.length) {
        return r.data.map(function (d) {
          return {
            medicamentos: typeof d.medicamentos === 'string' ? JSON.parse(d.medicamentos) : d.medicamentos,
            primeiraDose: d.primeira_dose, intervaloHoras: d.intervalo_horas,
            duracaoTipo: d.duracao_tipo, duracaoValor: d.duracao_valor, ativo: d.ativo
          };
        });
      }
    }
    return lerAlarmesLocais();
  }
  async function proximoMedicamento() {
    falar('Deixa eu ver seus medicamentos...');
    try {
      var lista = await carregarAlarmes(), melhor = null;
      lista.forEach(function (a) {
        var d = proximaOcorrencia(a);
        if (d && (!melhor || d < melhor.data)) melhor = { data: d, a: a };
      });
      if (!melhor) return falar('Você não tem nenhum medicamento agendado. Quer que eu cadastre um? Diga "adicionar remédio".');
      var nomes = melhor.a.medicamentos.map(function (m) { return m.nome + ', ' + m.dose; }).join(' e ');
      falar('Seu próximo medicamento é ' + nomes + ', ' + relativo(melhor.data) + ' às ' + horaFalada(melhor.data) + '.');
    } catch (e) { falar('Não consegui consultar seus medicamentos agora.'); }
  }
  async function medicamentosHoje() {
    try {
      var lista = await carregarAlarmes(), agora = new Date(), fim = new Date(); fim.setHours(23, 59, 59, 999);
      var itens = [];
      lista.forEach(function (a) {
        if (!a.ativo) return;
        var ini = new Date(a.primeiraDose), ms = a.intervaloHoras * 3600000;
        var total = a.duracaoTipo === 'continuo' ? Infinity
          : (a.duracaoTipo === 'doses' ? a.duracaoValor : Math.floor(a.duracaoValor * 86400000 / ms) + 1);
        var nomes = a.medicamentos.map(function (m) { return m.nome; }).join(' e ');
        for (var i = 0; i < total && itens.length < 40; i++) {
          var d = new Date(ini.getTime() + i * ms);
          if (d > fim) break;
          if (d >= agora) itens.push({ d: d, nome: nomes });
        }
      });
      itens.sort(function (x, y) { return x.d - y.d; });
      if (!itens.length) return falar('Você não tem mais medicamentos para tomar hoje.');
      falar('Hoje ainda falta: ' + itens.map(function (i) { return i.nome + ' às ' + horaFalada(i.d); }).join('; ') + '.');
    } catch (e) { falar('Não consegui consultar seus medicamentos agora.'); }
  }

  function confirmarCadastroMedicamento(d) {
    var duracao = d.duracaoTipo === 'continuo'
      ? 'sem data para terminar'
      : 'durante ' + d.duracaoValor + ' ' + (d.duracaoTipo === 'dias'
        ? (d.duracaoValor === 1 ? 'dia' : 'dias')
        : (d.duracaoValor === 1 ? 'dose' : 'doses'));
    confirmar('Vou criar o alarme de ' + d.nome + ', ' + d.dose + ', a cada ' + d.intervalo + ' horas, ' + duracao +
      ', começando ' + relativo(d.primeira) + ' às ' + horaFalada(d.primeira) + '. Confirma?', function () {
      salvarMedicamento(d);
    });
  }

  function perguntarQuantidadeDuracao(d) {
    var unidade = d.duracaoTipo === 'dias' ? 'dias' : 'doses';
    perguntar('Por quantos ' + unidade + ' você vai tomar esse remédio?', function (t) {
      var quantidade = parseNumero(t);
      if (!quantidade || quantidade < 1) return 'Não entendi a quantidade. Diga um número de ' + unidade + '.';
      d.duracaoValor = quantidade;
      confirmarCadastroMedicamento(d);
    });
  }

  function cadastrarMedicamento() {
    var d = {};
    perguntar('Vamos cadastrar um remédio. Qual é o nome dele?', function (t, orig) {
      var nome = orig.replace(/^(o |a )?(remedio|medicamento)\s+(e |chama |chamado )?/i, '').trim();
      if (nome.length < 2) return 'Não entendi o nome. Pode repetir?';
      d.nome = capitalizar(nome);
      perguntar('Qual é a dose? Por exemplo: um comprimido de 500 miligramas.', function (t2, orig2) {
        if (orig2.trim().length < 2) return 'Não entendi a dose. Pode repetir?';
        d.dose = orig2.trim();
        perguntar('De quantas em quantas horas você toma?', function (t3) {
          var n = parseNumero(t3);
          if (!n || n < 1 || n > 48) return 'Não entendi. Diga só o número de horas, como oito.';
          d.intervalo = n;
          perguntar('Que horas é a primeira dose? Diga agora, ou um horário como 8 horas.', function (t4) {
            var h = parseHora(t4);
            if (!h) return 'Não entendi o horário. Diga, por exemplo, 14 horas e 30.';
            d.primeira = h;
            perguntar('O tratamento é por dias, por número de doses ou contínuo?', function (t5) {
              d.duracaoTipo = tipoDuracao(t5);
              if (!d.duracaoTipo) return 'Não entendi a duração. Diga por dias, por número de doses ou contínuo.';
              if (d.duracaoTipo === 'continuo') {
                d.duracaoValor = null;
                confirmarCadastroMedicamento(d);
                return;
              }
              d.duracaoValor = parseNumero(t5);
              if (d.duracaoValor) confirmarCadastroMedicamento(d);
              else perguntarQuantidadeDuracao(d);
            });
          });
        });
      });
    });
  }
  async function salvarMedicamento(d) {
    try {
      var c = await getSB();
      if (!c) throw new Error('sem conexão');
      var r = await c.from('medicamentos').upsert({
        id: 'alarme-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        usuario_id: idMedicamentos(),
        medicamentos: [{ nome: d.nome, dose: d.dose }],
        primeira_dose: inputLocal(d.primeira),
        intervalo_horas: d.intervalo,
        duracao_tipo: d.duracaoTipo, duracao_valor: d.duracaoValor, ativo: true
      });
      if (r.error) throw r.error;
      falar('Pronto! O alarme de ' + d.nome + ' foi criado. Ele vai tocar quando você estiver na tela de medicamentos.');
    } catch (e) {
      console.error('Assistente: erro ao salvar medicamento', e);
      falar('Não consegui salvar o alarme agora. Tente de novo mais tarde.');
    }
  }

  // ---------- Consultas ----------
  async function carregarConsultas() {
    var c = await getSB();
    if (!c) return [];
    var r = await c.from('consulta').select('*').eq('id_usuario', idNumerico());
    if (r.error) throw r.error;
    return (r.data || []).map(function (x) {
      var dia = x.data_consulta, hora = String(x.hora_consulta || '00:00').slice(0, 5);
      return { medico: x.medico, esp: x.especialidade, local: x.local_atendimento, quando: new Date(dia + 'T' + hora + ':00') };
    }).filter(function (x) { return !isNaN(x.quando); });
  }
  async function proximaConsulta() {
    falar('Deixa eu ver suas consultas...');
    try {
      var futuras = (await carregarConsultas()).filter(function (c) { return c.quando >= new Date(); })
        .sort(function (a, b) { return a.quando - b.quando; });
      if (!futuras.length) return falar('Você não tem consultas marcadas. Quer cadastrar uma? Diga "abrir consultas".');
      var c = futuras[0];
      falar('Sua próxima consulta é de ' + c.esp + ' com ' + c.medico + ', ' + relativo(c.quando) + ' às ' + horaFalada(c.quando) +
        (c.local ? ', em ' + c.local : '') + '.');
    } catch (e) { falar('Não consegui consultar suas consultas agora.'); }
  }

  // ---------- Emergência (lê contato_emergencia, igual ao home.html) ----------
  async function acionarEmergencia() {
    var nome = 'SAMU', tel = '192';
    try {
      var u = usuarioObj(), c = await getSB();
      if (c && u && u.id_usuario) {
        var r = await c.from('contato_emergencia').select('*').eq('id_usuario', u.id_usuario);
        if (!r.error && r.data && r.data.length) { nome = r.data[0].nome_contato; tel = r.data[0].telefone; }
      }
    } catch (e) { /* usa SAMU */ }
    falar('Ligando para ' + nome + ' agora.', function () {
      window.location.href = 'tel:' + String(tel).replace(/[^\d+]/g, '');
    });
  }
  async function ligarContato() {
    try {
      var u = usuarioObj(), c = await getSB();
      var r = await c.from('contato_emergencia').select('*').eq('id_usuario', u.id_usuario);
      if (r.error || !r.data || !r.data.length) return falar('Você ainda não cadastrou um contato de emergência. Posso abrir as configurações.');
      var ct = r.data[0];
      confirmar('Ligar para ' + ct.nome_contato + '?', function () {
        falar('Ligando para ' + ct.nome_contato + '.', function () { window.location.href = 'tel:' + String(ct.telefone).replace(/[^\d+]/g, ''); });
      });
    } catch (e) { falar('Não consegui buscar seu contato agora.'); }
  }

  // ---------- Ações disponíveis ----------
  var PAGINAS = {
    inicio:        { url: 'home.html',                nome: 'a tela inicial' },
    medicamentos:  { url: 'medicamentos.html',        nome: 'os medicamentos' },
    consultas:     { url: 'lembretedeconsultas.html', nome: 'os lembretes de consultas' },
    jogos:         { url: 'minijogos.html',           nome: 'os mini jogos' },
    cacapalavras:  { url: 'jogo-caca-palavras.html',  nome: 'o caça-palavras' },
    memoria:       { url: 'jogo-da-memoria.html',     nome: 'o jogo da memória' },
    configuracoes: { url: 'configuracoes.html',       nome: 'as configurações' }
  };

  function ir(chave) {
    var p = PAGINAS[chave];
    falar('Abrindo ' + p.nome + '.', function () { window.location.href = p.url; });
  }

  function mudarFonte(delta) {
    var atual = parseFloat(document.documentElement.style.fontSize) || 100;
    var novo = Math.max(85, Math.min(150, atual + delta));
    document.documentElement.style.fontSize = novo + '%';
    falar(delta > 0 ? 'Aumentei o tamanho das letras.' : 'Diminuí o tamanho das letras.');
  }

  // Lista de intenções: a primeira que casar vence (ordem importa!)
  var INTENCOES = [
    { id: 'emergencia', quando: function (t) { return tem(t, ['emergencia', 'socorro', 'samu', 'preciso de ajuda urgente', 'passando mal']); },
      fazer: function () { confirmar('Você quer mesmo acionar a emergência? Diga sim ou não.', acionarEmergencia); } },
    { id: 'sair', quando: function (t) { return /\b(sair|desconectar|logout|encerrar sessao)\b/.test(t); },
      fazer: function () {
        falar('Saindo da sua conta. Até logo!', function () {
          localStorage.removeItem('usuario_logado'); localStorage.removeItem('usuarioLogado');
          window.location.href = 'index.html';
        });
      } },
    { id: 'hora', quando: function (t) { return tem(t, ['que horas', 'qual a hora', 'qual e a hora', 'me diga as horas']); },
      fazer: function () {
        var d = new Date();
        falar('Agora são ' + d.getHours() + ' horas e ' + d.getMinutes() + ' minutos.');
      } },
    { id: 'data', quando: function (t) { return tem(t, ['que dia', 'qual a data', 'data de hoje', 'dia da semana']); },
      fazer: function () {
        var d = new Date();
        falar('Hoje é ' + d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.');
      } },
    { id: 'fonte+', quando: function (t) { return tem(t, ['aumentar letra', 'letra maior', 'aumentar a letra', 'aumentar texto', 'letras maiores']); },
      fazer: function () { mudarFonte(+15); } },
    { id: 'fonte-', quando: function (t) { return tem(t, ['diminuir letra', 'letra menor', 'diminuir a letra', 'diminuir texto', 'letras menores']); },
      fazer: function () { mudarFonte(-15); } },
    { id: 'ajuda', quando: function (t) { return tem(t, ['o que voce faz', 'o que voce pode', 'como funciona', 'comandos', 'me ajuda', 'ajuda']); },
      fazer: function () {
        falar('Eu posso dizer seu próximo remédio e sua próxima consulta, cadastrar um remédio novo, ligar para seu contato, abrir as telas do aplicativo, dizer a hora e a data, aumentar as letras e acionar a emergência. Para abrir uma tela, diga acessar e o nome dela. É só pedir!');
      } },
    { id: 'add-med', quando: function (t) { return /(adicionar|cadastrar|criar|novo|nova|incluir|colocar).*(remedio|medicamento|alarme)/.test(t); }, fazer: cadastrarMedicamento },
    { id: 'med-hoje', quando: function (t) { return /(remedio|medicamento).*(hoje)|o que (eu )?(tenho|preciso) (de )?tomar|que remedios? (eu )?(tomo|tenho)/.test(t); }, fazer: medicamentosHoje },
    { id: 'prox-med', quando: function (t) { return /(proximo|proxima|quando).*(remedio|medicamento|dose)|que remedio.*tomar|hora do remedio/.test(t); }, fazer: proximoMedicamento },
    { id: 'prox-consulta', quando: function (t) { return /(proxima|quando).*(consulta)|tenho consulta|minha consulta/.test(t); }, fazer: proximaConsulta },
    { id: 'ligar', quando: function (t) { return /(ligar|ligue|telefonar|chamar).*(contato|familiar|filho|filha|parente)|ligar para (meu )?contato/.test(t); }, fazer: ligarContato },
    { id: 'acessar-generico', quando: function (t) { return /^(quero |gostaria de |preciso )?(acessar|abrir|entrar|ir|ver|mostrar)( em| para| na| no| a| uma| as| os| minhas| meus)?( funcao| funcoes| tela| telas| opcao| opcoes| menu)?$/.test(t) || tem(t, ['quais funcoes', 'quais sao as funcoes', 'que funcoes']); },
      fazer: function () {
        perguntar('Qual função você quer acessar? Medicamentos, calendário, dicas, jogos, consultas ou configurações?', function (t) {
          var ids = ['cacapalavras', 'memoria', 'jogos', 'medicamentos', 'consultas', 'config', 'calendario', 'dicas', 'voz', 'inicio'];
          for (var i = 0; i < INTENCOES.length; i++) {
            if (ids.indexOf(INTENCOES[i].id) !== -1 && INTENCOES[i].quando(t)) return INTENCOES[i].fazer(t);
          }
          return 'Não entendi qual função. Diga, por exemplo, medicamentos, ou diga cancelar.';
        });
      } },
    { id: 'calendario', quando: function (t) { return tem(t, ['calendario', 'agenda de saude']); },
      fazer: function () { falar('O calendário de saúde ainda está em desenvolvimento. Em breve ele estará disponível.'); } },
    { id: 'dicas', quando: function (t) { return /\b(dica|dicas)\b/.test(t); },
      fazer: function () { falar('As dicas úteis ainda estão em desenvolvimento. Em breve você poderá acessá-las.'); } },
    { id: 'voz', quando: function (t) { return tem(t, ['comando de voz', 'comandos de voz']); },
      fazer: function () { falar('Você já está usando o comando de voz! Diga ajuda para ouvir o que eu sei fazer.'); } },
    { id: 'cacapalavras', quando: function (t) { return tem(t, ['caca palavra', 'caca palavras']); }, fazer: function () { ir('cacapalavras'); } },
    { id: 'memoria', quando: function (t) { return tem(t, ['jogo da memoria', 'jogar memoria', 'abrir memoria']); }, fazer: function () { ir('memoria'); } },
    { id: 'jogos', quando: function (t) { return tem(t, ['jogo', 'jogar', 'diversao']); }, fazer: function () { ir('jogos'); } },
    { id: 'medicamentos', quando: function (t) { return tem(t, ['medicamento', 'remedio', 'alarme', 'comprimido']); }, fazer: function () { ir('medicamentos'); } },
    { id: 'consultas', quando: function (t) { return tem(t, ['consulta', 'medico', 'agendamento']); }, fazer: function () { ir('consultas'); } },
    { id: 'config', quando: function (t) { return tem(t, ['configuracao', 'configuracoes', 'ajustes', 'contato de emergencia']); }, fazer: function () { ir('configuracoes'); } },
    { id: 'inicio', quando: function (t) { return tem(t, ['inicio', 'home', 'tela principal', 'voltar']); }, fazer: function () { ir('inicio'); } },
    { id: 'oi', quando: function (t) { return /\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(t); },
      fazer: function () {
        var n = primeiroNome();
        falar('Olá' + (n ? ', ' + n : '') + '! Como posso ajudar?');
      } }
  ];

    function processar(textoOriginal) {
    var t = norm(textoOriginal);
    mostrarOuvido(textoOriginal);
    if (!t) return falar('Não consegui entender. Pode repetir?');

    if (aguardando) {
      var h = aguardando; aguardando = null;
      if (tem(t, ['cancelar', 'deixa pra la', 'esquece'])) return falar('Tudo bem, cancelei.');
      return h(t, textoOriginal);
    }

    for (var i = 0; i < INTENCOES.length; i++) {
      if (INTENCOES[i].quando(t)) return INTENCOES[i].fazer(t);
    }
    falar('Desculpe, ainda não sei fazer isso. Diga "ajuda" para ouvir o que eu sei fazer.');
  }

  // ---------- Reconhecimento de voz ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, ouvindo = false;

  function ouvir() {
    if (!SR) return falar('Seu navegador não suporta reconhecimento de voz. Use o Chrome, Edge ou Safari, ou digite o comando.');
    if (ouvindo) return;
    if (window.speechSynthesis) speechSynthesis.cancel();
    rec = new SR();
    rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    var final = '';
    rec.onstart = function () { ouvindo = true; setEstado('ouvindo'); mostrarOuvido('Estou ouvindo...'); };
    rec.onresult = function (e) {
      var parcial = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else parcial += e.results[i][0].transcript;
      }
      mostrarOuvido(final || parcial);
    };
    rec.onerror = function (e) {
      ouvindo = false; setEstado('parado');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        falar('Preciso da permissão do microfone. Libere o microfone nas configurações do navegador.');
      else if (e.error === 'no-speech') falar('Não ouvi nada. Toque no microfone e tente de novo.');
      else if (e.error !== 'aborted') falar('Ocorreu um erro no microfone. Tente novamente.');
    };
    rec.onend = function () {
      ouvindo = false; setEstado('parado');
      if (final.trim()) processar(final);
    };
    try { rec.start(); } catch (err) { /* já iniciado */ }
  }
  function parar() { if (rec && ouvindo) rec.stop(); }

  // ---------- Interface ----------
  var $btn, $painel, $ouvi, $resp;

  function injetarUI() {
    var css = document.createElement('style');
    css.textContent =
      '#va-btn{position:fixed;right:18px;bottom:18px;width:68px;height:68px;border-radius:50%;border:3px solid #f3efdc;' +
      'background:linear-gradient(160deg,#2f9e8f,#1b6b5f);color:#fff;cursor:pointer;z-index:9998;display:flex;align-items:center;' +
      'justify-content:center;box-shadow:0 8px 22px rgba(0,0,0,.35);transition:transform .1s}' +
      '#va-btn:active{transform:scale(.94)}#va-btn:focus-visible{outline:3px solid #f3efdc;outline-offset:3px}' +
      '#va-btn svg{width:32px;height:32px}' +
      '#va-btn.ouvindo{background:#c0392b;animation:vapulse 1.2s infinite}' +
      '@keyframes vapulse{0%{box-shadow:0 0 0 0 rgba(192,57,43,.6)}70%{box-shadow:0 0 0 20px rgba(192,57,43,0)}100%{box-shadow:0 0 0 0 rgba(192,57,43,0)}}' +
      '#va-painel{position:fixed;right:18px;bottom:98px;width:min(360px,calc(100vw - 36px));background:#f3efdc;border:2px solid #cdbf95;' +
      'border-radius:22px;padding:16px;z-index:9999;box-shadow:0 20px 50px rgba(0,0,0,.4);font-family:"Trebuchet MS","Segoe UI",Verdana,sans-serif;' +
      'color:#26332a;display:none}#va-painel.aberto{display:block}' +
      '#va-painel h3{margin:0 0 8px;font-size:.95rem;font-weight:900;text-transform:uppercase;color:#1b3a26;display:flex;justify-content:space-between;align-items:center}' +
      '#va-fechar{background:#ece5c9;border:none;width:34px;height:34px;border-radius:50%;cursor:pointer;color:#1b3a26;font-size:1rem}' +
      '.va-linha{border-radius:14px;padding:10px 12px;margin-top:8px;font-size:.95rem;font-weight:600;line-height:1.4;min-height:42px}' +
      '#va-ouvi{background:#fff;border:1.5px solid #cdbf95;color:#55604f}' +
      '#va-resp{background:#dcefdf;border:1.5px solid #a5d6a7;color:#1b3a26}' +
      '.va-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}' +
      '.va-chip{background:#fff;border:2px solid #cdbf95;border-radius:999px;padding:6px 11px;font-size:.78rem;font-weight:700;color:#1b3a26;cursor:pointer;font-family:inherit}' +
      '.va-chip:hover{border-color:#2f9e8f}' +
      '.va-form{display:flex;gap:6px;margin-top:10px}' +
      '.va-form input{flex:1;border:2px solid #cdbf95;border-radius:12px;padding:8px 10px;font-size:.9rem;background:#fff;min-width:0}' +
      '.va-form button{background:#1b3a26;color:#f3efdc;border:none;border-radius:12px;padding:0 14px;font-weight:800;cursor:pointer}';
    document.head.appendChild(css);

    $btn = document.createElement('button');
    $btn.id = 'va-btn'; $btn.type = 'button';
    $btn.setAttribute('aria-label', 'Abrir assistente de voz');
    $btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/></svg>';

    $painel = document.createElement('div');
    $painel.id = 'va-painel';
    $painel.setAttribute('role', 'dialog');
    $painel.setAttribute('aria-label', 'Assistente de voz');
    $painel.innerHTML =
      '<h3><span>🎙️ Assistente ' + NOME_ASSISTENTE + '</span><button id="va-fechar" type="button" aria-label="Fechar">✕</button></h3>' +
      '<div class="va-linha" id="va-ouvi">Toque no microfone e fale.</div>' +
      '<div class="va-linha" id="va-resp" aria-live="polite">Olá! Como posso ajudar?</div>' +
      '<div class="va-chips">' +
        ['Próximo remédio', 'Próxima consulta', 'Adicionar remédio', 'Acessar função', 'Que horas são', 'Aumentar letra', 'Ajuda']
          .map(function (c) { return '<button type="button" class="va-chip">' + c + '</button>'; }).join('') +
      '</div>' +
      '<form class="va-form" id="va-form"><input id="va-texto" type="text" placeholder="Ou digite um comando" aria-label="Digite um comando"><button type="submit">Enviar</button></form>';

    document.body.appendChild($painel);
    document.body.appendChild($btn);
    $ouvi = $painel.querySelector('#va-ouvi');
    $resp = $painel.querySelector('#va-resp');

    $btn.addEventListener('click', function () {
      if (ouvindo) return parar();
      abrir(); ouvir();
    });
    $painel.querySelector('#va-fechar').addEventListener('click', fechar);
    $painel.querySelectorAll('.va-chip').forEach(function (b) {
      b.addEventListener('click', function () { processar(b.textContent); });
    });
    $painel.querySelector('#va-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = document.getElementById('va-texto');
      if (inp.value.trim()) { processar(inp.value); inp.value = ''; }
    });
  }

  function abrir() { $painel.classList.add('aberto'); }
  function fechar() { parar(); if (window.speechSynthesis) speechSynthesis.cancel(); $painel.classList.remove('aberto'); }
  function setEstado(s) { $btn.classList.toggle('ouvindo', s === 'ouvindo'); }
  function mostrarOuvido(t) { if ($ouvi) $ouvi.textContent = '🗣️ ' + t; }
  function mostrarResposta(t) { if ($resp) { $resp.textContent = '🤖 ' + t; abrir(); } }

  // ---------- Inicialização ----------
  function iniciar() {
    injetarUI();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  // API pública
  window.AssistenteVoz = {
    abrir: function () { abrir(); ouvir(); },
    fechar: fechar,
    processar: processar
  };
})();
