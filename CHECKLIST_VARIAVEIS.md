# ✅ Checklist de Variáveis de Ambiente - Render

## 🔴 OBRIGATÓRIAS (Devem estar configuradas)

Verifique se TODAS estas variáveis estão no Render:

- [ ] **MONGO_URI** - String de conexão do MongoDB
- [ ] **JWT_SECRET** - Chave secreta para tokens JWT
- [ ] **NODE_ENV** - Deve ser `production` (não `development`)
- [ ] **FIREBASE_API_KEY** - Chave da API do Firebase
- [ ] **FIREBASE_AUTH_DOMAIN** - Domínio de autenticação do Firebase
- [ ] **FIREBASE_PROJECT_ID** - ID do projeto Firebase
- [ ] **FIREBASE_STORAGE_BUCKET** - Bucket de storage do Firebase
- [ ] **FIREBASE_MESSAGING_SENDER_ID** - ID do remetente de mensagens
- [ ] **FIREBASE_APP_ID** - ID do app Firebase

## 🟡 OPCIONAIS MAS RECOMENDADAS

- [ ] **FIREBASE_VAPID_KEY** - Chave VAPID para notificações push
- [ ] **FIREBASE_SERVICE_ACCOUNT** - Service account do Firebase (para FCM)
- [ ] **EMAIL_USER** - Usuário do email (já está configurado ✅)
- [ ] **EMAIL_PASS** - Senha do email (já está configurado ✅)
- [ ] **GEMINI_API_KEY** - Chave da API do Google Gemini (se usar)

## ⚠️ IMPORTANTE

1. Clique em **"Show more"** para ver todas as variáveis
2. Verifique se **MONGO_URI** e **JWT_SECRET** estão configuradas
3. Verifique se **NODE_ENV** está como `production` (não `development`)
4. O Render define automaticamente **PORT** - não precisa adicionar manualmente

## 📋 Variáveis que você já tem (visíveis na imagem):

✅ EMAIL_USER
✅ EMAIL_PASS  
✅ FIREBASE_API_KEY
✅ FIREBASE_APP_ID
✅ FIREBASE_AUTH_DOMAIN
✅ FIREBASE_MESSAGING_SENDER_ID
✅ FIREBASE_PROJECT_ID
✅ FIREBASE_SERVICE_ACCOUNT
✅ FIREBASE_STORAGE_BUCKET

## ❓ Verificar no "Show more":

- MONGO_URI
- JWT_SECRET
- NODE_ENV
- FIREBASE_VAPID_KEY
- GEMINI_API_KEY (se usar)

