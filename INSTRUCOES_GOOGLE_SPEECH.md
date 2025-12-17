# 🎙️ Guia Completo: Configurar Google Speech-to-Text API

Este guia explica como configurar as credenciais do Google Speech-to-Text para que o sistema possa transcrever automaticamente as gravações de consultas médicas.

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Passo 1: Criar ou encontrar uma Conta de Serviço](#passo-1-criar-ou-encontrar-uma-conta-de-serviço)
3. [Passo 2: Habilitar a API Speech-to-Text](#passo-2-habilitar-a-api-speech-to-text)
4. [Passo 3: Baixar o Arquivo JSON de Credenciais](#passo-3-baixar-o-arquivo-json-de-credenciais)
5. [Passo 4: Configurar no Projeto](#passo-4-configurar-no-projeto)
6. [Passo 5: Verificar a Configuração](#passo-5-verificar-a-configuração)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Pré-requisitos

- Conta Google Cloud Platform (GCP) ativa
- Projeto criado no Google Cloud Console
- Acesso ao Google Cloud Console com permissões de administrador

---

## 🚀 Passo 1: Criar ou encontrar uma Conta de Serviço

### 1.1 Acessar o Google Cloud Console

1. Acesse: [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Selecione seu projeto (ou crie um novo)

### 1.2 Navegar até Service Accounts

1. No menu lateral, vá em **IAM & Admin** (ou **IAM e administração**)
2. Clique em **Service Accounts** (ou **Contas de serviço**)

### 1.3 Criar uma nova Conta de Serviço (se necessário)

Se você já tem uma conta de serviço, pule para o Passo 3.

1. Clique no botão **+ CREATE SERVICE ACCOUNT** (ou **+ CRIAR CONTA DE SERVIÇO**)
2. Preencha:
   - **Service account name**: `pulseflow-speech-to-text` (ou outro nome de sua preferência)
   - **Service account ID**: será gerado automaticamente
   - Clique em **CREATE AND CONTINUE** (ou **CRIAR E CONTINUAR**)
3. Em **Grant this service account access to project**:
   - Role: Selecione **Cloud Speech-to-Text API User** ou **Editor**
   - Clique em **CONTINUE**
4. Clique em **DONE** (ou **CONCLUIR**)

---

## 🔧 Passo 2: Habilitar a API Speech-to-Text

1. No menu do Google Cloud Console, vá em **APIs & Services** > **Library** (ou **APIs e Serviços** > **Biblioteca**)
2. Busque por: **Cloud Speech-to-Text API**
3. Clique no resultado
4. Clique em **ENABLE** (ou **ATIVAR**)
5. Aguarde a ativação (pode levar alguns segundos)

**✅ Verificação**: Se o botão mostrar "MANAGE" ao invés de "ENABLE", a API já está habilitada.

---

## 📥 Passo 3: Baixar o Arquivo JSON de Credenciais

### 3.1 Localizar a Conta de Serviço

1. Volte para **IAM & Admin** > **Service Accounts**
2. Encontre a conta de serviço que você criou (ou use uma existente)
3. Clique no e-mail da conta de serviço

### 3.2 Criar e Baixar a Chave JSON

1. Vá na aba **KEYS** (ou **CHAVES**)
2. Clique em **ADD KEY** > **Create new key** (ou **ADICIONAR CHAVE** > **Criar nova chave**)
3. Selecione **JSON** como formato
4. Clique em **CREATE** (ou **CRIAR**)
5. ⚠️ **O arquivo JSON será baixado automaticamente** - guarde-o em local seguro!

---

## ⚙️ Passo 4: Configurar no Projeto

Você tem **duas opções** para configurar. Recomendamos a **Opção A** por ser mais simples.

### 🔹 Opção A: Usar caminho do arquivo (Recomendado)

#### 4.1 Mover o arquivo para o projeto

1. Mova o arquivo JSON baixado para a pasta `server/` do seu projeto
2. Renomeie para `google-credentials.json` (ou mantenha o nome original)

**Exemplo de estrutura:**
```
PulseFlow-VII/
  └── server/
      └── google-credentials.json  ← Arquivo aqui
```

#### 4.2 Configurar no arquivo .env

1. Abra ou crie o arquivo `.env` na pasta `server/` (ou na raiz do projeto)
2. Adicione a seguinte linha:

```env
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

**Se o arquivo estiver em outro local, use caminho absoluto ou relativo:**
```env
# Caminho relativo (se estiver em server/)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# Caminho absoluto (exemplo)
GOOGLE_APPLICATION_CREDENTIALS=/Users/seu-usuario/Documents/google-credentials.json

# Se estiver na raiz do projeto
GOOGLE_APPLICATION_CREDENTIALS=../google-credentials.json
```

**✅ Pronto!** Pule para o [Passo 5](#passo-5-verificar-a-configuração)

---

### 🔹 Opção B: Usar JSON como variável de ambiente

**⚠️ ATENÇÃO:** Esta opção é mais complexa e requer cuidado com quebras de linha no JSON.

#### 4.1 Preparar o JSON

1. Abra o arquivo JSON baixado em um editor de texto
2. **IMPORTANTE**: Remova todas as quebras de linha, deixando o JSON em uma única linha
3. Copie TODO o conteúdo

**Exemplo do formato esperado:**
```json
{"type":"service_account","project_id":"seu-projeto","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"..."}
```

#### 4.2 Configurar no arquivo .env

1. Abra ou crie o arquivo `.env` na pasta `server/` (ou na raiz do projeto)
2. Adicione a seguinte linha (em UMA única linha, sem quebras):

```env
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

**⚠️ IMPORTANTE:** 
- O JSON deve estar em **uma única linha**
- Não use aspas duplas dentro das aspas simples (ou escape corretamente)
- Se tiver problemas, prefira a Opção A

---

## ✅ Passo 5: Verificar a Configuração

### 5.1 Verificar se o arquivo .env está sendo carregado

1. Reinicie o servidor Node.js
2. Procure nos logs uma mensagem como:
   ```
   ✅ Arquivo .env carregado de: /caminho/para/.env
   ```

### 5.2 Testar a configuração

1. Faça uma gravação de consulta através da interface
2. Observe os logs do servidor
3. Você deve ver uma mensagem como:
   ```
   🔑 Usando Google Speech-to-Text com arquivo de credenciais: /caminho/para/google-credentials.json
   ```
   ou
   ```
   🔑 Usando Google Speech-to-Text com credenciais JSON (variável de ambiente)
   ```

### 5.3 Se não funcionar

Se aparecer o erro:
```
❌ Erro: GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_CREDENTIALS_JSON não configurado
```

Verifique:
- ✅ O arquivo `.env` existe e está no local correto
- ✅ A variável está escrita corretamente (sem espaços extras)
- ✅ O servidor foi reiniciado após adicionar a variável
- ✅ O arquivo JSON existe no caminho especificado

---

## 🔍 Troubleshooting

### ❌ Erro: "API key não configurada"

**Problema**: A API Speech-to-Text não está habilitada ou a conta de serviço não tem permissão.

**Solução**:
1. Verifique se a API Cloud Speech-to-Text está habilitada (Passo 2)
2. Verifique se a conta de serviço tem a role **Cloud Speech-to-Text API User**

### ❌ Erro: "Erro de autenticação" ou "403 Forbidden"

**Problema**: As credenciais estão incorretas ou a conta não tem permissão.

**Solução**:
1. Verifique se o arquivo JSON está correto e completo
2. Verifique se a conta de serviço tem permissões adequadas
3. Tente baixar uma nova chave JSON

### ❌ Erro: "Arquivo não encontrado"

**Problema**: O caminho do arquivo JSON está incorreto.

**Solução**:
1. Verifique o caminho no arquivo `.env`
2. Use caminho absoluto se necessário
3. Verifique se o arquivo realmente existe no local especificado

### ❌ Erro: "Quota excedida"

**Problema**: Você atingiu o limite gratuito ou de uso da API.

**Solução**:
1. Verifique seu uso no Google Cloud Console
2. Aguarde o reset do período de quota
3. Considere atualizar seu plano no Google Cloud

### ⚠️ Fallback para Gemini

Se o Google Speech-to-Text falhar, o sistema automaticamente tentará usar o Gemini como fallback. Isso é normal e funciona, mas a transcrição pode ser menos precisa para áudio.

---

## 📝 Exemplo de Arquivo .env Completo

```env
# Configuração do MongoDB
MONGO_URI=mongodb://localhost:27017/pulseflow

# Configuração do Gemini AI
GEMINI_API_KEY=sua-chave-do-gemini-aqui

# Configuração do Google Speech-to-Text (Opção A)
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json

# OU Configuração do Google Speech-to-Text (Opção B)
# GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

---

## 🎯 Resumo Rápido

1. ✅ Crie uma conta de serviço no Google Cloud
2. ✅ Habilite a API Cloud Speech-to-Text
3. ✅ Baixe o arquivo JSON de credenciais
4. ✅ Coloque o arquivo em `server/google-credentials.json`
5. ✅ Adicione `GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json` no `.env`
6. ✅ Reinicie o servidor

**Pronto!** Agora o sistema usará o Google Speech-to-Text para transcrever áudios. 🎉

---

## 📚 Links Úteis

- [Google Cloud Console](https://console.cloud.google.com/)
- [Documentação da API Speech-to-Text](https://cloud.google.com/speech-to-text/docs)
- [Preços da API Speech-to-Text](https://cloud.google.com/speech-to-text/pricing)

