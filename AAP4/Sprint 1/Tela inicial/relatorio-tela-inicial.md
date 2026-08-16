# Tela Inicial — TechSaúde
### Adaptação responsiva: versões mobile e desktop

**Data do relatório:** 15 de agosto de 2026
**Escopo:** exclusivamente a tela inicial (boas-vindas) do protótipo TechSaúde. Este documento não aborda banco de dados ou backend.

---

## 1. Resumo

A tela inicial é o primeiro contato do usuário com o TechSaúde: ela apresenta a proposta do aplicativo e direciona para as ações de entrar ou criar conta. Nesta etapa, essa tela deixou de ter um layout único (originalmente pensado apenas como uma simulação de celular) e passou a se adaptar de forma independente para dois contextos de uso: acesso pelo celular e acesso pelo computador.

O objetivo foi garantir que a experiência fizesse sentido em cada formato, em vez de simplesmente encolher ou esticar o mesmo design — respeitando como cada tipo de tela é usado na prática.

## 2. Estrutura da Tela

A tela inicial é composta pelos seguintes elementos, presentes em ambas as versões:

- Cabeçalho com o logotipo TechSaúde (ícone em formato de coração com detalhes de circuito e rosto) e o nome do app.
- Linha de data e hora, atualizada automaticamente e exibida por extenso em português.
- Título de boas-vindas e texto de apresentação explicando o propósito do aplicativo.
- Botão "Entrar na sua conta", que leva à tela de login.
- Botão "Criar nova conta", que leva à tela de cadastro.
- Textos de apoio abaixo de cada botão, reforçando a ação de forma simples e direta.

## 3. Versão Mobile

Na versão mobile, a tela ocupa 100% da largura e altura da viewport, como um aplicativo nativo. A antiga moldura decorativa de celular (usada apenas para simular a visualização em um smartphone) foi removida, pois no próprio celular ela era redundante e ocupava espaço útil da tela.

- Layout em coluna única, com todos os elementos empilhados verticalmente.
- Botões em largura total (100%), facilitando o toque — especialmente importante para o público idoso, foco do aplicativo.
- Fonte e espaçamentos ajustados para leitura confortável em telas pequenas, sem necessidade de zoom.
- Navegação por toque, sem elementos pensados para uso com mouse (como estados de hover).

## 4. Versão Desktop

A partir de 900 pixels de largura, a tela assume um layout pensado para telas grandes, evitando o efeito de "celular esticado" no meio de uma tela de computador.

- Layout dividido em duas colunas: um painel de marca à esquerda e o card de acesso à direita.
- Painel de marca (esquerdo): logotipo em destaque, uma chamada principal sobre a proposta do app e três diferenciais do TechSaúde (lembretes de consulta, controle de medicamentos e acompanhamento simples), com fundo em gradiente verde.
- Card de acesso (direito): contém a mesma tela de boas-vindas da versão mobile, porém com largura limitada (máximo de 420 pixels), para não esticar os botões e textos de forma desproporcional.
- O conjunto todo (painel + card) fica centralizado na tela, com sombra e cantos arredondados, remetendo a uma landing page institucional.

## 5. Comparativo entre as Versões

| Aspecto | Mobile | Desktop |
|---|---|---|
| Largura do conteúdo | 100% da tela | Card fixo (máx. 420px), centralizado |
| Moldura de celular | Removida (a tela É o app) | Não se aplica |
| Painel de marca | Não exibido | Exibido à esquerda, com diferenciais do app |
| Fundo da página | Bege claro, sólido | Gradiente verde ao redor do card |
| Botões | Largura total, fáceis de tocar | Largura total dentro do card |
| Ponto de troca (breakpoint) | Até 899px de largura | A partir de 900px de largura |

## 6. Critérios de Design Considerados

- **Público-alvo idoso:** textos grandes, alto contraste entre fundo e texto, e áreas de toque generosas em ambas as versões.
- **Consistência de marca:** mesma paleta de cores (verde e creme), mesma tipografia e mesmo logotipo em mobile e desktop.
- **Uso do espaço:** em vez de apenas redimensionar o mesmo layout, cada versão foi pensada para aproveitar o espaço disponível — a versão desktop usa o espaço extra para reforçar a proposta do app, algo que não cabe (nem é necessário) no celular.
- **Transição automática:** a troca entre os dois layouts acontece sozinha, conforme a largura da tela do usuário, sem necessidade de configuração manual.

## 7. Conclusão

A tela inicial do TechSaúde agora oferece duas experiências dedicadas — uma pensada para o uso no celular, com foco em simplicidade e toque, e outra pensada para o desktop, que aproveita o espaço extra para apresentar melhor a proposta do aplicativo. Essa adaptação mantém a identidade visual original intacta e reforça a acessibilidade do produto, independentemente do dispositivo usado para acessá-lo.
