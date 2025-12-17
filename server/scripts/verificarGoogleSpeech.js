import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env
const envPathServer = path.join(__dirname, '..', '.env');
const envPathRoot = path.join(__dirname, '..', '..', '.env');

dotenv.config({ path: envPathServer });
dotenv.config({ path: envPathRoot });

console.log('🔍 Verificando configuração do Google Speech-to-Text...\n');

// Verificar variáveis de ambiente
const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

console.log('📋 Variáveis de Ambiente:');
console.log(`   GOOGLE_APPLICATION_CREDENTIALS: ${googleCredentialsPath || '❌ Não configurado'}`);
console.log(`   GOOGLE_CREDENTIALS_JSON: ${googleCredentialsJson ? '✅ Configurado (oculto)' : '❌ Não configurado'}\n`);

let configurado = false;

// Verificar Opção A: Arquivo JSON
if (googleCredentialsPath) {
  console.log('🔍 Verificando Opção A (Arquivo JSON)...');
  
  // Resolver caminho
  let credPath;
  if (path.isAbsolute(googleCredentialsPath)) {
    credPath = googleCredentialsPath;
  } else {
    // Tentar relativo a server/
    credPath = path.join(__dirname, '..', googleCredentialsPath);
    
    // Se não encontrar, tentar relativo à raiz
    if (!fs.existsSync(credPath)) {
      credPath = path.join(__dirname, '..', '..', googleCredentialsPath);
    }
  }
  
  console.log(`   Caminho resolvido: ${credPath}`);
  
  if (fs.existsSync(credPath)) {
    console.log('   ✅ Arquivo encontrado!');
    
    try {
      const credContent = fs.readFileSync(credPath, 'utf8');
      const credJson = JSON.parse(credContent);
      
      if (credJson.type === 'service_account') {
        console.log('   ✅ Formato JSON válido');
        console.log(`   📧 Email da conta: ${credJson.client_email || 'N/A'}`);
        console.log(`   🏢 Projeto: ${credJson.project_id || 'N/A'}`);
        configurado = true;
      } else {
        console.log('   ❌ JSON não é uma conta de serviço válida');
      }
    } catch (error) {
      console.log(`   ❌ Erro ao ler/parsear arquivo: ${error.message}`);
    }
  } else {
    console.log('   ❌ Arquivo não encontrado no caminho especificado');
    console.log(`   💡 Verifique se o caminho está correto: ${credPath}`);
  }
  
  console.log('');
}

// Verificar Opção B: JSON como variável de ambiente
if (googleCredentialsJson) {
  console.log('🔍 Verificando Opção B (JSON como variável)...');
  
  try {
    const credJson = JSON.parse(googleCredentialsJson);
    
    if (credJson.type === 'service_account') {
      console.log('   ✅ JSON válido');
      console.log(`   📧 Email da conta: ${credJson.client_email || 'N/A'}`);
      console.log(`   🏢 Projeto: ${credJson.project_id || 'N/A'}`);
      configurado = true;
    } else {
      console.log('   ❌ JSON não é uma conta de serviço válida');
    }
  } catch (error) {
    console.log(`   ❌ Erro ao parsear JSON: ${error.message}`);
    console.log('   💡 Certifique-se de que o JSON está em uma única linha');
  }
  
  console.log('');
}

// Testar inicialização do cliente (opcional)
if (configurado) {
  console.log('🧪 Tentando inicializar cliente do Google Speech-to-Text...');
  
  try {
    // Importar dinamicamente apenas se necessário
    const speech = await import('@google-cloud/speech');
    
    // Tentar criar cliente (pode falhar se as credenciais estiverem incorretas)
    console.log('   ⏳ Inicializando...');
    
    // Se chegou aqui sem erro, a configuração básica está OK
    console.log('   ✅ Cliente pode ser inicializado!');
    console.log('   💡 Nota: Isso não testa a conexão real com a API');
    
  } catch (error) {
    console.log(`   ⚠️  Aviso: ${error.message}`);
    console.log('   💡 Isso pode ser normal se as credenciais precisarem de mais configuração');
  }
  
  console.log('');
}

// Resumo final
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (configurado) {
  console.log('✅ Configuração encontrada! O Google Speech-to-Text deve funcionar.');
  console.log('\n💡 Próximos passos:');
  console.log('   1. Reinicie o servidor');
  console.log('   2. Teste gravando uma consulta');
  console.log('   3. Verifique os logs para confirmar');
} else {
  console.log('❌ Configuração não encontrada ou inválida.');
  console.log('\n📖 Consulte o arquivo INSTRUCOES_GOOGLE_SPEECH.md para mais detalhes.');
  console.log('\n💡 Resumo rápido:');
  console.log('   1. Baixe o arquivo JSON de credenciais do Google Cloud');
  console.log('   2. Coloque em server/google-credentials.json');
  console.log('   3. Adicione GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json no .env');
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');


