# Bot Telegram — Oryon Health

Documento interno da empresa. Não sobe no Git.

---

## O que é e como funciona

Bot no Telegram da **Oryon Health** para consultar médicos e clínicas. Usa o mesmo MongoDB do servidor.

No chat você envia nome, e-mail, telefone ou CPF e o bot busca na plataforma e na base CNES (DATASUS). Também tem menu por estado (`/estado`), clínicas (`/clinicas`) e sync da base (`/sync_cnes`, admin).

Código em `server/scripts/telegram/`.

---

## .env — credenciais da Oryon Health (como está hoje)

Colar ou conferir em `server/.env`:

```env
MONGODB_URI=mongodb+srv://pulseflow:projetointegrador@pulseflow.uesi5bb.mongodb.net/?retryWrites=true&w=majority&appName=PulseFlow
MONGO_URI=mongodb+srv://pulseflow:projetointegrador@pulseflow.uesi5bb.mongodb.net/?retryWrites=true&w=majority&appName=PulseFlow

TELEGRAM_BOT_TOKEN=8511936495:AAE1xvYp4zSf2NnxEWlefG36lYyEMqJRCt8

CONSULTA_API_BASE_URL=https://centralbrasil.shop/apis/
CONSULTA_API_KEY=sua_chave_da_api

TELEGRAM_ALLOWED_IDS=
CNES_SYNC_ADMIN_IDS=
CNES_SYNC_UFS=SP
CNES_AUTO_SYNC=if-empty
```

Isso é o que o projeto já usa. Não inventar outro token nem outro banco — é o da empresa.

`TELEGRAM_ALLOWED_IDS` e `CNES_SYNC_ADMIN_IDS` vazios = bot aberto e sync liberado para quem souber o comando. Para fechar, coloque os IDs do Telegram da equipe (pegue em @userinfobot).

---

## Passo a passo para rodar

1. Confira se o bloco acima está em `server/.env`.

2. Terminal:

```bash
cd server
npm install
```

3. Subir:

Com o servidor:
```bash
npm run dev
```

Só o bot:
```bash
npm run telegram-medicos-bot
```

4. No Telegram, abra o bot da Oryon Health e mande `/start`.

5. Se `/stats` mostrar CNES zerado:

```bash
npm run sync-medicos-cnes
```

ou no Telegram: `/sync_cnes SP`

Não rode `dev` e `telegram-medicos-bot` ao mesmo tempo.

---

## Comandos

- `/start` — início
- `/ajuda` — lista de consultas
- `/stats` — totais no banco
- `/estado` — médicos por UF e cidade
- `/clinicas` — ajuda
- `/clinicas Campinas SP` — busca clínicas
- `/nome João Silva` — busca por nome
- `/email medico@email.com` — busca por e-mail
- `/telefone 11999998888` — busca por telefone
- `/cpf 12345678901` — busca por CPF
- `/sync_cnes SP` — atualiza CNES (admin)
- `/listar 1` — lista CNES paginada
- `/exportar 1` — CSV da página
- Texto solto (nome, e-mail ou telefone) — busca automática

---

## Se der erro

- Bot não sobe → `TELEGRAM_BOT_TOKEN` ausente no `.env`
- Acesso negado → ID fora de `TELEGRAM_ALLOWED_IDS`
- Não responde / duplica → dois processos com o mesmo token
- Erro de banco → conferir `MONGODB_URI` e internet
