# ⚡ Guia Rápido: Configurar Google Speech-to-Text

## 🎯 Objetivo

Configurar as credenciais do Google Speech-to-Text para transcrever automaticamente gravações de consultas médicas.

---

## 📝 Passo a Passo Rápido (5 minutos)

### 1️⃣ Obter Credenciais no Google Cloud

1. Acesse: https://console.cloud.google.com/
2. Vá em **IAM & Admin** > **Service Accounts**
3. Clique em **+ CREATE SERVICE ACCOUNT**
4. Nome: `pulseflow-speech`
5. Role: **Cloud Speech-to-Text API User**
6. Clique em **DONE**

### 2️⃣ Habilitar a API

1. Vá em **APIs & Services** > **Library**
2. Busque: **Cloud Speech-to-Text API**
3. Clique em **ENABLE**

### 3️⃣ Baixar Chave JSON

1. Volte para **Service Accounts**
2. Clique na conta criada
3. Aba **KEYS** > **ADD KEY** > **Create new key**
4. Formato: **JSON**
5. Clique em **CREATE** (arquivo será baixado)

### 4️⃣ Configurar no Projeto

1. Mova o arquivo JSON baixado para a pasta `server/`
2. Renomeie para `google-credentials.json`
3. Abra o arquivo `.env` em `server/` (ou raiz do projeto)
4. Adicione esta linha:

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

### 5️⃣ Verificar Configuração

Execute no terminal (na pasta `server/`):

```bash
npm run verify-speech
```

Se aparecer ✅, está configurado corretamente!

### 6️⃣ Reiniciar o Servidor

```bash
npm start
```

---

## ✅ Verificar se Funcionou

Ao gravar uma consulta, você deve ver nos logs:

```
🔑 Usando Google Speech-to-Text com arquivo de credenciais: ...
```

---

## ❓ Problemas?

### Erro: "Arquivo não encontrado"

- ✅ Verifique se o arquivo `google-credentials.json` está na pasta `server/`
- ✅ Verifique se o caminho no `.env` está correto

### Erro: "API não habilitada"

- ✅ Verifique se habilitou a Cloud Speech-to-Text API no Google Cloud Console

### Erro: "Permissão negada"

- ✅ Verifique se a conta de serviço tem a role **Cloud Speech-to-Text API User**

---

## 📚 Documentação Completa

Para mais detalhes, consulte: `INSTRUCOES_GOOGLE_SPEECH.md`

---

## 💡 Dica

Se não configurar, o sistema ainda funcionará usando o Gemini como fallback, mas a transcrição pode ser menos precisa.


