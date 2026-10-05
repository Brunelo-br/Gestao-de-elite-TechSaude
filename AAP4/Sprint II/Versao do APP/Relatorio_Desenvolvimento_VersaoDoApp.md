# TechSaúde — Relatório Técnico de Desenvolvimento: Versão do App

*FATEC Barueri — Gestão de TI | Escopo: front-end de versao.html + aviso de atualização na home.html (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`versao.html`), sem build step, sem dependências de terceiros além das fontes via CDN. Reaproveita integralmente o design system de `minijogos.html` (cabeçalho `.topbar`, paleta, toast, modal de Ajuda, controle de fonte). O aviso de atualização é um bloco `<style>` + `<script>` colado no fim da `home.html`, com CSS próprio prefixado (`.tsn-*`) para não colidir com as variáveis da Home. Divisão interna:

- **HTML5 ~102 linhas** (versao.html): cabeçalho padrão, toolbar de acessibilidade, contêiner `#conteudoVersao` renderizado via JS e modal de Ajuda.
- **CSS3 ~229 linhas** (versao.html) + **~19** (home): componentes novos `.versao-hero`, `.novidade-card`, `.tag-tipo` (Novo/Melhorou/Corrigido) e `.versao-anterior` (`<details>`/`<summary>`).
- **JavaScript ~216 linhas** (versao.html) + **~84** (home): vanilla JS em IIFE; objeto de dados `window.TECHSAUDE_VERSOES` (`atual` + `historico[]` com `{versao, data, resumo, itens[{tipo, icone, titulo, texto}]}`), renderização por template string com `escapeHtml()` e comparador semântico de versões.

## 2. Histórico de iterações

- **v1**: arquitetura com 3 arquivos (`versao.html` + `versoes.js` como fonte única + `aviso-novidades.js`). O aviso listava até 3 novidades e "E mais N", juntando itens de versões puladas. 39/39 testes OK.
- **v2**: os `.js` separados não podiam ser baixados no ambiente do grupo, e o app roda via `file://`, onde um HTML não consegue ler dados de outro (`fetch` bloqueado por origem opaca). A solução foi embutir dados e lógica no próprio HTML e simplificar o aviso da Home para só o número da versão + "Ver as novidades". Trade-off aceito: o número da versão fica em 2 lugares (`atual` na `versao.html` e `VERSAO_ATUAL_DO_APP` na `home.html`).

## 3. Responsividade

| Breakpoint | Cartão da versão / novidades | Implementação |
|---|---|---|
| > 900px | Cartão largo, padding ampliado | `.app{padding:32px 40px}` (mesmo padrão das demais telas) |
| ≤ 480px | Ícones 72→56px / 60→50px, número 2.4→2rem | Media queries reduzem `.versao-hero-icon`, `.novidade-icon` e o padding |
| Aviso (Home) | Modal centralizado, `max-width:420px`, `max-height:92vh` com scroll | Validado sem overflow horizontal em 390px |

## 4. Lógica da tela e do aviso

- **Data sem erro de fuso**: `"2026-09-28"` é convertida com `T12:00:00` antes de `toLocaleDateString` e exibida por extenso.
- **Registro "já visto"**: chave `techsaude_versao_vista_<id_usuario>` no localStorage (lida do `usuario_logado` da Home), compartilhada pelas duas telas e com uma chave por usuário. A `versao.html` grava ao abrir.
- **Regras do aviso**: sem chave registra e não mostra nada (primeiro acesso); chave ≥ atual não mostra nada; chave < atual mostra o aviso, que grava ao fechar. `compararVersoes()` compara numericamente por segmento (`1.10.0 > 1.9.2`). Sem login, não executa.
- **Robustez**: todo acesso ao localStorage fica em `try/catch` (modo privado), e há mensagem de erro amigável se os dados estiverem ausentes.

## 5. Acessibilidade (WCAG-aligned)

Aviso com `role="dialog"` + `aria-modal`, foco inicial no botão principal, foco preso (Tab/Shift+Tab) e Esc fecha. **Tocar fora não fecha**, de propósito, para evitar fechamento acidental. Linguagem simples, voltada ao usuário, datas por extenso, emojis com `aria-hidden`, sanfonas nativas navegáveis por teclado, escala A/A+/A++, `prefers-reduced-motion` e alvos de toque ≥ 48px.

## 6. Organização de assets

Nenhum asset binário próprio: os ícones das novidades são emojis Unicode. Reaproveita a logo do app com o fallback em cascata `logo.png` → `img/logo.png`.

## 7. Testes executados

**Playwright (v2: 31/31 OK)**: tela aberta via HTTP e via `file://`; 4 itens da 1.0.0; registro por usuário. Na Home: primeiro acesso sem aviso; mesma versão sem aviso; atualização simulada 1.0.0 → 1.1.0 em desktop e mobile 390px exibindo o aviso; foco preso; clique fora não fecha; Entendi/Esc fecham e o aviso não volta; segundo usuário no mesmo aparelho também vê; "Ver as novidades" abre a 1.1.0 com a 1.0.0 em "anteriores"; quem já viu a tela não recebe o aviso; sem login, sem aviso. Home íntegra (6 cards) e sem erros de console.

## 8. Fora de escopo

Menu `sobre.html` (Sobre o App / Termos de Uso), por enquanto o Voltar aponta para `home.html` via `VOLTAR_PARA`. Guard de sessão, persistência em Supabase e lógica real do botão de Emergência ficam adiados para a fase de integração, como nas telas anteriores.
