# TechSaúde — Relatório Técnico de Desenvolvimento: Caça-Palavras

*FATEC Barueri — Gestão de TI | Escopo: front-end de jogo-caca-palavras.html (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`jogo-caca-palavras.html`), sem build step, sem dependências de terceiros além da fonte Baloo 2 via CDN — reaproveita o design system extraído das páginas reais do app (`medicamentos.html`, `lembretedeconsultas.html`). Divisão interna:

- **HTML5 ~136 linhas** — três telas (`telaSelecao`, `telaOpcoes`, `telaJogo`) alternadas via `classList`, dois diálogos modais (ajuda e vitória), cabeçalho padrão com Emergência/logo/Início.
- **CSS3 ~229 linhas** — variáveis `:root` idênticas às do app real (paleta, tipografia); grid responsivo para a grade de letras com tamanho de célula em `rem`, escalado por nível e breakpoint.
- **JavaScript ~547 linhas** — vanilla JS em IIFE, sem dependências externas; motor de geração de caça-palavras (posicionamento aleatório com retry), banco de 526 palavras, sorteio com verificação de colisão de substring, timer informativo e sistema de dica com limpeza de timeouts pendentes.

## 2. Histórico de iterações

- **v1** — Protótipo inicial com 3 níveis fixos (listas fixas de 5/6/8 palavras), direções fixas por nível, UI própria construída a partir de perguntas de esclarecimento sobre tema/dificuldade/persistência.
- **v2** — Pool de ~17 palavras por nível com sorteio (`sampleWords`), para a grade e a lista variarem a cada partida em vez de repetir sempre as mesmas palavras.
- **v3** — Tela de opções de direção (horizontal/vertical/diagonal/reverso) configurável pelo jogador antes de cada partida, botão "Aleatório" para o sistema decidir, pool único de 526 palavras (`MASTER_POOL`), verificação de colisão de substring em tempo de execução no sorteio, e fallback para todas as direções caso a combinação escolhida não caiba na grade.
- **v4** — Reskin completo: paleta, tipografia, cabeçalho (`.topbar`) e componentes (botões, cards, modais, toast) substituídos pelos padrões extraídos das páginas reais do app; botão Emergência (stub com toast) e link Início real (`home.html`) adicionados.
- **v5** — Ajustes de proporção do cabeçalho reportados em revisão visual: logo 96px→200px (igual às demais páginas) e centralização completa da tela de opções de direção.
- **v6** — Correção de carregamento da logo reportada em teste local: fallback em cascata `logo.png` → `img/logo.png`, cobrindo tanto o teste com os arquivos lado a lado quanto a convenção de pasta usada no app real.

## 3. Responsividade

| Breakpoint | Grade de letras | Implementação |
|---|---|---|
| > 760px | Painel de palavras + grade lado a lado | `grid-template-columns:260px 1fr` |
| ≤ 760px | Grade acima da lista de palavras | Coluna única; `order` no CSS reprioriza a grade visualmente |
| ≤ 480px / ≤ 360px | Célula da grade reduzida | `--cell-size` por nível evita rolagem horizontal nos níveis médio/difícil |

## 4. Lógica de geração de grade e validações client-side

- **Posicionamento de palavras** — `tryPlaceWord()` tenta até 200 posições aleatórias por palavra respeitando as direções habilitadas; `generatePuzzle()` reinicia a grade inteira até 60 vezes caso alguma palavra não caiba.
- **Sorteio sem colisão** — `sampleWords()` sorteia N palavras do pool e valida que nenhuma é substring de outra (o que geraria acerto falso ao selecionar); validado com 2000 simulações por nível em Node, ~1 tentativa em média até acertar um conjunto válido.
- **Seleção por dois toques** — `onCellActivate()` calcula o caminho reto entre a primeira e a última célula tocada (`computePath`), aceitando a palavra na ordem normal ou invertida conforme as direções habilitadas.
- **Sistema de dica** — `onDica()` destaca a palavra inteira na grade por 2,2s; `hintTimeouts[]` rastreia os timeouts pendentes para evitar erro ao trocar de nível no meio da animação (bug real encontrado e corrigido em teste).

## 5. Acessibilidade (WCAG-aligned)

Seleção por toque em vez de arraste (mais tolerante a baixa precisão motora), sem cronômetro regressivo nem pontuação, dica ilimitada sem penalidade, controle de escala de fonte (A/A+/A++) aplicado via `documentElement.style.fontSize`, alto contraste herdado do app, `aria-live` no anúncio de acertos e vitória, toasts não-bloqueantes em vez de `alert()` nativo (evitando o antipadrão já mapeado no relatório de testes do app).

## 6. Organização de assets

Nenhum asset binário próprio — reaproveita a logo do app (`logo.png`/`img/logo.png`, com fallback automático em cascata) e a fonte Baloo 2 via Google Fonts CDN. Ícones de direção e da interface são emojis Unicode, sem SVGs adicionais.

## 7. Testes executados

**Node**: geração de grade simulada 2000x por nível com sorteio de palavras (sempre bem-sucedida); configurações extremas de direção (só horizontal/vertical/diagonal) no nível difícil, 300/300 sucesso sem precisar do fallback. **Playwright**: fluxo completo dos 3 níveis e da tela de opções; validação de "pelo menos uma direção marcada"; botão Aleatório; 8 "Novo jogo" gerando 8 combinações distintas de palavras; simulação de vitória localizando e resolvendo cada palavra na grade real; botão Emergência e link Início; controle de fonte — sem erros de console em nenhum teste. Um bug real corrigido: `Cannot read properties of null` ao limpar o destaque de uma dica pendente após trocar para uma grade menor.

## 8. Fora de escopo

Persistência (localStorage/Supabase), guard de sessão e lógica real do botão de Emergência — deliberadamente fora desta fase para manter o arquivo testável de forma isolada; serão conectados quando o jogo for integrado à pasta real do projeto, junto das demais páginas.
