
**1 INTRODUÇÃO**

Este documento descreve, do ponto de vista técnico, o processo completo de criação da tela de Configurações da Conta do projeto TechSaúde — um aplicativo de saúde digital voltado a idosos e seus cuidadores, desenvolvido como protótipo acadêmico pelo curso de Gestão da Tecnologia da Informação da FATEC Barueri (4º semestre, 2026).

A tela foi implementada como um arquivo HTML, CSS e JS completamente autocontido, responsivo e interativo, alinhado visualmente ao *Design System* estabelecido pelas demais telas do projeto.

**2 CONTEXTO E REQUISITOS**

**2.1 Requisitos Funcionais**

*   **RF-01:** Exibir e editar nome social do usuário.
*   **RF-02:** Exibir e editar endereço e telefone de contato.
*   **RF-03:** Permitir troca de foto de perfil via upload de arquivo.
*   **RF-04:** Fluxo de alteração de senha com validação de força.
*   **RF-05:** Modal informativo "Sobre o App".
*   **RF-06:** Botão "Salvar Alterações" com *feedback* visual (*toast*).

**2.2 Requisitos Não Funcionais**

*   **RNF-01:** Interface responsiva — funcionar de 320 px a 1060 px de largura.
*   **RNF-02:** Consistência visual com as demais telas do projeto.
*   **RNF-03:** Logo carregado de pasta local (`assets/`), com *fallback* automático por SVG *inline*.
*   **RNF-04:** Acessibilidade básica: atributos `aria-label`, `role`, navegação por teclado (Tab / Enter / Esc).
*   **RNF-05:** Nenhuma dependência de *framework* JS — JavaScript *vanilla* puro.
*   **RNF-06:** Arquivo único e autocontido (exceto logo na pasta `assets/`).

**3 ARQUITETURA DA SOLUÇÃO**

**3.1 Estrutura do Arquivo**

Todo o código reside em um único arquivo `.html`, organizado em três blocos internos:

`techsaude_configuracoes.html`
*   `<head>`: Metadados, *viewport*, importação do Tabler Icons (CDN).
*   `<style>`: *Design System* completo em CSS3 (aprox. 380 linhas).
*   `<body>`: Marcação semântica (*header*, *main*, *footer* + 5 modais).
*   `<script>`: Lógica interativa em JS *vanilla* (aprox. 130 linhas).

**3.2 Componentes e Responsabilidades**

**Quadro 2 – Componentes da Interface**

| Componente / Elemento | Tecnologia | Função |
| :--- | :--- | :--- |
| **Header fixo** | HTML + CSS Flexbox | Logo, relógio em tempo real, botões Emergência e Início. |
| **Avatar com upload** | FileReader API (JS) | Troca de foto com pré-visualização imediata. |
| **Campo Nome Social** | Modal + input text | Edição *inline* com persistência em variável de estado. |
| **Dados Cadastrais** | Grid 2 colunas + 2 modais | Endereço (textarea) e Telefone (input com máscara). |
| **Preferências** | Pref-rows clicáveis | Rotas para modais de Senha e Sobre o App. |
| **Sistema de Modais** | CSS overlay + JS toggle | Abertura/fechamento, foco automático, ESC e clique fora. |
| **Indicador de Força** | JS puro (regex) | Avalia comprimento, maiúsculas, números e símbolos. |
| **Toast Notification** | CSS transform + JS timer | Feedback de 2,8 s para todas as ações do usuário. |
| **Máscara de Telefone** | Event listener input | Formata automaticamente para (XX) XXXXX-XXXX. |
| **Relógio** | setInterval / Date API | Atualiza hora e data a cada 10 segundos no *header*. |
| **Logo** | img src + SVG fallback | Carrega de `assets/logo-techsaude.png`; SVG se falhar. |

*Fonte: Autoria própria (2026).*

**4 ALINHAMENTO COM O DESIGN SYSTEM**

O *Design System* do TechSaúde é baseado em tons de verde escuro com fundo bege/branco, refletindo seriedade e acessibilidade. A tela de Configurações foi ajustada em três iterações para convergir com as demais telas do projeto.

**4.1 Paleta de Cores**

*   **#1A3A0A (verde-escuro):** Background do *header*, botões primários, títulos, cabeçalhos de modal.
*   **#2D6A16 (verde-médio):** *Hover* de botões, círculo do botão Início.
*   **#EDF7E4 (verde-claro):** Background de campos de input ativos, seção de perfil hero.
*   **#B0D890 (verde-borda):** Bordas de cards, separadores, inputs inativos.
*   **#F5F0E8 (bege-fundo):** Background geral do container (*app-shell*).
*   **#FFFFFF (branco):** Background de cards e campos de formulário.
*   **#374151 (cinza-texto):** Corpo de texto corrido.

**4.2 Tipografia**

*   **Família:** Calibri / *system-ui stack* (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`).
*   **Títulos de seção:** 13px · weight 900 · uppercase · letter-spacing 0.08em.
*   **Valores de campo:** 15px · weight 600 · color #1A1200.
*   **Labels:** 11px · weight 700 · uppercase · letter-spacing 0.07em · color verde-médio.
*   **Corpo:** 22px (DXA) / 14px CSS · weight 400–500 · line-height 1.6.

**4.3 Iterações de Redesign**

**Quadro 3 – Histórico de Iterações**

| Versão | Características |
| :--- | :--- |
| **Versão 1 (mobile-first)** | Container max 420 px, fundo #c8b880, bordas douradas — estilo "cartão plastificado". |
| **Versão 2 (desktop)** | Alinhado às telas de referência: container 1060 px, fundo #f5f0e8, header #1a3a0a. |
| **Versão 3 (interativo)** | Todos os campos editáveis, modais por campo, toast, máscara, força de senha, relógio. |

*Fonte: Autoria própria (2026).*

**5 LÓGICA JAVASCRIPT**

**5.1 Gerenciamento de Estado**

O estado da tela é mantido diretamente nos elementos do DOM (`textContent` dos *spans* de exibição), sem uso de objetos de estado externos. Isso foi uma escolha deliberada para manter o código simples e legível, adequado ao escopo de um protótipo acadêmico.

**5.2 Sistema de Modais**

Os modais funcionam com um padrão simples de *toggle* de classe CSS:
*   `openModal(id)`: adiciona classe `.open` ao *overlay* → `display: flex`.
*   `closeModal(id)`: remove classe `.open` → `display: none`.
*   `ovClose(e,id)`: fecha ao clicar no *overlay* (`e.target === e.currentTarget`).
*   **ESC global**: fecha qualquer modal aberto.

Ao abrir um modal, o campo de entrada recebe `focus()` automaticamente após 120 ms (aguarda a animação CSS de *popIn*).

**5.3 Validações Implementadas**

*   **Nome:** Não pode ser vazio; convertido para UPPERCASE antes de salvar.
*   **Endereço / Telefone:** Não podem ser vazios; Telefone recebe máscara em tempo real.
*   **Senha:** Senha atual obrigatória; nova senha ≥ 6 caracteres; confirmação deve ser idêntica.
*   **Upload de foto:** Aceita apenas `image/*`; lida via *FileReader API* com pré-visualização imediata.

**5.4 Indicador de Força de Senha**

O algoritmo avalia 4 critérios independentes, atribuindo 1 ponto cada:
1.  Comprimento ≥ 6 caracteres.
2.  Comprimento ≥ 10 caracteres.
3.  Contém ao menos uma letra maiúscula e um dígito.
4.  Contém ao menos um caractere especial (não alfanumérico).

*Resultados:*
*   **0–1 pontos:** "Fraca" (vermelho).
*   **2 pontos:** "Razoável" (âmbar).
*   **3–4 pontos:** "Boa" / "Forte" (verde).

**6 RESPONSIVIDADE**

Três *breakpoints* foram definidos para cobrir os dispositivos mais comuns do público-alvo:

**Quadro 4 – Breakpoints do Sistema**

| Resolução | Comportamento do Layout |
| :--- | :--- |
| **> 700 px (padrão)** | Layout de 2 colunas para Dados Cadastrais; padding 40 px lateral; max-width 1060 px. |
| **≤ 700 px (tablet/mobile)** | Dados Cadastrais em coluna única; botão Salvar em largura total; *header* compacto. |
| **≤ 480 px (mobile pequeno)** | Fonte do *header* reduzida; logo menor; padding lateral 16 px; datetime 11 px. |

*Fonte: Autoria própria (2026).*

O layout usa Flexbox no *header* e CSS Grid nos *cards* de dados e botões, garantindo alinhamento natural sem *media queries* excessivas.

**7 ACESSIBILIDADE**

*   **aria-label:** Todos os botões e controles interativos possuem *labels* descritivas.
*   **role="button":** Elementos `div` clicáveis recebem *role* e `tabindex="0"`.
*   **Teclado:** *Enter* e *Space* ativam linhas de preferência; ESC fecha modais.
*   **Foco:** Modal captura foco no primeiro campo ao abrir.
*   **Contraste:** Textos brancos sobre fundo verde-escuro (#1A3A0A) atendem WCAG AA.
*   **Imagens:** Avatar e logo possuem atributo `alt`; ícones decorativos têm `aria-hidden="true"`.

**8 DECISÕES TÉCNICAS**

**Quadro 5 – Justificativa das Decisões Técnicas**

| Decisão | Alternativa Considerada | Motivo da Escolha |
| :--- | :--- | :--- |
| **HTML/CSS/JS puro** | React / Vue.js | Zero dependência de *build*; arquivo único; mais simples para protótipo. |
| **Modais via CSS toggle** | Biblioteca `dialog` nativa | Controle total de animação e posicionamento sem *polyfills*. |
| **Logo em assets/** | SVG *inline* fixo | Permite troca fácil do logo sem tocar no código HTML/CSS. |
| **SVG inline como fallback** | Imagem *placeholder* externa | Funciona *offline*; sem requisição extra; idêntico ao padrão do projeto. |
| **FileReader API** | Upload para servidor | Protótipo local; sem *backend* disponível. |
| **Estado no DOM** | Objeto JS centralizado | Simplicidade adequada ao escopo acadêmico. |
| **Tabler Icons (CDN)** | Font Awesome / SVGs manuais | Consistência de estilo; peso leve; licença MIT. |

*Fonte: Autoria própria (2026).*

**9 PONTOS DE MELHORIA PARA PRÓXIMAS VERSÕES**

*   **Persistência:** Integrar com LocalStorage ou API REST para salvar dados entre sessões.
*   **Autenticação real:** Verificação da senha atual contra *backend* antes de permitir troca.
*   **Upload de foto:** Envio do arquivo para servidor com validação de tipo/tamanho.
*   **Validação de endereço:** Integrar API de CEP (ViaCEP) para autocompletar endereço.
*   **Máscara de telefone:** Suporte a telefones fixos (8 dígitos) além dos celulares.
*   **Testes:** Escrever testes unitários para as funções de validação (Jest).
*   **Internacionalização:** Abstrair textos para facilitar versão em outro idioma.
*   **Dark mode:** Adicionar suporte a `@media (prefers-color-scheme: dark)`.

**10 CONCLUSÃO**

A tela de Configurações da Conta foi entregue em três iterações evolutivas, passando de um *mockup mobile-first* inicial até uma interface totalmente interativa e alinhada ao *Design System* do projeto TechSaúde.

As principais decisões técnicas priorizaram simplicidade, portabilidade e zero dependências de *build*, adequadas ao escopo de um protótipo acadêmico. Todos os campos são editáveis via modal, o logo é carregado de uma pasta local com *fallback* automático, e a interface é responsiva de 320 px a *desktop*.
