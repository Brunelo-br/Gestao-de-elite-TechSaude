# TechSaúde — Relatório Técnico de Desenvolvimento: Tela de Login

*FATEC Barueri — Gestão de TI | Escopo: front-end de `login.html` (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`login.html`), sem build step, sem dependências de terceiros além de fontes via CDN. Divisão interna:

- **HTML5** — ~99 linhas — marcação semântica, sem framework de componentes.
- **CSS3** — ~358 linhas — variáveis CSS (`:root`) centralizam paleta e espaçamento; layout com CSS Grid (duas colunas no desktop) e Flexbox (campos, cabeçalho); 2 breakpoints via media query.
- **JavaScript** — ~224 linhas — vanilla JS em IIFE, sem dependências externas; manipulação direta do DOM e Fetch API para a chamada de login (endpoint ainda não integrado em produção).

## 2. Histórico de iterações

- **v1** — Layout replicado dentro de um mockup de smartphone (bezel/notch via `::before`), oculto em telas estreitas por media query.
- **v2** — Mockup removido; grid de 2 colunas (branding + formulário) acima de 900px, colapsando para cartão único (480–900px) e tela cheia sem bordas (<480px).
- **v3** — Logomarca oficial (PNG) substituindo ícone SVG provisório; testada primeiro embutida em base64 (arquivo único, ~400 KB) e depois externalizada como asset referenciado por caminho relativo, para manter o HTML leve (~16 KB) e alinhado à estrutura de pastas do repositório Git.
- **v4** — Validação de CPF com dígito verificador real (módulo 11) e máscara de formatação em tempo real, adicionada por outro integrante do grupo.

## 3. Responsividade

| Breakpoint | Layout | Implementação |
|---|---|---|
| `> 900px` | Grid 2 colunas | `grid-template-columns: 1.05fr 0.95fr` |
| `480–900px` | Cartão único | `.site-aside{display:none}`; grid vira `1fr` |
| `< 480px` | Full-bleed | `border-radius` e `box-shadow` zerados; padding do body removido |

## 4. Validações e lógica client-side

- **CPF/e-mail** — Campo único aceita CPF ou e-mail; máscara aplicada via regex apenas quando o valor não contém `"@"`, evitando conflito com digitação de e-mail.
- **Dígito verificador** — `validarCPF()` implementa o algoritmo padrão (2 dígitos verificadores, módulo 11), rejeitando sequências repetidas (ex: `111.111.111-11`); feedback inline atualizado no evento `input`.
- **Campos obrigatórios** — validação de campos vazios com foco no primeiro campo inválido e mensagem associada via `aria-describedby`.
- **Show/hide senha** — toggle de `type="password"`/`"text"` com troca do path do ícone SVG e `aria-pressed` sincronizado.
- **Submit** — `fetch()` assíncrono com `try/catch`; estado de loading desabilita o botão durante a chamada. Endpoint apontando para API local (`localhost:3000`) — integração de banco/API é etapa futura, fora do escopo deste relatório.

## 5. Acessibilidade (WCAG-aligned)

Alvo de toque mínimo de 56px, contraste texto/fundo acima de 4.5:1, `aria-label`/`aria-describedby`/`aria-live` nos campos e no banner de status, outline visível em `:focus-visible`, e ordem de tabulação nativa (sem `tabindex` manual).

## 6. Organização de assets

Logomarca referenciada por caminho relativo (`ativos/imagem/logo-techsaude.png`), compatível com a estrutura de pastas do repositório GitHub do grupo e reutilizável por outras telas sem duplicação de binário.

## 7. Testes executados

Testes automatizados (Playwright) e verificação visual, cobrindo: renderização nos 3 breakpoints; bloqueio de submit com campos vazios; validação de CPF com dígitos corretos e incorretos; imunidade da máscara a e-mails; toggle de senha; carregamento do asset de imagem na estrutura de pastas real do repositório. Sem cobertura de integração com back-end, por não estar em uso nesta fase.

## 8. Fora de escopo

Banco de dados, API de autenticação e persistência de sessão foram prototipados em paralelo, mas não estão integrados a este arquivo em caráter definitivo — serão cobertos em relatório próprio quando essa camada for conectada.
