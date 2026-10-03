# TechSaúde — Relatório Técnico de Desenvolvimento: Assistente de Voz

**FATEC Barueri — Gestão de TI**
**Escopo:** front-end do módulo `assistente-voz.js` (reconhecimento e síntese de voz no navegador) com leitura e gravação no Supabase já utilizado pelo projeto.

---

## 1. Stack e arquitetura

Arquivo único e autocontido (`assistente-voz.js`), sem build step e sem dependências próprias. Reaproveita o mesmo sistema de design das demais telas (paleta creme/verde/teal, fonte *Trebuchet MS*) e é carregado com uma única tag `<script>` em cada página. Divisão interna:

- **JavaScript ~543 linhas (≈ 29 KB)**: vanilla JS em IIFE, 41 funções, 24 intenções de voz. Estado em memória (`aguardando`, `ouvindo`, `sb`); sem `localStorage` próprio. As seções do arquivo, na ordem:

| Seção | Responsabilidade |
|---|---|
| Utilidades | `norm()` (normalização de texto), `tem()` (busca de palavras-chave), `primeiroNome()` |
| Fala (TTS) | `falar()` com `SpeechSynthesis`, escolhe voz `pt-BR` quando disponível |
| Supabase | Cliente com carregamento tardio da biblioteca (`getSB()`), resolução do id do usuário |
| Datas e números falados | Conversão de "oito", "vinte e quatro", "duas da tarde", "8 e meia" para valores |
| Diálogo em etapas | `perguntar()` e `confirmar()` (preenchimento de campos por conversa) |
| Medicamentos / Consultas / Emergência | Funções de negócio que consultam ou gravam no banco |
| Ações disponíveis | Tabela de intenções (`INTENCOES`) e `processar()` |
| Reconhecimento de voz | `SpeechRecognition` com `pt-BR` e resultados parciais |
| Interface | Botão flutuante, painel, atalhos e campo de texto |

- **CSS ~20 regras** injetadas via `<style>` criado por JavaScript, todas prefixadas com `va-` para não colidir com o CSS das páginas.
- **HTML**: gerado dinamicamente (botão `#va-btn` e painel `#va-painel`), sem alterar a marcação existente de nenhuma tela.

### Fluxo de um comando

```
Microfone ─► SpeechRecognition (pt-BR) ─► transcrição final
                                              │
                                    norm(): minúsculas, sem acento
                                              │
                          ┌───────────────────┴───────────────────┐
                    há diálogo pendente?                    não há
                    (aguardando != null)                        │
                          │                          INTENCOES.find(quando(t))
                  handler da etapa                              │
                          └───────────────────┬───────────────────┘
                                       ação (fazer)
                      ┌──────────────┬────────┴────────┬───────────────┐
                 navegação      consulta Supabase   gravação Supabase   tel:
                                              │
                                  falar() ─► SpeechSynthesis + painel
```

---

## 2. Histórico de iterações

- **v1 — Núcleo do assistente.** Botão flutuante de microfone, painel de conversa, reconhecimento de voz em `pt-BR`, resposta falada (TTS) e intenções de navegação, hora, data, tamanho de letra, saída da conta e ajuda. A emergência já exigia confirmação por voz. Botões de atalho e campo de texto foram incluídos como alternativa ao microfone.
- **v2 — Integração com o Supabase.** Leitura dos arquivos `medicamentos.html` e `lembretedeconsultas.html` para identificar tabelas e colunas. Incluídos: próximo medicamento, medicamentos de hoje, próxima consulta, cadastro de medicamento por diálogo em etapas e ligação para o contato de emergência. A emergência passou a discar de verdade (`tel:`) usando `contato_emergencia`, com o SAMU (192) como reserva, e deixou de depender da home.
- **v3 — "Acessar função".** O verbo *acessar* (e sinônimos) passou a abrir qualquer função da home. Dizer apenas "acessar função" faz o assistente perguntar qual tela e abrir a escolhida. Calendário, Dicas e Comando de Voz receberam respostas próprias, pois ainda não têm tela.
- **v3.1 — Simplificação.** A função `medicamentosHoje()` foi reescrita com um laço direto sobre as ocorrências do dia, no lugar de uma versão inicial mais confusa e propensa a erro.

---

## 3. Interface e responsividade

O assistente é um overlay: não reorganiza o layout das páginas, então não depende dos breakpoints delas.

| Elemento | Implementação |
|---|---|
| Botão de microfone | `position: fixed`, canto inferior direito, 68×68 px, `z-index: 9998` |
| Painel de conversa | `position: fixed`, `width: min(360px, calc(100vw - 36px))`, acima do botão, `z-index: 9999` |
| Estado "ouvindo" | Botão vermelho com animação de pulso (`@keyframes vapulse`) |
| Telas estreitas (< 480 px) | O `min()` garante que o painel nunca ultrapasse a largura da tela |
| Atalhos | Chips com quebra de linha (`flex-wrap`), campo de texto com `min-width: 0` |

---

## 4. Lógica de interpretação, diálogo e dados

- **Normalização — `norm()`.** Converte para minúsculas, remove acentos (`NFD`) e pontuação. Assim "Caça-palavras", "caca palavras" e "CAÇA PALAVRAS" geram o mesmo texto.
- **Tabela de intenções — `INTENCOES`.** Lista ordenada de objetos `{ id, quando(texto), fazer(texto) }`; a **primeira que casa vence**. A ordem é decisiva: comandos específicos ("adicionar remédio", "próximo remédio") vêm antes dos genéricos ("medicamentos"), e "jogo da memória" e "caça-palavras" vêm antes de "jogos". Intenções registradas: `emergencia, sair, hora, data, fonte+, fonte-, ajuda, add-med, med-hoje, prox-med, prox-consulta, ligar, acessar-generico, calendario, dicas, voz, cacapalavras, memoria, jogos, medicamentos, consultas, config, inicio, oi`.
- **Números e horários falados.** `numerosEmDigitos()` converte "vinte e quatro" → 24, "8 e meia" → "8 30", "meio dia" → 12. `parseHora()` aceita "agora", "8 horas", "14 e 30" e "duas da tarde"; se o horário já passou no dia, assume o dia seguinte.
- **Diálogo em etapas — `perguntar()` / `confirmar()`.** `perguntar()` fala a pergunta, guarda um *handler* em `aguardando` e liga o microfone. Se o handler devolve uma `string`, ela vira uma nova pergunta (repetição em caso de resposta não entendida); se devolve `undefined`, a etapa foi aceita. "Cancelar", "deixa pra lá" e "esquece" interrompem qualquer diálogo.
- **Cálculo da próxima dose.** `proximaOcorrencia()` reproduz a lógica de `medicamentos.html`. Para alarmes **contínuos**, usa aritmética direta (`ceil((agora − início) / intervalo)`), sem gerar lista de horários. Para "por dias" e "por nº de doses", percorre apenas as ocorrências finitas.
- **Medicamentos de hoje.** `medicamentosHoje()` percorre as ocorrências do alarme até as 23:59:59 do dia e lista as que ainda não passaram (limite de 40 itens para proteger contra intervalos muito curtos).
- **Identificação do usuário.** O banco do projeto usa **tipos diferentes** de id em cada tabela, e o assistente respeita isso:

| Tabela | Coluna | Tipo | Função do assistente |
|---|---|---|---|
| `medicamentos` | `usuario_id` | texto | `idMedicamentos()` → `String(id_usuario \|\| id \|\| cpf \|\| 'offline')` |
| `consulta` | `id_usuario` | número | `idNumerico()` |
| `contato_emergencia` | `id_usuario` | valor de `usuario.id_usuario` | leitura direta |

- **Origem dos dados dos medicamentos.** Tenta o Supabase primeiro; se a consulta retornar vazia ou falhar, usa o `localStorage` (`medicamentos_<id>`), o mesmo comportamento de reserva de `medicamentos.html`.
- **Gravação de medicamento.** `salvarMedicamento()` usa `upsert` com id `alarme-<timestamp>-<aleatório>`, `duracao_tipo = 'continuo'` e `duracao_valor = null` (formato idêntico ao da tela de medicamentos).
- **Emergência.** Pede confirmação, lê `contato_emergencia`, e usa `window.location.href = 'tel:<número>'`. Se não houver contato, usa `192`.
- **Cliente Supabase com carregamento tardio.** `getSB()` reutiliza `window.supabase` quando a página já tem a biblioteca e, caso contrário, injeta o script da CDN. Isso permite usar o assistente em telas sem Supabase, como `minijogos.html`.

---

## 5. Áudio e voz

- **Reconhecimento:** `SpeechRecognition` / `webkitSpeechRecognition` com `lang = 'pt-BR'`, `interimResults = true` (a fala aparece no painel enquanto o usuário fala) e `continuous = false`. A frase é processada no evento `onend`, com o texto final acumulado.
- **Síntese:** `SpeechSynthesisUtterance` com `lang = 'pt-BR'` e `rate = 0.95` (ligeiramente mais lenta, para facilitar a compreensão). A voz `pt-BR` é escolhida assim que o navegador a disponibiliza (`onvoiceschanged`).
- **Evita eco:** o microfone só liga **depois** que a fala termina (`falar(texto, aoTerminar)`), e `speechSynthesis.cancel()` é chamado antes de qualquer nova escuta.
- **Tratamento de erros do microfone:** permissão negada, ausência de fala e falhas genéricas geram mensagens faladas distintas; navegador sem suporte orienta o uso dos atalhos ou do campo de texto.

---

## 6. Acessibilidade (WCAG-aligned)

- Botão do microfone com 68 px (alvo de toque acima de 50–56 px) e botão de fechar com 34 px.
- `aria-label` no botão do microfone, no botão de fechar e no campo de texto.
- Painel com `role="dialog"` e `aria-label`; resposta do assistente em região `aria-live="polite"`.
- `outline` visível em `:focus-visible` no botão do microfone.
- Cores reaproveitadas da paleta das telas (verde/creme), com resposta em fundo verde-claro e fala do usuário em fundo branco para distinguir os dois lados da conversa.
- Redundância de canal: tudo que é falado também aparece escrito no painel, e há alternativa por toque (chips) e por digitação.
- O comando "aumentar letra" altera o `font-size` da página (85%–150%), complementando os controles A / A+ / A++ já existentes.

---

## 7. Organização de assets e integração

Nenhum asset novo foi introduzido: sem imagens, sem arquivos de áudio e sem fontes extras. O ícone do microfone é SVG inline.

| Ação | Onde |
|---|---|
| Copiar `assistente-voz.js` | Mesma pasta dos HTMLs (`app-techsaude`) |
| Incluir `<script src="assistente-voz.js"></script>` | Antes do `</body>` de cada página |
| Ligar o card "Comando de Voz" | Primeira linha de `openFeature()` no `home.html`: `if (key === 'voz') { window.AssistenteVoz.abrir(); return; }` |
| Servir por `http://localhost` ou HTTPS | Ex.: extensão *Live Server* do VS Code (o microfone não funciona em `file://`) |

**API pública exposta:** `window.AssistenteVoz.abrir()`, `.fechar()` e `.processar(texto)`.

---

## 8. Testes executados

- **Verificação de sintaxe** (`node --check`) após cada iteração.
- **Testes automatizados em Node** das funções puras, com `window`, `document` e `localStorage` simulados:
  - **Roteamento de intenções:** 31 frases testadas contra `INTENCOES`, validando qual intenção cada uma ativa (por exemplo "acessar medicamentos" → `medicamentos`, "adicionar remédio" → `add-med`, "quando é minha próxima consulta" → `prox-consulta`, "acessar" → `acessar-generico`, "jogo da memória" → `memoria`).
  - **Números falados:** "de oito em oito horas" → 8; "a cada 12 horas" → 12; "vinte e quatro" → 24.
  - **Horários:** "agora", "8 horas", "às 14 e 30", "duas da tarde", "8 e meia da noite", "meio dia".

**Sem cobertura:** reconhecimento de voz real, síntese de voz, interface no navegador e chamadas ao Supabase, por dependerem de microfone, de sessão de login e de dados reais. Esses pontos precisam de teste manual.

---

## 9. Fora de escopo e limitações

- **Palavra de ativação ("Ei, assistente")**: não implementada; os navegadores não permitem escuta contínua em segundo plano. A ativação é por toque no botão.
- **Suporte de navegador:** reconhecimento de voz funciona em Chrome, Edge e Safari; não funciona no Firefox. O microfone exige HTTPS ou `localhost`.
- **Estado entre páginas:** o script recarrega a cada troca de tela, então diálogos em andamento são perdidos ao navegar.
- **Alarmes por voz:** o alarme é gravado no banco, mas o alerta sonoro continua dependendo de a tela de medicamentos estar aberta (limitação já existente no projeto, descrita no relatório dos alarmes).
- **Cadastro de consulta por voz:** não implementado; a tabela `consulta` tem vários campos obrigatórios e pede um diálogo próprio.
- **Duração do tratamento por voz:** o medicamento cadastrado por voz é sempre "contínuo".
- **Telas de Calendário e Dicas:** só respondem com aviso de "em desenvolvimento".
- **Políticas de acesso (RLS):** falhas de leitura ou gravação no Supabase dependem das policies das tabelas; o assistente avisa por voz e registra o erro no console.
- **Segurança:** a chave `sb_publishable_...` está no código das páginas (esperado para chave pública, desde que o RLS esteja correto).

Próximas etapas sugeridas: verificador de alarmes dentro do assistente (disparo em qualquer tela), pergunta de duração no cadastro por voz, cadastro de consulta por voz e testes de usabilidade com idosos.
