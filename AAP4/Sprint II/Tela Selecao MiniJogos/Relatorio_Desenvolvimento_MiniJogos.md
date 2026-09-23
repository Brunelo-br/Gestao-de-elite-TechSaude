# TechSaúde — Relatório Técnico de Desenvolvimento: Tela de Seleção de Mini Jogos

*FATEC Barueri — Gestão de TI | Escopo: front-end de minijogos.html (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`minijogos.html`), sem build step, sem dependências de terceiros além da fonte Baloo 2 via CDN — reaproveita integralmente o design system e os padrões de componente construídos para `jogo-caca-palavras.html` e `jogo-da-memoria.html` (mesmo cabeçalho, paleta, toast, modal de ajuda). Divisão interna:

- **HTML5 ~91 linhas** — tela única (sem estados/telas internas, ao contrário dos jogos), cabeçalho padrão (Emergência/logo/Início) e um diálogo modal (ajuda).
- **CSS3 ~158 linhas** — reaproveita quase integralmente o `:root` e os componentes dos dois jogos; único bloco novo é o `.game-card` (card-link horizontal com ícone, texto e chips de benefício).
- **JavaScript ~48 linhas** — vanilla JS em IIFE, bem mais enxuto que os jogos por não ter máquina de estados de jogo: relógio, toast de Emergência, abrir/fechar modal de ajuda e controle de escala de fonte.

## 2. Histórico de iterações

- **v1** — Escopo definido a partir de uma decisão de produto pendente nos dois relatórios anteriores ("o card 'Mini Jogos' da Home leva direto a um jogo ou a uma tela de escolha?"): decidido com o Eduardo que a Home leva a esta tela intermediária, que resume os jogos disponíveis e o benefício cognitivo de cada um antes do idoso escolher.
- **v1 (conteúdo)** — Um `.game-card` por jogo, cada um um `<a>` inteiro clicável (não só um botão pequeno dentro do card) apontando direto para o arquivo do jogo, com ícone temático, nome, descrição curta da mecânica e chips com os benefícios cognitivos (ex.: Caça-Palavras → Atenção visual/Vocabulário/Concentração; Jogo da Memória → Memória/Reconhecimento visual/Concentração).
- Sem correções de bug nesta tela — por ser uma composição de componentes já validados nos dois jogos anteriores (cabeçalho, toast, modal, fallback de logo), a única superfície realmente nova (`.game-card`) foi validada direto em Playwright antes da entrega, sem necessidade de rodada de correção.

## 3. Responsividade

| Breakpoint | Cards de jogo | Implementação |
|---|---|---|
| > 480px | Ícone + texto lado a lado, largura confortável | `.game-card` em `flex` horizontal, `gap` fixo |
| ≤ 480px | Ícone reduzido, padding menor | Regras de mídia reduzem `.game-card-icon` (64px→52px) e o padding do card |
| Qualquer largura | Lista sempre em coluna única | `.game-select-list` em `flex-direction:column`, sem grid multi-coluna (poucos itens, prioriza leitura vertical) |

## 4. Lógica da tela e validações client-side

- **Card como link completo** — cada `.game-card` é um `<a href="jogo-....html">` cobrindo todo o cartão (ícone, título, descrição e chips inclusos), não um botão isolado dentro de um card estático — maximiza a área de toque para um público com possível dificuldade motora.
- **Estados de interação** — `:hover` muda a borda para o teal do app e adiciona sombra leve; `:active` aplica um leve `scale(0.985)` para feedback tátil; `:focus-visible` desenha contorno de 3px em teal, garantindo navegação por teclado visível.
- **Sem máquina de estados** — diferente dos dois jogos, esta tela não tem lógica de jogo nem transições entre telas internas; toda a "lógica" client-side se resume a relógio, toast, modal e escala de fonte, os mesmos utilitários reaproveitados dos outros arquivos.
- **`prefers-reduced-motion`** — herdado dos componentes reaproveitados (toast, modal); não há animação própria além da transição de borda/sombra do hover, já sutil por padrão.

## 5. Acessibilidade (WCAG-aligned)

Card inteiro clicável (alvo de toque grande, sem exigir precisão em um botão pequeno), `aria-hidden` nos ícones decorativos para não poluir o leitor de tela, ordem de leitura natural (título → descrição → benefícios) antes do link ser ativado, contorno de foco visível (`:focus-visible`) para navegação por teclado, chips de benefício com contraste de cor validado (texto verde-escuro sobre fundo verde-claro), controle de escala de fonte (A/A+/A++) e alto contraste herdados do app.

## 6. Organização de assets

Nenhum asset binário próprio — ícones dos cards são emojis Unicode (🔤, 🃏), sem imagens externas; reaproveita a logo do app com o mesmo fallback em cascata `logo.png`/`img/logo.png` usado nos dois jogos.

## 7. Testes executados

**Playwright**: logo carregando corretamente e medindo 200x200 (mesma proporção dos outros dois arquivos); título "Mini Jogos" no cabeçalho; os dois `.game-card` apontando para os arquivos corretos, com navegação real testada clicando em cada um e confirmando a URL de destino; link Início apontando para `home.html`; botão Emergência exibindo toast sem navegar; modal de Ajuda abrindo e fechando; controle de fonte aplicando escala 130% (A++); estados de hover e foco por teclado conferidos visualmente — sem erros de console/JS em nenhum teste. Revisão visual em desktop (1200px) e mobile (390px) confirmando consistência de cabeçalho, paleta e proporções com `jogo-caca-palavras.html` e `jogo-da-memoria.html`.

## 8. Fora de escopo

Integração com `home.html` (botão de entrada) e persistência — deliberadamente fora desta entrega, pois o Eduardo vai integrar os 3 arquivos (esta tela + os dois jogos) na pasta real do projeto por conta própria. Guard de sessão e script do Supabase seguem o mesmo raciocínio dos dois jogos: adiados para a fase de integração.
