# Relatório de erros e riscos — Portal Web Oryon Health

**Projeto:** PulseFlow-Web  
**Versão do documento:** 2.0  
**Data:** maio/2026  
**Escopo:** site institucional, portal do médico, painel administrativo e API REST (`client/` + `server/`)

**Fora do escopo:** aplicativo mobile Flutter, bot Telegram (ferramenta operacional) e detalhes de infraestrutura de hospedagem além de CORS e `API_URL`.

---

## Sobre este documento

Este relatório consolida falhas confirmadas ou prováveis identificadas por análise estática do código. Cada item possui identificador único (**B-** para backend, **U-** para interface e experiência do usuário), prioridade e orientação de correção.

### Classificação de prioridade

- **P0 — Crítico:** segurança, vazamento de dados ou indisponibilidade total de fluxos essenciais.
- **P1 — Alto:** funcionalidade principal quebrada ou experiência gravemente prejudicada.
- **P2 — Médio:** inconsistências, cenários específicos ou débito técnico com impacto moderado.
- **P3 — Baixo:** polish, branding ou melhorias desejáveis.

### Convenção de leitura

Em cada registro:

- **Localização** indica arquivos ou rotas afetadas.
- **Descrição** resume o problema técnico.
- **Sintoma** descreve o que usuário, médico ou operador percebe.
- **Impacto** explicita a consequência para o negócio ou a operação.
- **Correção sugerida** aponta direção de solução (quando aplicável).

---

## Índice

1. Resumo executivo  
2. Backend — Segurança e autorização  
3. Backend — Configuração e ambiente  
4. Backend — API e lógica de negócio  
5. Backend — Integrações  
6. Backend — Sessão, CORS e infraestrutura  
7. Interface — Navegação e fluxo  
8. Interface — Feedback e mensagens  
9. Interface — Layout, idioma e acessibilidade  
10. Interface — Infraestrutura do frontend  
11. Interface — Segurança e qualidade do código cliente  
12. Erros por tela  
13. Auditoria das rotas da API  
14. Arquivos JavaScript e validação de paciente  
15. Guia de diagnóstico por sintoma  
16. Plano de correção recomendado  
17. Histórico de revisões  

---

## 1. Resumo executivo

O portal web apresenta **aproximadamente 90 registros** catalogados: 45 no backend e 45 na camada de interface. A distribuição por criticidade concentra quatro itens P0 no backend e um P0 no frontend (duplicação da pasta `client/` em deploy).

### Riscos que exigem atenção imediata

1. **B-01** — Rotas clínicas sem validação de médico aprovado e com plano ativo.  
2. **B-02** — Rota de categorias de anotações inoperante por ordem incorreta no Express.  
3. **U-19** — Duas cópias da pasta `client/`; correções podem não chegar à produção.  
4. **B-25** — Rejeição de promise não tratada encerra o processo Node.js.  
5. **U-01** — Ausência de proteção global de rotas no frontend.

### Contagem por área e prioridade

**Backend:** 4 itens P0, 14 P1, 18 P2 e 2 P3.  
**Interface (UI/UX):** 1 item P0, 8 P1, 28 P2 e 8 P3.

---

## 2. Backend — Segurança e autorização

### B-01 — Ausência de `requireValidatedDoctor` nas rotas clínicas

**Prioridade:** P0  

**Localização:** `server/routes/diabetesRoutes.js`, `enxaquecaRoutes.js`, `pressaoArterialRoutes.js`, `batimentosCardiacosRoutes.js`, `passosRoutes.js`, `insoniaRoutes.js`, `hormonalRoutes.js`, `gastriteRoutes.js`, `cicloRoutes.js`, `menstruacaoRoutes.js`, `eventoClinicoRoutes.js`, `anotacaoRoutes.js`, `anexoExameRoutes.js` (leitura), `geminiRoutes.js`, `resumoConsultaRoutes.js` (parcial), `pacienteRoutes.js` (perfil).

**Descrição:** A maioria das rotas que expõem dados clínicos do paciente exige apenas autenticação JWT e, em alguns casos, conexão médico–paciente ativa. Não exige conta médica aprovada nem plano escolhido (`requireValidatedDoctor`).

**Sintoma:** Médico em validação ou sem plano acessa prontuário se já existir conexão ativa, enquanto a tela de busca de paciente bloqueia o acesso.

**Impacto:** Regra de negócio inconsistente; risco comercial e de compliance.

**Correção sugerida:** Aplicar `requireValidatedDoctor` em todas as rotas médicas sensíveis, com exceções explícitas para cadastro, validação e escolha de plano.

---

### B-02 — Ordem incorreta de rotas em anotações

**Prioridade:** P0  

**Localização:** `server/routes/anotacaoRoutes.js` — `GET /:cpf` declarado antes de `GET /categorias`.

**Descrição:** O Express interpreta o segmento `categorias` como valor do parâmetro `:cpf`.

**Sintoma:** Chamada a `/api/anotacoes/categorias` falha ou busca paciente inexistente com CPF `"categorias"`.

**Impacto:** Formulário de nova anotação pode ficar sem lista de categorias.

**Correção sugerida:** Declarar `GET /categorias` antes de `GET /:cpf`. Avaliar `verificarConexaoMedicoPaciente` em categorias conforme regra de produto.

---

### B-03 — Logs com dados sensíveis da Chave Oryon

**Prioridade:** P1  

**Localização:** `server/controllers/accessCodeController.js`.

**Descrição:** Logs em console incluem `patientId`, `accessCode` e dados de CPF.

**Sintoma:** Informações sensíveis aparecem em logs de produção (Render, Docker, etc.).

**Impacto:** Risco à LGPD e vazamento operacional.

**Correção sugerida:** Remover ou mascarar dados sensíveis; restringir logs detalhados ao ambiente de desenvolvimento.

---

### B-04 — Horários do médico expostos sem autenticação

**Prioridade:** P1  

**Localização:** `server/routes/horarioDisponibilidadeRoutes.js` — rotas `GET /medico/:medicoId` e `GET /disponiveis/:medicoId` antes do `authMiddleware`.

**Descrição:** Endpoints públicos listam agenda e disponibilidade por identificador do médico.

**Sintoma:** Qualquer cliente que conheça o `medicoId` consulta horários.

**Impacto:** Exposição de padrão de trabalho (pode ser intencional para agendamento pelo app).

**Correção sugerida:** Documentar como API pública de agendamento ou proteger com token de paciente/app e rate limiting.

---

### B-05 — Código HTTP incorreto para JWT inválido

**Prioridade:** P2  

**Localização:** `server/middlewares/authMiddleware.js`.

**Descrição:** Token inválido ou expirado retorna status **400** em vez de **401**.

**Sintoma:** Frontend e monitoramento classificam erro como requisição malformada.

**Impacto:** Redirecionamento para login inconsistente; métricas distorcidas.

**Correção sugerida:** Retornar `401 Unauthorized` para falhas de autenticação.

---

### B-06 — Resumo de consulta sem validar conexão ativa

**Prioridade:** P2  

**Localização:** `server/routes/resumoConsultaRoutes.js` — `GET /:id`; função `buscarResumoPorId`.

**Descrição:** Acesso ao resumo valida apenas se o documento pertence ao médico logado, não se a conexão com o paciente ainda está ativa.

**Sintoma:** Médico lê resumo de consulta após paciente revogar acesso.

**Impacto:** Dado clínico acessível fora do vínculo atual.

**Correção sugerida:** Incluir verificação em `ConexaoMedicoPaciente` com `isActive: true`.

---

### B-07 — Tradução Gemini sem contexto de paciente

**Prioridade:** P2  

**Localização:** `server/routes/geminiRoutes.js` — `POST /translate`.

**Descrição:** Endpoint autenticado sem `verificarConexaoMedicoPaciente`.

**Sintoma:** Qualquer médico logado pode traduzir textos arbitrários.

**Impacto:** Uso abusivo da API Gemini e custo desnecessário.

**Correção sugerida:** Rate limit por médico e/ou exigir contexto de sessão clínica.

---

### B-08 — Categorias de anotação sem verificar conexão

**Prioridade:** P2  

**Localização:** `server/routes/anotacaoRoutes.js` — `GET /categorias`.

**Descrição:** Rota não aplica `verificarConexaoMedicoPaciente` (além do conflito de ordem em B-02).

**Sintoma:** Comportamento indefinido após correção da ordem das rotas.

**Impacto:** Depende se categorias são globais ou por paciente.

**Correção sugerida:** Alinhar com regra de negócio e documentar.

---

### B-09 — Gastrite com padrão de middleware inconsistente

**Prioridade:** P2  

**Localização:** `server/routes/gastriteRoutes.js` — `GET`, `PUT` e `DELETE` em `/crises/:id`.

**Descrição:** Router não aplica `verificarConexaoMedicoPaciente`; controller usa `assertDoctorHasAccessToCrise`.

**Sintoma:** Inconsistência em relação a outras entidades clínicas.

**Impacto:** Risco em refatorações futuras se a validação do controller for removida.

**Correção sugerida:** Padronizar middleware no router.

---

### B-10 — Edição de perfil do paciente sem validação de conta

**Prioridade:** P1  

**Localização:** `server/routes/pacienteRoutes.js` — `PUT /perfil/:cpf`.

**Descrição:** Rota não utiliza `requireValidatedDoctor`.

**Sintoma:** Médico não totalmente validado altera dados do paciente com conexão ativa.

**Impacto:** Mesma família de risco que B-01.

**Correção sugerida:** Combinar `authMiddleware`, `requireValidatedDoctor` e verificação de conexão.

---

### B-37 — Upload de exame pelo médico sem validações completas

**Prioridade:** P1  

**Localização:** `server/routes/anexoExameRoutes.js` — `POST /medico/upload`.

**Descrição:** Apenas `authMiddleware` e upload Cloudinary; sem `requireValidatedDoctor` nem `verificarConexaoMedicoPaciente` na rota.

**Sintoma:** Comportamento depende exclusivamente do controller.

**Impacto:** Inconsistência e risco em manutenção.

**Correção sugerida:** Aplicar ambos os middlewares com `pacienteId` ou CPF no body.

---

### B-38 — Listagem de pacientes conectados sem validação de conta

**Prioridade:** P2  

**Localização:** `server/routes/pacienteRoutes.js` — `GET /`.

**Descrição:** Lista pacientes com conexão ativa para qualquer médico autenticado.

**Sintoma:** Conta não validada obtém lista de pacientes vinculados.

**Impacto:** Vazamento de metadados de pacientes.

**Correção sugerida:** Incluir `requireValidatedDoctor`.

---

### B-39 — Configuração Firebase exposta publicamente

**Prioridade:** P2  

**Localização:** `server/routes/firebaseRoutes.js` — `GET /config` e `GET /config-sw.js`.

**Descrição:** Rotas sem autenticação retornam chaves do Firebase, incluindo VAPID.

**Sintoma:** Qualquer visitante obtém configuração do projeto.

**Impacto:** Chaves de cliente Firebase são públicas por design, mas VAPID e regras mal configuradas permitem abuso de push.

**Correção sugerida:** Restringir origem, revisar regras no console Firebase e expor apenas o mínimo necessário.

---

### B-40 — Verificação de OTP sem rate limit dedicado

**Prioridade:** P2  

**Localização:** `server/app.js` — limiter em `send-otp`, ausente em `verify-otp`.

**Descrição:** Endpoint `POST /api/auth/verify-otp` pode sofrer tentativas repetidas de código 2FA.

**Sintoma:** Possível brute force do código de seis dígitos.

**Impacto:** Comprometimento de contas médicas.

**Correção sugerida:** Rate limit (ex.: cinco tentativas por dez minutos por IP e usuário).

---

### B-41 — Refresh token em rota pública

**Prioridade:** P2  

**Localização:** `server/routes/authRoutes.js` — `POST /refresh-token`.

**Descrição:** Rota aceita refresh token no body sem autenticação prévia (padrão OAuth).

**Sintoma:** Comportamento esperado para refresh, porém sensível a implementação.

**Impacto:** Depende da robustez de `tokenService.rotateRefreshSessionToken`.

**Correção sugerida:** Auditar rotação e revogação; aplicar rate limit.

---

### B-42 — CORS aceita requisições sem header Origin

**Prioridade:** P2  

**Localização:** `server/app.js` — `corsOptions`.

**Descrição:** Em produção, requisições sem `Origin` são aceitas.

**Sintoma:** Ferramentas como curl ou Postman não são bloqueadas por CORS.

**Impacto:** CORS não substitui autenticação JWT; documentar limitação.

**Correção sugerida:** Não depender de CORS como única camada de segurança.

---

### B-43 — CORS permissivo em desenvolvimento

**Prioridade:** P3  

**Localização:** `server/app.js`.

**Descrição:** Fora de produção, qualquer origem é permitida.

**Sintoma:** Ambiente local totalmente aberto.

**Impacto:** Apenas desenvolvimento; consciência necessária ao testar.

**Correção sugerida:** Manter política documentada para a equipe.

---

## 3. Backend — Configuração e ambiente

### B-11 — MongoDB não configurado

**Prioridade:** P0  

**Localização:** `server/config/db.js` — variável `MONGO_URI`.

**Descrição:** Ausência de URI impede conexão ao banco.

**Sintoma:** Erro ao iniciar ou falha em massa nas APIs.

**Impacto:** Sistema inoperante.

**Correção sugerida:** Definir `MONGO_URI` no `.env` e validar na inicialização.

---

### B-12 — JWT não configurado

**Prioridade:** P0  

**Localização:** `authMiddleware.js` e fluxos de autenticação.

**Descrição:** `JWT_SECRET` ausente ou incorreto invalida todos os tokens.

**Sintoma:** “Token inválido” após login aparentemente bem-sucedido.

**Impacto:** Nenhuma rota autenticada funciona.

**Correção sugerida:** Secret forte, único por ambiente, nunca versionado.

---

### B-13 — Chave Gemini ausente

**Prioridade:** P1  

**Localização:** `geminiController.js`, `resumoConsultaController.js`.

**Descrição:** `GEMINI_API_KEY` não definida.

**Sintoma:** Insights no perfil, perguntas à IA e resumo de consulta falham.

**Impacto:** Funcionalidades premium indisponíveis.

**Correção sugerida:** Configurar variável e mensagem clara no frontend.

---

### B-14 — Google Speech não configurado

**Prioridade:** P1  

**Localização:** `resumoConsultaController.js`.

**Descrição:** Credenciais do Google Cloud Speech ausentes.

**Sintoma:** Áudio enviado, mas transcrição e resumo não são gerados.

**Impacto:** Fluxo “Resumir consulta” inutilizável.

**Correção sugerida:** Configurar credenciais GCP e tratar erro no UI.

---

### B-15 — Armazenamento de arquivos mal configurado

**Prioridade:** P1  

**Localização:** `middlewares/cloudinaryUpload.js`, `config/uploadsRoot.js`.

**Descrição:** Cloudinary ou pasta local de uploads incorretos.

**Sintoma:** Falha em foto de perfil, exames e documentos de validação.

**Impacto:** Onboarding e prontuário incompletos.

**Correção sugerida:** Validar credenciais e permissões de escrita.

---

### B-16 — Firebase web mal configurado

**Prioridade:** P2  

**Localização:** `firebaseRoutes.js`, `client/public/js/firebaseClient.js`, `notificationService.js`.

**Descrição:** Push no navegador depende de VAPID, service worker e token FCM.

**Sintoma:** Médico não recebe notificações de solicitação de acesso.

**Impacto:** Fluxo CPF + código depende do paciente perceber o pedido no app.

**Correção sugerida:** Revisar cadeia Firebase end-to-end.

---

### B-17 — CORS bloqueando produção

**Prioridade:** P1  

**Localização:** `server/app.js` — `CORS_ORIGINS` e lista fixa de origens Render.

**Descrição:** Domínio do frontend não incluído na whitelist.

**Sintoma:** Erro “blocked by CORS policy” no console do navegador.

**Impacto:** Site carrega, mas API não responde.

**Correção sugerida:** Incluir domínio de produção em `CORS_ORIGINS`.

---

### B-18 — Dois arquivos de ambiente

**Prioridade:** P2  

**Localização:** `PulseFlow-Web/server/.env` e `PulseFlow-Web/.env`.

**Descrição:** `app.js` carrega ambos; precedência pode confundir.

**Sintoma:** Variável definida em um arquivo e ausente no outro.

**Impacto:** Comportamento diferente entre máquinas e deploy.

**Correção sugerida:** Documentar fonte única de verdade para variáveis.

---

## 4. Backend — API e lógica de negócio

### B-19 — Expiração rápida da Chave Oryon

**Prioridade:** P1  

**Localização:** `accessCodeController.js`.

**Descrição:** Código de acesso expira em aproximadamente dois minutos.

**Sintoma:** Mensagem de código inválido ou expirado na web.

**Impacto:** Fricção na consulta presencial.

**Correção sugerida:** Aumentar TTL e/ou exibir contador no app e na web.

---

### B-20 — Inconsistência de formato de CPF

**Prioridade:** P2  

**Localização:** Vários controllers e `pacienteRoutes.js`.

**Descrição:** Busca alterna entre CPF só com dígitos e CPF formatado.

**Sintoma:** “Paciente não encontrado” intermitente.

**Impacto:** Falhas em busca, relatórios e vínculo.

**Correção sugerida:** Normalizar CPF em um único utilitário no backend.

---

### B-21 — Arquivo de rotas de gastrite não utilizado

**Prioridade:** P2  

**Localização:** `server/routes/criseGastriteRoutes.js` (não montado); ativo: `gastriteRoutes.js` em `/api/gastrite`.

**Descrição:** Código morto ou duplicado gera confusão na manutenção.

**Sintoma:** Alteração no arquivo errado não reflete em produção.

**Impacto:** Perda de tempo e regressões.

**Correção sugerida:** Remover arquivo morto ou documentar alias explícito.

---

### B-22 — Duas APIs para ciclo menstrual

**Prioridade:** P2  

**Localização:** `/api/ciclo` e `/api/menstruacao`.

**Descrição:** Telas diferentes consomem endpoints distintos.

**Sintoma:** Dados divergentes entre `cicloMenstrual.html` e `historicoCicloMenstrual.html`.

**Impacto:** Inconsistência clínica na interface.

**Correção sugerida:** Unificar modelo e API.

---

### B-23 — Conexão revogada pelo paciente

**Prioridade:** P1  

**Localização:** Middlewares de conexão; `patientValidation.js` no client.

**Descrição:** API retorna `403` com `codigo: CONEXAO_INATIVA` quando vínculo é encerrado.

**Sintoma:** Dados param de carregar; mensagem de acesso revogado.

**Impacto:** Correto se tratado; nem todas as telas usam `handleApiError`.

**Correção sugerida:** Interceptor global de fetch no frontend.

---

### B-24 — Rate limit apenas em memória

**Prioridade:** P2  

**Localização:** `server/app.js` — `createMemoryRateLimit`.

**Descrição:** Contadores resetam ao reiniciar o processo e não são compartilhados entre instâncias.

**Sintoma:** Limites de login e formulários públicos inconsistentes em escala.

**Impacto:** Brute force em ambientes com múltiplas réplicas.

**Correção sugerida:** Redis ou rate limit no edge (Cloudflare, API gateway).

---

### B-25 — Processo encerrado em rejeição não tratada

**Prioridade:** P0  

**Localização:** `server/server.js` — handler `unhandledRejection`.

**Descrição:** Qualquer promise rejeitada sem catch encerra o servidor.

**Sintoma:** Queda total da API até restart.

**Impacto:** Indisponibilidade.

**Correção sugerida:** Registrar erro e manter processo ativo em produção; corrigir origem da rejeição.

---

### B-26 — Resposta 404 em JSON para páginas HTML

**Prioridade:** P2  

**Localização:** `server/app.js` — middleware final de 404.

**Descrição:** URLs de página inexistente retornam JSON de API.

**Sintoma:** Usuário vê objeto JSON no navegador.

**Impacto:** Má experiência e suporte confuso.

**Correção sugerida:** Servir página `404.html` para rotas fora de `/api`.

---

### B-27 — Plano não escolhido versus rotas clínicas

**Prioridade:** P1  

**Localização:** `requireValidatedDoctor.js` e fluxo em `selecao.js`.

**Descrição:** Bloqueio na seleção de paciente, mas rotas clínicas ainda respondem (ver B-01).

**Sintoma:** Médico sem plano acessa relatórios por URL direta.

**Impacto:** Modelo de monetização enfraquecido.

**Correção sugerida:** Middleware global pós-autenticação para área clínica.

---

### B-28 — Limite de upload de áudio em 50 MB

**Prioridade:** P2  

**Localização:** `resumoConsultaRoutes.js` — configuração Multer.

**Descrição:** Consultas longas excedem o limite.

**Sintoma:** Falha silenciosa ou erro genérico no envio.

**Impacto:** Perda da gravação da consulta.

**Correção sugerida:** Upload em partes ou limite maior com feedback no UI.

---

### B-29 — Filtro restritivo de MIME para áudio

**Prioridade:** P2  

**Localização:** `resumoConsultaRoutes.js` — `fileFilter`.

**Descrição:** Nem todos os codecs gravados pelo navegador estão na lista permitida.

**Sintoma:** Upload rejeitado apesar de gravação válida.

**Impacto:** Resumo de consulta indisponível em alguns browsers.

**Correção sugerida:** Ampliar lista ou validar por extensão.

---

### B-30 — Vulnerabilidades em dependências npm

**Prioridade:** P1  

**Localização:** `server/package.json` — `npm audit` reporta 24 vulnerabilidades (1 crítica, 12 altas).

**Descrição:** Pacote `xlsx` sem correção automática disponível.

**Sintoma:** Alertas de segurança no CI ou auditoria.

**Impacto:** Superfície de ataque conhecida no servidor.

**Correção sugerida:** `npm audit fix`, avaliar substituição de `xlsx`.

---

### B-44 — Limite de body JSON em 1 MB

**Prioridade:** P2  

**Localização:** `server/app.js` — `express.json({ limit: '1mb' })`.

**Descrição:** Payloads grandes falham na parsing.

**Sintoma:** Erro ao salvar perfil ou dados extensos em JSON.

**Impacto:** Funcionalidades específicas quebradas.

**Correção sugerida:** Limites por rota; uploads via multipart.

---

### B-45 — Geo-lock não aplicado em todas as rotas de auth

**Prioridade:** P2  

**Localização:** `authRoutes.js` — `geoLockMiddleware` apenas em register e login.

**Descrição:** Outras rotas de autenticação podem ignorar política geográfica.

**Sintoma:** Registro ou fluxos auxiliares fora da região permitida.

**Impacto:** Depende da política comercial do produto.

**Correção sugerida:** Alinhar com `registerRegionLock.js` no frontend.

---

## 5. Backend — Integrações

### B-31 — Sincronização CNES/DATASUS

**Prioridade:** P2  

**Localização:** `scripts/sync-medicos-cnes.js`, `lib/cnesDatasusSync.js`.

**Descrição:** Scripts dependem de rede, UF válida e estrutura do ZIP/CSV.

**Sintoma:** Falha em job de sincronização de médicos.

**Impacto:** Base auxiliar desatualizada (não bloqueia portal diretamente).

**Correção sugerida:** Tratamento de erro e retry documentados.

---

### B-32 — Bot Telegram

**Prioridade:** P3  

**Localização:** `scripts/telegram/telegramMedicosBot.js`.

**Descrição:** Requer `TELEGRAM_BOT_TOKEN` e MongoDB disponível.

**Sintoma:** Bot não inicia.

**Impacto:** Ferramenta operacional indisponível.

**Correção sugerida:** Documentar variáveis opcionais.

---

### B-33 — E-mail de autenticação mal configurado

**Prioridade:** P1  

**Localização:** `authController.js`, Nodemailer.

**Descrição:** SMTP ou credenciais incorretas.

**Sintoma:** Código 2FA ou link de reset não chega.

**Impacto:** Médico não consegue entrar ou recuperar senha.

**Correção sugerida:** Validar envio em staging e monitorar fila.

---

### B-34 — Twilio mal configurado

**Prioridade:** P2  

**Localização:** Dependência `twilio` no servidor.

**Descrição:** SMS só falha se a feature estiver ativa.

**Sintoma:** OTP ou notificação por SMS não entrega.

**Impacto:** Depende do desenho do produto.

**Correção sugerida:** Feature flag e fallback por e-mail.

---

## 6. Backend — Sessão, CORS e infraestrutura

### B-35 — Token de paciente no browser não é JWT

**Prioridade:** P2  

**Localização:** `client/public/js/selecao.js` — `btoa(JSON.stringify({ cpf }))`.

**Descrição:** `tokenPaciente` no `localStorage` é apenas flag local, não credencial de API.

**Sintoma:** Frontend acredita ter “sessão de paciente” localmente.

**Impacto:** Segurança real depende do JWT do médico e validação no servidor.

**Correção sugerida:** Não confiar em `tokenPaciente` para autorização; apenas UX.

---

### B-36 — Estado do paciente apenas em localStorage

**Prioridade:** P2  

**Localização:** Chaves `pacienteSelecionado`, `tokenPaciente`, `cpfSelecionado`.

**Descrição:** Não há persistência server-side da seleção de paciente na sessão web.

**Sintoma:** Nova aba, limpeza de cache ou outro dispositivo perde contexto.

**Impacto:** Médico precisa buscar paciente novamente.

**Correção sugerida:** Opcional: endpoint de sessão ativa; mínimo: aviso ao perder estado.

---

## 7. Interface — Navegação e fluxo

### U-01 — Ausência de guardião global de rotas

**Prioridade:** P1  

**Localização:** Todas as views em `client/views/`.

**Descrição:** Cada página implementa checagem de login e paciente de forma isolada.

**Sintoma:** URL direta abre tela sem login ou sem paciente selecionado.

**Impacto:** Erros vazios, 403 em cascata, confusão.

**Correção sugerida:** Módulos `authGuard.js` e `patientGuard.js` importados em todas as páginas autenticadas.

---

### U-02 — Telas de detalhe sem validação de paciente ativo

**Prioridade:** P1  

**Localização:** `vizualizarAnotacao.js`, `vizualizacaoEventoClinico.js`, `visualizacaoCriseGastrite.js`.

**Descrição:** Páginas abrem com parâmetro `?id=` sem chamar `validateActivePatient()`.

**Sintoma:** Detalhe carrega ou falha sem contexto de paciente.

**Impacto:** Dados incorretos ou erro opaco.

**Correção sugerida:** Validar no `DOMContentLoaded` e redirecionar para `selecao.html`.

---

### U-03 — Histórico de ciclo menstrual falha em silêncio

**Prioridade:** P1  

**Localização:** `historicoCicloMenstrual.js`.

**Descrição:** Se não há `pacienteSelecionado`, o script retorna sem mensagem.

**Sintoma:** Página em branco.

**Impacto:** Percepção de sistema quebrado.

**Correção sugerida:** Usar `redirectToPatientSelection()`.

---

### U-04 — Ciclo e menstruação com race condition

**Prioridade:** P1  

**Localização:** `menstruacao.js`, `cicloMenstrual.js` — `setTimeout(500)`.

**Descrição:** Espera fixa pela sidebar em vez de `await initApp()`.

**Sintoma:** Dados ou menu não aparecem na primeira carga.

**Impacto:** Comportamento intermitente (flaky).

**Correção sugerida:** Inicialização assíncrona ordenada; remover timeout arbitrário.

---

### U-05 — Menu lateral extenso com paciente ativo

**Prioridade:** P2  

**Localização:** `components/sidebar.js`.

**Descrição:** Muitos itens em `patientMainLinks` e `patientReportLinks`.

**Sintoma:** Scroll longo e dificuldade de localizar função.

**Impacto:** Sobrecarga cognitiva.

**Correção sugerida:** Agrupar em submenus ou atalhos configuráveis.

---

### U-06 — Fluxo de acesso em dois passos (CPF e código)

**Prioridade:** P2  

**Localização:** `selecao.html`, `selecao.js`.

**Descrição:** Médico informa CPF, depois código de seis dígitos gerado no app.

**Sintoma:** Médico não entende que o paciente deve abrir o app.

**Impacto:** Abandono do fluxo e chamados de suporte.

**Correção sugerida:** Wizard com status “aguardando paciente” e instruções visíveis.

---

### U-07 — Redirecionamento de conta incompleto

**Prioridade:** P2  

**Localização:** `selecao.js` redireciona; outras telas não.

**Descrição:** Links diretos para dashboard ignoram validação de conta e plano.

**Sintoma:** Dados parciais ou erros de API em contas não aprovadas.

**Impacto:** Experiência inconsistente.

**Correção sugerida:** Função `ensureProfile()` global após login.

---

### U-08 — Marca inconsistente na interface

**Prioridade:** P3  

**Localização:** `index.html`, strings “PulseFlow” em `sidebar.js` e i18n.

**Descrição:** Mistura Oryon Health e PulseFlow.

**Sintoma:** Usuário vê nomes diferentes do produto.

**Impacto:** Confiança de marca reduzida.

**Correção sugerida:** Padronizar nomenclatura em todos os artefatos.

---

### U-23 — Crise de gastrite com validação manual

**Prioridade:** P2  

**Localização:** `criseGastrite.js`.

**Descrição:** Verifica paciente com `throw` em vez do helper central.

**Sintoma:** Mensagem de erro diferente das demais telas.

**Impacto:** UX inconsistente.

**Correção sugerida:** Adotar `validateActivePatient()`.

---

### U-24 — Páginas sem `initApp` padronizado

**Prioridade:** P2  

**Localização:** Grande parte das 58 views HTML.

**Descrição:** Muitas páginas usam scripts inline em vez de `initApp` para header, sidebar e i18n.

**Sintoma:** Tradução parcial; sidebar desatualizada.

**Impacto:** Experiência desigual entre telas.

**Correção sugerida:** Padronizar `initApp` em todas as views logadas.

---

### U-25 — Módulo de agendamentos monolítico

**Prioridade:** P2  

**Localização:** `agendamentos.js` (aproximadamente duas mil linhas).

**Descrição:** Arquivo único concentra filtros, lista e ações.

**Sintoma:** Dificuldade de manutenção e regressões frequentes.

**Impacto:** Custo alto de evolução.

**Correção sugerida:** Dividir em módulos por responsabilidade.

---

## 8. Interface — Feedback e mensagens

### U-09 — Uso de `alert()` nativo

**Prioridade:** P2  

**Localização:** `connectionMonitor.js`, `patientValidation.js`, `perfilPaciente.js`, `criseGastrite.js`, `agendamento_novo.js`, `RegistroDoEventoClinico.js`.

**Descrição:** Diálogos nativos do browser em vez de componente da aplicação.

**Sintoma:** Pop-up bloqueante e visual datado.

**Impacto:** Acessibilidade e percepção de qualidade reduzidas.

**Correção sugerida:** Padronizar SweetAlert2 ou toasts.

---

### U-10 — Múltiplos padrões de feedback

**Prioridade:** P2  

**Localização:** SweetAlert2, `alert()`, toasts (`mostrarAviso`).

**Descrição:** Três estilos coexistem no mesmo produto.

**Sintoma:** Tom e visual inconsistentes.

**Impacto:** Produto parece fragmentado.

**Correção sugerida:** Design system único para mensagens.

---

### U-11 — Erros visíveis apenas no console

**Prioridade:** P2  

**Localização:** Bloco `loadDoctorInfo()` repetido em dezenas de arquivos HTML.

**Descrição:** Falha ao carregar médico não gera mensagem na tela.

**Sintoma:** Interface parcialmente vazia sem explicação.

**Impacto:** Aumento de suporte.

**Correção sugerida:** Componente único de carregamento e erro.

---

### U-12 — Mensagens técnicas ao usuário final

**Prioridade:** P2  

**Localização:** `perfilMedico.js` — “Servidor retornou HTML em vez de JSON”.

**Descrição:** Erros de desenvolvimento expostos ao médico.

**Sintoma:** Perda de confiança na plataforma.

**Impacto:** Abandono do fluxo de cadastro ou upload.

**Correção sugerida:** Mapear erros para mensagens amigáveis.

---

### U-13 — Sem indicação de expiração do código de acesso

**Prioridade:** P2  

**Localização:** `selecao.js`.

**Descrição:** Web não mostra que o código expira em cerca de dois minutos.

**Sintoma:** Médico tenta código antigo repetidamente.

**Impacto:** Frustração na sala de consulta.

**Correção sugerida:** Texto de ajuda e, se possível, contador sincronizado com o app.

---

### U-26 — Falha ao notificar paciente tratada em silêncio

**Prioridade:** P2  

**Localização:** `selecao.js` — `enviarNotificacaoPaciente`, bloco `catch` apenas com log.

**Descrição:** Após CPF válido, push ao paciente pode falhar sem aviso na UI.

**Sintoma:** Médico aguarda código que o paciente não foi alertado a gerar.

**Impacto:** Fluxo de acesso travado.

**Correção sugerida:** Aviso explícito: “Peça ao paciente para abrir o app e gerar o código”.

---

### U-27 — Verificação 2FA dependente de localStorage

**Prioridade:** P1  

**Localização:** `verify-2fa.js` — chaves `userId` e `email`.

**Descrição:** Recarregar a página perde contexto do fluxo de login.

**Sintoma:** Impossível concluir 2FA após refresh.

**Impacto:** Médico preso no login.

**Correção sugerida:** `sessionStorage` ou fluxo server-side de sessão temporária.

---

## 9. Interface — Layout, idioma e acessibilidade

### U-14 — Nomes de arquivo com erro ortográfico

**Prioridade:** P3  

**Localização:** `vizualizacaoEventoClinico.*`, `vizualizacaoAnotacao.*`, `vizualizarAnotacao.js`, `criarAnotações.html`.

**Descrição:** “Visualização” grafada como “vizualizacao”; acento no nome do arquivo HTML.

**Sintoma:** URLs não profissionais; risco em servidores restritivos.

**Impacto:** SEO e manutenção.

**Correção sugerida:** Renomear com redirects se necessário.

---

### U-15 — Internacionalização incompleta

**Prioridade:** P2  

**Localização:** `i18n.js`, `locales/*.json`, diversos JS com `tx(pt, en)` hardcoded.

**Descrição:** Mistura de `data-i18n`, função `t()` e strings fixas.

**Sintoma:** Metade da interface em português e metade em inglês ao trocar idioma.

**Impacto:** Produto internacional incompleto.

**Correção sugerida:** Auditoria de strings e cobertura em JSON.

---

### U-16 — Tema escuro inconsistente

**Prioridade:** P2  

**Localização:** `dark-theme.css`, gráficos Chart.js em `dashboardMedico.js`.

**Descrição:** Nem todos os componentes adaptam cores no modo escuro.

**Sintoma:** Gráficos ilegíveis ou com baixo contraste.

**Impacto:** Acessibilidade visual prejudicada.

**Correção sugerida:** Tokens de cor compartilhados para charts.

---

### U-17 — Estados vazios sem orientação

**Prioridade:** P2  

**Localização:** Relatórios: `diabetes.js`, `pressaoArterial.js`, `enxaqueca.js`, etc.

**Descrição:** Gráficos e listas vazios sem empty state explicativo.

**Sintoma:** Tela vazia sem texto.

**Impacto:** Médico não sabe se é bug ou falta de dado do paciente no app.

**Correção sugerida:** Mensagem: “O paciente ainda não registrou dados no aplicativo”.

---

### U-18 — Duplicação de código entre páginas HTML

**Prioridade:** P2  

**Localização:** Dezenas de arquivos em `client/views/`.

**Descrição:** Mesmo script `loadDoctorInfo` copiado em múltiplas páginas.

**Sintoma:** Correção em um arquivo não replica nos outros.

**Impacto:** Débito técnico elevado.

**Correção sugerida:** Componentes compartilhados e build de templates.

---

### U-28 — Nome de script divergente do título da página

**Prioridade:** P3  

**Localização:** `historicoProntuario.html` carrega `historicoAnotacao.js`.

**Descrição:** Título “Registro clínico” usa script de histórico de anotações.

**Sintoma:** Confusão para desenvolvedores.

**Impacto:** Manutenção mais lenta.

**Correção sugerida:** Alinhar nomes ou documentar equivalência.

---

### U-29 — Responsividade limitada

**Prioridade:** P2  

**Localização:** Várias views com sidebar fixa e tabelas largas.

**Descrição:** Layout pensado principalmente para desktop.

**Sintoma:** Conteúdo cortado em tablet ou celular.

**Impacto:** Uso em dispositivos móveis prejudicado.

**Correção sugerida:** Revisão mobile-first nas telas clínicas principais.

---

## 10. Interface — Infraestrutura do frontend

### U-19 — Duas pastas `client/` (crítico para deploy)

**Prioridade:** P0  

**Localização:** `PulseFlow-Web/client/` e `PulseFlow-Web/server/client/` — cópia via `scripts/copy-client.js` no `postinstall`.

**Descrição:** Servidor Express serve `server/client/`; desenvolvedor pode editar apenas `client/`.

**Sintoma:** Correção não aparece em produção após deploy.

**Impacto:** Horas de retrabalho e perda de confiança no processo.

**Correção sugerida:** Uma única fonte; cópia apenas no pipeline de CI; nunca editar `server/client` manualmente.

---

### U-20 — URL da API derivada do hostname

**Prioridade:** P1  

**Localização:** `client/public/js/config.js`.

**Descrição:** `API_URL` assume mesmo host do frontend, exceto localhost:65432.

**Sintoma:** API em subdomínio diferente quebra todas as chamadas.

**Impacto:** Site inutilizável em produção.

**Correção sugerida:** Injetar `window.API_URL` no build ou variável de ambiente no HTML.

---

### U-21 — Mistura de módulos ES e scripts inline

**Prioridade:** P2  

**Localização:** Views com `<script type="module">` e blocos inline.

**Descrição:** Ordem de execução imprevisível.

**Sintoma:** Bugs intermitentes de header ou tradução.

**Impacto:** Qualidade instável.

**Correção sugerida:** Um único ponto de entrada por página.

---

### U-22 — Ausência de testes end-to-end

**Prioridade:** P2  

**Localização:** Projeto web (sem suíte E2E configurada).

**Descrição:** Fluxos críticos dependem de teste manual.

**Sintoma:** Regressões em login, seleção de paciente e relatórios.

**Impacto:** Custo de QA cresce com o produto.

**Correção sugerida:** Playwright ou Cypress nos fluxos P0.

---

### U-30 — Script de manutenção na página inicial

**Prioridade:** P3  

**Localização:** `client/views/index.html` importa `updateAllFiles.js`.

**Descrição:** Script de desenvolvimento exposto na landing.

**Sintoma:** Comportamento indefinido em produção.

**Impacto:** Ruído e possível efeito colateral.

**Correção sugerida:** Remover da build de produção.

---

### U-31 — Documentação README desatualizada

**Prioridade:** P3  

**Localização:** `PulseFlow-Web/README.md`.

**Descrição:** Instruções genéricas e pasta incorreta para `npm run dev`.

**Sintoma:** Novo desenvolvedor não sobe o ambiente.

**Impacto:** Onboarding lento.

**Correção sugerida:** Atualizar README com passos exatos (`server/`, porta 65432).

---

## 11. Interface — Segurança e qualidade do código cliente

### U-32 — Uso extensivo de `innerHTML`

**Prioridade:** P2  

**Localização:** `perfilPaciente.js`, `agendamentos.js`, módulos `admin-*.js`, `vizualizarAnotacao.js`, entre outros.

**Descrição:** Conteúdo da API inserido via `innerHTML` sem sanitização explícita.

**Sintoma:** Risco de XSS se backend retornar HTML malicioso.

**Impacto:** Segurança comprometida.

**Correção sugerida:** `textContent`, sanitização ou DOMPurify.

---

### U-33 — Impressão via `document.write`

**Prioridade:** P2  

**Localização:** `vizualizacaoEventoClinico.js`.

**Descrição:** Pop-up de impressão pode ser bloqueado pelo browser.

**Sintoma:** Botão imprimir não funciona em alguns ambientes.

**Impacto:** Funcionalidade de exportação prejudicada.

**Correção sugerida:** CSS `@media print` ou biblioteca de PDF consistente.

---

### U-34 — Gravação em background dessincronizada

**Prioridade:** P2  

**Localização:** `gravarConsulta.js`, `recordingBackground.js`.

**Descrição:** Navegar para outra página durante gravação pode perder áudio.

**Sintoma:** Envio sem áudio ou gravação truncada.

**Impacto:** Consulta sem resumo automático.

**Correção sugerida:** Aviso de gravação ativa e bloqueio de navegação.

---

### U-35 — Monitor de conexão a cada cinco segundos

**Prioridade:** P2  

**Localização:** `connectionMonitor.js`.

**Descrição:** Polling contínuo em `GET /api/pacientes/verificar-conexao/:cpf`.

**Sintoma:** Tráfego repetido enquanto médico permanece na área do paciente.

**Impacto:** Carga no servidor e consumo de bateria.

**Correção sugerida:** Intervalo maior ou verificação apenas com janela em foco.

---

### U-36 — Exportação PDF dependente de CDN

**Prioridade:** P2  

**Localização:** `vizualizarAnotacao.js` — jsPDF.

**Descrição:** Biblioteca carregada externamente.

**Sintoma:** “Biblioteca jsPDF não carregada” offline ou com CDN bloqueado.

**Impacto:** Exportação PDF indisponível.

**Correção sugerida:** Bundlar jsPDF no projeto.

---

### U-37 — Blocos `catch` vazios ocultam falhas

**Prioridade:** P2  

**Localização:** `register.js`, `registerRegionLock.js`, `sidebar.js` (`catch(() => {})`).

**Descrição:** Erros de geo-lock ou sidebar ignorados.

**Sintoma:** Comportamento errado sem mensagem.

**Impacto:** Diagnóstico difícil.

**Correção sugerida:** Log mínimo e fallback visível.

---

## 12. Erros por tela

### 12.1 Área pública e institucional

**homePage.html**  
Links quebrados; tradução parcial; imagens externas (Unsplash) podem degradar performance.

**login.html**  
Credenciais inválidas; ausência de feedback visual de rate limit; “lembrar e-mail” sem impacto em token (referências B-12, U-01).

**register.html**  
Formulário longo em múltiplas etapas; falha de CEP (ViaCEP); validação CRM/NPI; geo-lock; timeout de API (B-33, U-37).

**verify-2fa.html**  
Código incorreto; perda de `userId` ao recarregar página (U-27, B-40).

**reset-password.html e reset-password-form.html**  
E-mail não enviado; token de reset inválido ou expirado (B-33).

**contato.html**  
Rate limit 429 (B-24); falha no envio do formulário.

**faq.html, termos.html, privacidade.html, sobreNos.html, seguranca.html**  
Conteúdo estático; versões em inglês em arquivos separados (`*-us.html`).

---

### 12.2 Área do médico (sem paciente selecionado)

**selecao.html**  
Ausência de token; conta não aprovada; plano não escolhido; CPF inexistente; código expirado (B-19); falha silenciosa na notificação push (U-26).

**dashboardMedico.html**  
Token ausente; gráficos vazios; informações de plano incorretas.

**perfilMedico.html**  
Falha no upload de foto; resposta HTML em vez de JSON (U-12); travamento no envio de documentos de validação.

**planosPagamento.html, escolhaPlano.html, checkoutPlano.html**  
Pagamento não atualiza `hasChosenPlan` no perfil (B-27).

**agendamentos.html, agendamento_novo.html, agendamento_detalhes.html**  
Lista vazia; filtros complexos; conflito de horário; token ausente (U-25).

**horariosDisponibilidade.html**  
Nenhum slot configurado; exposição pública da agenda (B-04).

**notificacoes.html**  
Firebase não configurado (B-16); lista vazia.

**configuracoes.html**  
Falha ao alterar senha; exclusão de conta.

---

### 12.3 Área do médico (com paciente selecionado)

**perfilPaciente.html**  
Insights Gemini indisponíveis (B-13); lista vazia; edição retorna 403; atalhos sem dados (U-17).

**diabetes.html, pressaoArterial.html, enxaqueca.html, insonia.html, hormonal.html**  
Sem dados do app; erro 403 por conexão revogada (B-23); gráfico não renderiza.

**batimentosCardiacos.html, contagemPassos.html**  
Dados dependem de wearable via app mobile.

**historicoCriseGastrite.html, visualizacaoCriseGastrite.html**  
API `/api/gastrite`; detalhe sem `validateActivePatient` (U-02).

**cicloMenstrual.html, historicoCicloMenstrual.html**  
APIs diferentes (B-22); histórico em silêncio sem paciente (U-03).

**menstruacao.html**  
Race condition de inicialização (U-04).

**anexoExame.html**  
Limite de 10 MB; tipos MIME; preview ou download 403.

**historicoEventoClinico.html, vizualizacaoEventoClinico.html**  
Detalhe sem guardião de paciente (U-02).

**RegistroDoEventoClinico.html, criarAnotações.html**  
Categorias inoperantes (B-02).

**historicoProntuario.html, vizualizarAnotacao.html**  
Prontuário equivale a anotações; detalhe sem validação padronizada.

**gravarConsulta.html**  
Permissão de microfone negada; áudio acima de 50 MB (B-28); Speech/Gemini indisponíveis (B-13, B-14); perda de áudio ao trocar de página (U-34).

**historicoResumos.html**  
Lista vazia; resumo acessível sem conexão ativa no backend (B-06).

---

### 12.4 Painel administrativo

**painel-admin.html, admin-medico-detalhe.html**  
Acesso negado se usuário não for admin (B-12); fluxos de aprovar ou negar médico.

**painel-usuarios.html, admin-usuario-detalhe.html**  
Exclusão de usuários; erros de permissão.

**admin-dashboard.html, admin-financeiro.html, admin-newsletter.html, admin-contatos.html, admin-audit.html, admin-planos.html**  
Dependência das APIs admin; exportação CSV; paginação em listas grandes.

---

## 13. Auditoria das rotas da API

Resumo da postura de segurança por prefixo (maio/2026).

**`/api/auth`** — Login com rate limit; reset e send-otp limitados; `verify-otp` sem limit dedicado (B-40); refresh token público (B-41).

**`/api/usuarios`** — Autenticação médica; validação de conta parcial conforme rota; perfil, documentos, plano e pagamento.

**`/api/pacientes/buscar` e `/buscar-com-codigo`** — Proteção adequada com `requireValidatedDoctor`.

**`/api/pacientes/perfil` e `/id`** — Conexão ativa verificada; falta `requireValidatedDoctor` (B-01, B-10).

**`/api/pacientes/` (GET lista)** — Autenticado; sem validação de conta completa (B-38).

**`/api/access-code`** — Fluxo misto paciente/médico; logs sensíveis (B-03).

**`/api/diabetes`, `/enxaqueca`, `/pressao`, etc. (GET médico)** — JWT + conexão paciente; sem exigência de plano (B-01).

**`/api/anotacoes`** — Ordem de rotas incorreta (B-02); categorias sem conexão (B-08).

**`/api/anexoExame/medico/upload`** — Lacunas B-37.

**`/api/gastrite`** — Padrão misto router/controller (B-09).

**`/api/gemini`** — Insights com conexão; translate sem vínculo (B-07).

**`/api/resumo-consulta`** — Upload com conexão; GET por id sem conexão ativa (B-06).

**`/api/agendamentos`** — `requireValidatedDoctor` aplicado.

**`/api/horarios-disponibilidade/medico` e `/disponiveis`** — Públicos (B-04).

**`/api/firebase/config`** — Público (B-39).

**`/api/admin`** — `authMiddleware` + `requireAdmin`.

**`/api/contact` e `/api/newsletter`** — Públicos com rate limit.

---

## 14. Arquivos JavaScript e validação de paciente

### Arquivos que devem passar a usar `validateActivePatient()` (prioridade alta)

- `vizualizarAnotacao.js`
- `vizualizacaoEventoClinico.js`
- `visualizacaoCriseGastrite.js`
- `historicoCicloMenstrual.js`
- `menstruacao.js`
- `cicloMenstrual.js`
- `criseGastrite.js` (substituir checagem manual)

### Arquivos que já utilizam o padrão correto (referência)

- `perfilPaciente.js`
- `diabetes.js`, `pressaoArterial.js`, `enxaqueca.js`, `insonia.js`, `hormonal.js`
- `contagemPassos.js`, `batimentosCardiacos.js`
- `anexoExame.js`, `gravarConsulta.js`
- `historicoResumos.js`, `historicoEventoClinico.js`, `historicoCriseGastrite.js`
- `historicoAnotacao.js`, `criarAnotacao.js`, `RegistroDoEventoClinico.js`

### Arquivos da área médica que não exigem paciente ativo

- `selecao.js`, `dashboardMedico.js`, `agendamentos.js`, `perfilMedico.js`, `configuracoes.js`
- Módulos `admin-*.js`

---

## 15. Guia de diagnóstico por sintoma

Quando o usuário relatar um problema, correlacionar com as causas abaixo.

**“Token inválido” em todas as requisições**  
Verificar `JWT_SECRET` e solicitar novo login (B-12).

**Página exibe JSON no navegador**  
URL incorreta ou rota de API em vez de HTML (B-26).

**“Conexão inativa” ou HTTP 403**  
Paciente desconectou o médico no app; limpar `pacienteSelecionado` no localStorage (B-23).

**Código de acesso não funciona**  
Código expirado (~2 minutos) ou novo código gerado no app (B-19).

**Página clínica completamente vazia**  
Ausência de `pacienteSelecionado` no localStorage (U-02, U-03).

**Gráfico ou relatório vazio**  
Paciente não registrou dados no aplicativo mobile (U-17).

**IA ou resumo de consulta não funciona**  
`GEMINI_API_KEY` e Google Speech (B-13, B-14).

**Alteração no JavaScript não aparece após deploy**  
Edição feita em `client/` mas produção serve `server/client/` (U-19).

**Lista de categorias de anotação vazia**  
Bug de ordem de rotas B-02.

**Erro de CORS no console**  
Incluir domínio em `CORS_ORIGINS` (B-17).

**Servidor parou de responder**  
Investigar `unhandledRejection` nos logs (B-25).

---

## 16. Plano de correção recomendado

### Fase 1 — Crítico (estabilidade e segurança imediata)

- Corrigir ordem das rotas em `anotacaoRoutes.js` (B-02, B-08).
- Evitar `process.exit` em `unhandledRejection` sem política clara (B-25).
- Unificar pasta `client/` e documentar pipeline de deploy (U-19).

### Fase 2 — Segurança e regras de negócio

- Aplicar `requireValidatedDoctor` nas rotas clínicas e perfil de paciente (B-01, B-10, B-27, B-37).
- Remover logs sensíveis (B-03).
- Retornar HTTP 401 para JWT inválido (B-05).
- Rate limit em `verify-otp` (B-40).

### Fase 3 — Experiência de fluxo no frontend

- Guardiões globais de autenticação e paciente (U-01, U-02, U-03, U-04, U-27).
- `validateActivePatient()` em todos os scripts da área clínica (seção 14).

### Fase 4 — Configuração e ambiente

- Documentar e validar `.env` (B-11 a B-18).
- `API_URL` explícita no build (U-20).

### Fase 5 — Qualidade e polish

- Padronizar feedback (U-09, U-10).
- Completar i18n (U-15).
- Atualizar dependências npm (B-30).

---

## 17. Histórico de revisões

- **maio/2026 — v1.0:** Versão inicial em listas.  
- **maio/2026 — v1.1:** Expansão com itens B-37 a B-45 e U-23 a U-37; auditoria de rotas e apêndices.  
- **maio/2026 — v2.0:** Reorganização profissional sem tabelas; estrutura uniforme por item; texto contínuo nas seções por tela e diagnóstico.

---

*Documento mantido pela equipe Oryon Health / PulseFlow. Para sugestões ou novos itens, abrir issue com ID sequencial (B-46+, U-38+).*
