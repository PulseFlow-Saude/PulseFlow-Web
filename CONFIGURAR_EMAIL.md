# 📧 Como Configurar Envio de Email no Render

## ⚠️ Problema Atual

O Gmail SMTP está dando timeout no Render porque o Render bloqueia conexões SMTP do Gmail.

## ✅ Solução: Usar SendGrid (Recomendado)

O SendGrid funciona perfeitamente no Render e é gratuito até 100 emails/dia.

### Passo 1: Criar conta no SendGrid

1. Acesse: https://sendgrid.com
2. Crie uma conta gratuita (100 emails/dia grátis)
3. Verifique seu email

### Passo 2: Criar API Key

1. No SendGrid Dashboard → Settings → API Keys
2. Clique em "Create API Key"
3. Nome: `PulseFlow Render`
4. Permissões: **Full Access** (ou apenas "Mail Send")
5. Copie a API Key gerada (ela só aparece uma vez!)

### Passo 3: Verificar Domínio/Email Remetente

1. No SendGrid Dashboard → Settings → Sender Authentication
2. Você pode:
   - **Opção A**: Verificar um domínio (recomendado para produção)
   - **Opção B**: Verificar um email único (mais rápido para testes)

### Passo 4: Adicionar Variáveis no Render

No Render Dashboard → Environment Variables, adicione:

```
SENDGRID_API_KEY = sua_api_key_aqui
SENDGRID_FROM_EMAIL = pulseflowsaude@gmail.com (ou seu email verificado)
```

### Passo 5: Deploy

O código já está configurado! Após adicionar as variáveis, faça um novo deploy.

## 🔄 Fallback para Gmail

Se você não configurar o SendGrid, o sistema tentará usar Gmail SMTP como fallback (mas pode dar timeout no Render).

## 📝 Logs

Se o email falhar, o código OTP será logado nos logs do Render:
- Procure por: `🔑 Código OTP: XXXXXX`
- O código estará nos logs mesmo se o email não for enviado

## 🎯 Resultado Esperado

Após configurar o SendGrid:
- ✅ Emails serão enviados rapidamente
- ✅ Sem timeouts
- ✅ Funciona perfeitamente no Render
- ✅ 100 emails/dia grátis

