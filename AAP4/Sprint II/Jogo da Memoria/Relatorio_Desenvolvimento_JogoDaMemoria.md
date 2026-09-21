# TechSaúde — Relatório Técnico de Desenvolvimento: Jogo da Memória

*FATEC Barueri — Gestão de TI | Escopo: front-end de jogo-da-memoria.html (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`jogo-da-memoria.html`), sem build step, sem dependências de terceiros além da fonte Baloo 2 via CDN — reaproveita integralmente o design system e os padrões de componente construídos para `jogo-caca-palavras.html` (mesmo cabeçalho, paleta, toast, modais). Divisão interna:

- **HTML5 ~112 linhas** — duas telas (`telaSelecao`, `telaJogo`; sem tela de opções, pois não há nada configurável), dois diálogos modais (ajuda e vitória).
- **CSS3 ~228 linhas** — flip 3D de carta via `perspective` + `transform-style:preserve-3d` + `backface-visibility:hidden`; grid responsivo com tamanho de carta em `rem`, escalado por nível e breakpoint.
- **JavaScript ~341 linhas** — vanilla JS em IIFE; banco de 84 itens temáticos (emoji + nome), motor de embaralhamento de baralho, máquina de estados de virada de carta (`flippedIndexes`, `lock`), mecânica de "espiadela" única por partida.

## 2. Histórico de iterações

- **v1** — Escopo definido via perguntas de esclarecimento com o Eduardo: cartas só com ícone/emoji (sem texto, para não depender de leitura/alfabetização), banco de itens sorteado a cada partida (mesmo raciocínio do pool de palavras do caça-palavras), uma "espiadela" por partida como única ajuda, 3 níveis (6/8/10 pares).
- **v2** — Bug encontrado em teste próprio antes da entrega: o flip 3D das cartas não aparecia visualmente, apesar da classe CSS ser aplicada corretamente. Causa: `.mem-card-inner`/`.mem-card-face` eram `<span>` (inline por padrão), que ignora `transform`/`width`/`height` mesmo com `position` definido. Corrigido adicionando `display:block`.
- **v3** — Dois bugs reportados pelo Eduardo em teste real, com print: (1) uma carta virada sozinha "travava" quando o jogador usava a Espiadela antes de escolher a segunda carta — `flippedIndexes` era zerado sem desfazer a virada dessa carta, que ficava órfã para sempre; corrigido resolvendo a seleção pendente (flip de volta) antes de iniciar a espiadela. (2) Carta encontrada ficava pouco diferenciável das demais — a opacidade aplicada à camada com a rotação 3D causava "vazamento" visual do verso por trás da frente em alguns navegadores; corrigido removendo a opacidade e substituindo por borda verde mais grossa + selo "✓" no canto da carta.
- **v4** — Correção de carregamento da logo reportada em teste local: mesmo fallback em cascata aplicado no caça-palavras (`logo.png` → `img/logo.png`).

## 3. Responsividade

| Nível | Cartas | Colunas | Ajuste mobile |
|---|---|---|---|
| Fácil (6 pares) | 12 | 4 | `--card-size` reduzido em 2 breakpoints (480px/360px) |
| Médio (8 pares) | 16 | 4 | idem |
| Difícil (10 pares) | 20 | 5 | idem; validado sem overflow horizontal em viewport de 390px |

## 4. Lógica do jogo e validações client-side

- **Flip 3D** — cada carta é um `<button>` com verso e frente sobrepostos (`position:absolute` + `backface-visibility:hidden`); as classes `.flipped`/`.matched` aplicam `rotateY(180deg)` ao contêiner interno da carta.
- **Comparação de pares** — `onCardClick()` acumula até 2 índices em `flippedIndexes`; ao completar o par, compara `pairId` e resolve via `setTimeout` (350ms para acerto; 700ms + 550ms para erro, dando tempo do jogador visualizar as duas cartas antes de virarem de volta); a flag `lock` bloqueia novos cliques durante a resolução.
- **Espiadela** — revela todas as cartas ainda não encontradas por 2,6s, uma única vez por partida; antes de revelar, cancela de forma limpa qualquer seleção de carta pendente (correção do bug de carta órfã da v3).
- **`prefers-reduced-motion`** — desliga a transição de flip para jogadores com essa preferência ativada no sistema operacional.

## 5. Acessibilidade (WCAG-aligned)

Cartas reconhecíveis por ícone, sem depender de leitura ou alfabetização; nome do item disponível só no `aria-label` de cada carta, para leitor de tela. Sem cronômetro regressivo nem pontuação — apenas tempo decorrido e contagem de tentativas, ambos informativos. Alvo de toque grande, alto contraste herdado do app, `aria-live` no anúncio de par encontrado e de vitória, toasts não-bloqueantes em vez de `alert()` nativo.

## 6. Organização de assets

Nenhum asset binário próprio — as 84 "figurinhas" das cartas são emojis Unicode (sem imagens externas, peso zero de download adicional); reaproveita a logo do app com o mesmo fallback em cascata `logo.png`/`img/logo.png` usado no caça-palavras.

## 7. Testes executados

**Playwright**: fluxo completo nos 3 níveis; par correto marcando como encontrado (com o selo ✓); par errado com destaque vermelho temporário; espiadela revelando e ocultando corretamente, incluindo reprodução dirigida do bug de carta órfã (confirmando a correção); vitória com todos os pares; "Jogar de novo" e "Trocar nível"; modal de Ajuda; botão Emergência e link Início — sem erros de console em nenhum teste. **Node**: 84 itens do banco validados como únicos (emoji e nome). Fallback de logo testado em 3 cenários de pasta (arquivo local, subpasta `img/`, ausente).

## 8. Fora de escopo

Persistência (localStorage/Supabase), guard de sessão e lógica real do botão de Emergência — mesmo raciocínio do caça-palavras, deliberadamente adiados para a fase de integração ao projeto real.
