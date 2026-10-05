# TechSaúde — Relatório Técnico (visão DEV): Hospitais Próximos

*FATEC Barueri — Gestão de TI | Escopo: `hospitais.html` v2 (front-end + leitura no Supabase) | 05/10/2026*

## 1. Stack e arquitetura

O arquivo é único e autocontido (`hospitais.html`, ~990 linhas), sem etapa de build. As bibliotecas vêm de CDN: **Leaflet 1.9.4** (cdnjs), **supabase-js v2** (jsdelivr) e as fontes do Google Fonts. Reaproveita o design system dos mini jogos: topbar, paleta, toast, modal de Ajuda e A/A+/A++.

- **HTML5 (~135 linhas):** painel de origem (3 modos), filtros, `#mapa`, `#lista`, modal de Ajuda e o aviso de Emergência.
- **CSS3 (~180 linhas):** grid de 1 coluna no celular e `1.35fr / 1fr` acima de 900px (mapa *sticky* e lista com rolagem própria). Pinos feitos com `L.divIcon` (gota rotacionada em -45°). Cores por tipo definidas em variáveis CSS.
- **JavaScript (~650 linhas):** vanilla JS em IIFE, com 39 funções e um único objeto `estado` (`modo`, `origem`, `raio`, `tipos`, `unidades`, `selecionada`).

## 2. Integrações externas (pipeline de dados)

| Etapa | Serviço | Chamada | Custo |
|---|---|---|---|
| Sessão | `localStorage.usuario_logado` | `lerSessao()` → `{id, cpf}` | — |
| Endereço da casa | Supabase REST | `endereco.select(...).eq('cpf_usuario').order('id',desc).limit(1).maybeSingle()` | grátis |
| Endereço → lat/lon | Geoapify Geocoding | `street`+`housenumber`+`city`+`state`+`postcode` (fallback: CEP) | 1 crédito |
| CEP avulso | ViaCEP + Geoapify | ViaCEP → geocode estruturado → fallback `text=` | 1–2 créditos |
| Unidades | Geoapify Places v2 | `categories=healthcare.hospital,healthcare.clinic_or_praxis` · `filter=circle:lon,lat,r` · `bias=proximity` · `limit=40` | 2 créditos |
| Mapa | Geoapify tiles `osm-bright` | `L.tileLayer` | 4 tiles = 1 crédito |
| Rota / ligação | Google Maps URLs / `tel:` | `maps/dir/?api=1&destination=lat,lon` | sem chave |

Todas as chamadas passam por `buscarJson()`, que converte HTTP 429 em `Error('LIMITE')` e respostas fora de 2xx em `HTTP_xxx`. As falhas sobem com códigos (`CEP_NAO_ENCONTRADO`, `SEM_COORDENADAS`, `BANCO_FALHOU`), e cada código vira uma mensagem amigável em `mostrarStatus()`.

## 3. Lógica principal

- **Normalização (`buscarUnidades`):** `feature` → `{id, nome, tipo, lat, lon, endereco, telefone, emergencia, h24, distancia}`. A distância é calculada no cliente (**Haversine**). Unidades sem nome são descartadas, e duplicatas (mesmo nome a menos de 60 m) são removidas. O resultado é ordenado por distância.
- **Classificação (`classificar`):** regex no nome, por ordem de prioridade: PS/UPA/PA/AMA → **ps**; UBS/USF/ESF/Posto → **ubs**; depois `categories` contém `healthcare.hospital` → **hospital**; o resto → **clinica**. Etiquetas extras vêm de `datasource.raw`: `emergency=yes` e `opening_hours=24/7`.
- **Renderização (`desenhar`):** uma fonte só para a lista e para o mapa, com numeração compartilhada entre pino e card. Os N=3 mais próximos ganham `bindTooltip({permanent})` (o "card flutuante"); os demais têm `bindPopup`. O zoom inicial usa `fitBounds` na casa + as 5 unidades mais próximas.
- **Sincronização (`selecionar`):** clicar no card faz `setView({animate:false})` + `openPopup()` (o autopan garante que o popup caiba na tela). Clicar no pino destaca o card.
- **Economia de créditos:** os filtros de tipo só refiltram `estado.unidades` (0 crédito); só raio e origem refazem a consulta. A casa fica em `casaCache` (chave = rua|nº|cidade|UF|CEP), que só invalida se o cadastro mudar.
- **Concorrência:** os *callbacks* assíncronos checam `estado.modo` antes de aplicar o resultado, para ignorar respostas atrasadas quando a pessoa já trocou de modo.

## 4. Segurança e acessibilidade

- **Saída da API escapada** (`escapar()`) antes de entrar no `innerHTML`, para evitar XSS a partir de dados do OpenStreetMap.
- **Chaves públicas no front-end** (Geoapify e a publishable do Supabase). ⚠️ A tabela `endereco` usa a política `ALL / public`: o login é próprio (sem Supabase Auth), então o RLS não consegue filtrar por usuário. Fica pendente para a revisão do banco.
- **Acessibilidade:** `aria-pressed` nos modos e filtros, cards com `tabindex` (Enter/Espaço), `aria-live`/`role=status`, `aria-busy` na lista, `prefers-reduced-motion`, alvos de toque de 44px ou mais, A++ sem rolagem lateral e o GPS restrito a `isSecureContext`.

## 5. Testes (Playwright + Chromium, APIs simuladas com `page.route`)

**56 asserções OK:** 27 da suíte de UI e 29 da integração com o Supabase. Os testes cobrem:

- classificação, deduplicação, ordenação e escape de HTML;
- 3 *tooltips* e 8 pinos;
- links `tel:` e do Google Maps;
- filtros sem nova consulta;
- consulta pelo CPF, com `order`/`limit`;
- geocodificação com número e cache (hit, miss e invalidação);
- os casos sem login, sem endereço, banco 500 (com e sem cache), geocodificação vazia, 429 e biblioteca do Supabase bloqueada;
- GPS permitido e negado;
- 390px e A++.

Nenhum teste teve erro de JavaScript. **Pendente:** teste com as APIs reais no navegador do grupo.
