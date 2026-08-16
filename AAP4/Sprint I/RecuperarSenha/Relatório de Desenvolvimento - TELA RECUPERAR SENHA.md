# TechSaúde — Relatório Técnico de Desenvolvimento: Tela de Recuperação de Senha

*FATEC Barueri — Gestão de TI | Escopo: front-end de `recuperar-senha.html` (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`recuperar-senha.html`), sem build step, sem dependências de terceiros além de fontes via CDN. Reaproveita o mesmo design system (variáveis `:root`, tipografia Baloo 2/Nunito e paleta) já definido em `login.html`, garantindo consistência visual entre as duas telas. Divisão interna:

- **HTML5 ~181 linhas** — marcação semântica dividida em 4 blocos de etapa (`#step1` a `#step4`), cada um com seu próprio `<form>` e mensagens de apoio.
- **CSS3 ~384 linhas** — herda a base de `login.html` (variáveis, grid de 2 colunas, cartão central) e acrescenta as classes `.step`/`.step.active`, `.stepper` (indicador "Etapa X de 3") e `.req-list` (checklist de requisitos de senha).
- **JavaScript ~293 linhas** — vanilla JS em IIFE, sem dependências externas; controla a máquina de estados do fluxo (`irParaEtapa()`) e três chamadas Fetch API (endpoints ainda não integrados em produção).

## 2. Histórico de iterações

- **v1** — Réplica fiel do mockup fornecido (imagem de referência): apenas a etapa de e-mail, com título "RECUPERAR SENHA" e botão "ENVIAR CÓDIGO DE RECUPERAÇÃO".
- **v2** — Decisão de escopo tomada com o grupo: em vez de uma tela isolada, optou-se pelo fluxo completo de 3 etapas (e-mail → código → nova senha) em um único arquivo, evitando múltiplos HTMLs e requisições de página cheia entre etapas.
- **v3** — Padrão `.step`/`.step.active` controlado por `irParaEtapa()`, com foco programático no `<h1>` de cada etapa ao ser exibida, essencial para leitores de tela em fluxos sem recarregar a página.
- **v4** — Checklist de requisitos de senha em tempo real (mínimo 6 caracteres + 1 número) e generalização do toggle mostrar/ocultar senha do login em `ligarToggleSenha()`, reutilizada nos dois campos de senha.
- **v5** — Integração com `login.html`: o botão "Recuperar a senha? Clique aqui." deixou de simular um aviso inline e passou a redirecionar (`window.location.href`) para `recuperar-senha.html`.

## 3. Responsividade

Reaproveita integralmente os breakpoints e a estrutura `.site`/`.site-aside`/`.app` definidos em `login.html`, sem alterações de layout entre as telas:

| Breakpoint | Layout | Implementação |
|---|---|---|
| > 900px | Grid 2 colunas | `grid-template-columns: 1.05fr 0.95fr` |
| 480–900px | Cartão único | `.site-aside{display:none}`; grid vira `1fr` |
| < 480px | Full-bleed | `border-radius` e `box-shadow` zerados; padding do `body` removido |

## 4. Validações e lógica client-side

- **Etapa 1 (e-mail)** — validação por regex simples de formato de e-mail; campo obrigatório com foco automático e mensagem de erro inline (`aria-describedby`). Em caso de falha de rede (back-end ainda não integrado), o `catch` do `fetch()` avança a etapa mesmo assim, permitindo testar o fluxo completo sem servidor.
- **Etapa 2 (código)** — campo numérico (`inputmode="numeric"`, `autocomplete="one-time-code"`) com filtro de caracteres não numéricos e limite de 6 dígitos aplicado no evento `input`; botão "Reenviar código" com `disabled` durante a requisição para evitar múltiplos envios.
- **Etapa 3 (nova senha)** — checklist de requisitos atualizada em tempo real (`reqTamanho`/`reqNumero` ganham a classe `.ok`); validação de confirmação de senha por igualdade; toggle de mostrar/ocultar reutilizado nos dois campos, com `aria-pressed` sincronizado.
- **Estado entre etapas** — objeto `estado` (`email`, `codigo`) mantido em closure na IIFE, sem uso de `localStorage`/`sessionStorage` ou parâmetros de URL.
- **Submit** — três funções `fetch()` assíncronas com `try/catch` (`enviarCodigo`, `verificarCodigo`, `redefinirSenha`), todas apontando para `localhost:3000`; integração de banco/API é etapa futura, fora do escopo deste relatório.

## 5. Acessibilidade (WCAG-aligned)

Mantém os mesmos padrões da tela de login — alvo de toque mínimo de 56px, contraste texto/fundo acima de 4.5:1, `aria-label`/`aria-describedby`/`aria-live` nos campos e no banner de status, outline visível em `:focus-visible` — e acrescenta dois pontos específicos do fluxo em etapas: gerenciamento programático de foco no título de cada etapa ao trocar de tela (compensa a ausência de recarregamento de página, que normalmente reposicionaria o foco para leitores de tela) e uso de `autocomplete="one-time-code"` no campo de código, que facilita o preenchimento automático via SMS/notificação em navegadores compatíveis.

## 6. Organização de assets

Reutiliza a mesma logomarca já referenciada em `login.html` (`ativos/imagem/logo-techsaude.png`), sem introdução de novos binários; nenhum ícone ou imagem adicional foi necessário, já que os elementos gráficos (ícone de sucesso, ícones de olho) são SVGs inline.

## 7. Testes executados

Testes automatizados (Playwright) cobrindo o fluxo completo: preenchimento e envio da etapa de e-mail, da etapa de código e da etapa de nova senha, com captura de tela de cada uma das 4 etapas e verificação do console do navegador quanto a erros de JavaScript. Nenhum erro de execução foi registrado; os únicos avisos de rede correspondem a comportamentos esperados no ambiente de teste local (asset de logo ausente, fontes via CDN bloqueadas e recusa de conexão ao back-end em `localhost:3000`, cenário que aciona intencionalmente o fallback de protótipo). Sem cobertura de integração com back-end real nem testes automatizados nos breakpoints de tablet/celular nesta rodada, por não estarem em uso nesta fase.

## 8. Fora de escopo

As três rotas de API (`/api/recuperar-senha/enviar-codigo`, `/verificar-codigo`, `/redefinir-senha`), o envio real de e-mail com o código, a expiração/limite de tentativas do código e a persistência da nova senha em banco de dados não estão implementados nesta camada — a tela opera em modo protótipo, avançando entre etapas mesmo sem resposta do servidor. Essas integrações serão cobertas em relatório próprio quando essa camada for conectada, seguindo o mesmo tratamento já dado à tela de login.
