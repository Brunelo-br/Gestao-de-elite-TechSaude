# TechSaúde — Relatório Técnico de Desenvolvimento: Alarme de Medicamento

*FATEC Barueri — Gestão de TI | Escopo: front-end de alarmes.html (sem banco de dados/API)*

## 1. Stack e arquitetura

Arquivo único e autocontido (`alarmes.html`), sem build step, sem dependências de terceiros além de fontes via CDN — reaproveita o mesmo sistema de design (`:root` com variáveis de cor, tipografia Baloo 2/Nunito) criado em `login.html`. Divisão interna:

- **HTML5 ~121 linhas** — marcação semântica; dois diálogos modais (formulário de adicionar/editar alarme e pop-up de disparo), sem framework de componentes.
- **CSS3 ~583 linhas** — variáveis CSS centralizam paleta e espaçamento; layout com CSS Grid nomeado (`grid-template-areas`) para reordenar o conteúdo entre mobile e desktop sem duplicar HTML; Flexbox nos cards, no switch e nos formulários; 2 breakpoints via media query.
- **JavaScript ~708 linhas** — vanilla JS em IIFE, sem dependências externas; estado em memória (array `alarmes`), motor de cálculo de recorrência de horários, fila de alertas com Web Audio API, e verificação periódica (`setInterval`) simulando o disparo do alarme.

## 2. Histórico de iterações

- **v1** — Tela inicial com card de destaque "próximo alarme", lista de alarmes com switch liga/desliga e botão de editar, construída a partir do mockup de referência fornecido; dados de exemplo (seed) fixos em memória para validar o layout.
- **v2** — Responsividade desktop: reflow de coluna única (mobile, já aprovado) para duas colunas acima de 901px (sidebar fixa com o card de próximo alarme + grade de cards de alarmes), usando `grid-template-areas` para não alterar a ordem visual no mobile.
- **v3** — Disparo real do alarme: fila de alertas (`filaAlertas`), som gerado via Web Audio API (osciladores, sem arquivos de áudio externos), pop-up modal com as ações "Já tomei, obrigado" e "Adiar 5 minutos", e verificação periódica a cada 15s comparando os horários calculados com o relógio atual (tolerância de 3 minutos para não disparar alarmes antigos retroativamente ao reabrir a página).
- **v4** — Correções de consistência reportadas em testes manuais: a tela agora é re-renderizada imediatamente a cada mudança de estado (antes só atualizava a cada 30s); um alarme adiado ("soneca") passou a contar no cálculo do "próximo alarme" e a aparecer no card correspondente da lista, eliminando a sensação de que o alarme havia sido excluído; o desbloqueio de áudio (exigido pelos navegadores antes de tocar qualquer som) passou a ocorrer silenciosamente a qualquer interação na página, removendo um botão dedicado que atrapalhava a experiência.
- **v5** — Evolução do modelo de dados: suporte a múltiplos medicamentos por alarme (formulário dinâmico com blocos de remédio que podem ser adicionados/removidos antes de salvar) e uma terceira opção de duração, "contínua" (uso por tempo indeterminado, sem data de término), calculada analiticamente para não gerar listas de horários infinitas. A base de alarmes de exemplo foi removida — o app agora inicia vazio, pronto para o cadastro do usuário.

## 3. Responsividade

| Breakpoint | Layout | Implementação |
|---|---|---|
| > 901px | Duas colunas (sidebar fixa + grade de alarmes) | `grid-template-columns:340px 1fr` com `grid-template-areas` reorganizando sidebar/lista |
| 481–900px | Cartão único (coluna só) | `grid-template-columns:1fr`; mesma ordem visual da versão mobile aprovada |
| < 480px | Full-bleed | `border-radius` e `box-shadow` zerados; padding do `body` removido |

## 4. Lógica de agendamento e validações client-side

- **Cálculo de ocorrências** — `calcularOcorrencias()` gera a lista completa de horários para os tipos de duração com fim definido ("por dias" e "por nº de doses"). Para o tipo "contínuo", `proximaOcorrencia()` e `ocorrenciaMaisRecenteAte()` calculam o horário analiticamente (aritmética modular sobre o intervalo), sem materializar uma lista potencialmente infinita.
- **Múltiplos medicamentos por alarme** — `renderMedicamentosForm()` sincroniza um array em memória com os blocos de "nome + dose" do formulário, permitindo adicionar ou remover remédios do mesmo horário antes de salvar; o alarme salvo carrega um array `medicamentos` em vez de um remédio único.
- **Disparo do alarme** — `verificarAlarmes()` roda a cada 15s comparando as ocorrências calculadas com `Date` atual; uma fila (`filaAlertas`) evita sobreposição de pop-ups quando mais de um alarme coincide; a opção "Adiar 5 minutos" cria um evento avulso (`soneca`) sem alterar o horário da 1ª dose, o intervalo ou a duração do alarme original.
- **Áudio** — Web Audio API (osciladores senoidais, dois beeps por ciclo, repetidos a cada 4s enquanto o alerta está na tela), sem arquivos de áudio externos; o desbloqueio (exigido pela política de autoplay dos navegadores) ocorre de forma silenciosa em qualquer clique, tecla ou toque na página.
- **Validação de formulário** — campos obrigatórios (nome e dose de cada medicamento, data/hora da 1ª dose, intervalo entre 1 e 48h, valor de duração quando aplicável), com marcação inline de erro reaproveitando o padrão visual criado em `login.html`.
- **Exclusão seguro** — confirmação em duas etapas dentro do próprio botão ("Excluir este alarme" → "Confirmar exclusão?"), sem depender do `confirm()` nativo do navegador.

## 5. Acessibilidade (WCAG-aligned)

Alvo de toque mínimo de ~50–56px em botões e switch, contraste texto/fundo mantido da paleta validada em `login.html`, `aria-label` nos toggles e botões de editar/remover, `role="alertdialog"` e `aria-modal` no pop-up de disparo do alarme, `aria-live="polite"` no card de próximo alarme, outline visível em `:focus-visible` em todos os controles interativos.

## 6. Organização de assets

Reaproveita a mesma logomarca (`logo-techsaude.png`) já referenciada por caminho relativo em `login.html`, sem duplicar o binário. Nenhum asset novo foi introduzido pela funcionalidade de alarmes — ícones (sino, remédio, lápis, casa, sirene) são todos SVG inline.

## 7. Testes executados

Testes automatizados (Playwright) e verificação visual, cobrindo: renderização nos 3 breakpoints; fluxo completo de criação, edição e remoção de medicamento dentro do formulário; disparo do alarme (simulado com horário no passado recente) validando pop-up, som e ausência de erros de console; fluxo "Adiar 5 minutos" confirmando que o agendamento original não é alterado; duração contínua ocultando corretamente o campo de valor e sendo recalculada sem gerar listas de horários extensas. Sem cobertura de integração com back-end, por não estar em uso nesta fase.

## 8. Fora de escopo

Persistência em banco de dados, API de agendamento e notificações push — necessárias para o alarme funcionar com o app fechado ou o celular bloqueado — foram discutidas mas não implementadas nesta fase; o disparo atual depende da aba do navegador permanecer aberta. Essa camada será coberta em relatório próprio quando for conectada.
