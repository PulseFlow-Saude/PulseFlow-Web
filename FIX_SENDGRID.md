# 🔧 Como Corrigir Erro "Forbidden" do SendGrid

## ❌ Erro Atual
```
❌ Erro ao enviar via SendGrid: Forbidden
```

## ✅ Solução: Verificar Email Remetente no SendGrid

O erro "Forbidden" geralmente significa que o email remetente não está verificado no SendGrid.

### Passo 1: Verificar Email no SendGrid

1. Acesse: https://app.sendgrid.com
2. Vá em: **Settings** → **Sender Authentication**
3. Clique em **Verify a Single Sender** (ou verificar domínio)
4. Adicione o email: `pulseflowsaude@gmail.com`
5. Verifique o email que o SendGrid enviou
6. Clique no link de verificação

### Passo 2: Verificar Variáveis no Render

No Render Dashboard → Environment Variables, verifique:

```
SENDGRID_API_KEY = sua_api_key_aqui
SENDGRID_FROM_EMAIL = pulseflowsaude@gmail.com
```

**IMPORTANTE**: O `SENDGRID_FROM_EMAIL` deve ser EXATAMENTE o mesmo email que você verificou no SendGrid!

### Passo 3: Verificar Permissões da API Key

1. SendGrid Dashboard → Settings → API Keys
2. Clique na sua API Key
3. Verifique se tem permissão **"Mail Send"** ou **"Full Access"**

### Passo 4: Testar Novamente

Após verificar o email, faça um novo deploy ou aguarde alguns minutos e teste o login novamente.

## 📝 Logs Detalhados

Após o próximo deploy, os logs mostrarão mais detalhes do erro se ainda houver problema.

