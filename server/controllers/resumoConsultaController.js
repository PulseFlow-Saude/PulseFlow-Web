import ResumoConsulta from '../models/ResumoConsulta.js';
import Paciente from '../models/Paciente.js';
import User from '../models/User.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import speech from '@google-cloud/speech';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para inicializar Gemini AI
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY não configurada');
  }
  return new GoogleGenerativeAI(apiKey.trim());
}

// Função para listar modelos disponíveis via API REST
async function listarModelosDisponiveis() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.warn('⚠️ API key não configurada, não é possível listar modelos');
      return [];
    }
    
    const apiKeyTrimmed = apiKey.trim();
    
    // Tentar listar modelos via API REST diretamente
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeyTrimmed}`);
    
    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text().catch(() => '');
      
      // Se for erro de autenticação, não continuar
      if (status === 401 || status === 403) {
        console.error(`❌ Erro de autenticação ao listar modelos (status ${status})`);
        console.error('   Verifique se a API key está correta e ativa');
        return [];
      }
      
      console.log(`⚠️ Não foi possível listar modelos via API (status ${status})`);
      return [];
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    console.log('📋 Total de modelos encontrados:', models.length);
    
    // Extrair nomes dos modelos que suportam generateContent
    const modelNames = [];
    const modelNamesShort = [];
    
    for (const model of models) {
      if (model.name) {
        // Verificar se suporta generateContent
        const supportedMethods = model.supportedGenerationMethods || [];
        if (supportedMethods.includes('generateContent')) {
          // Adicionar nome completo
          modelNames.push(model.name);
          
          // Extrair nome curto (última parte após /)
          const parts = model.name.split('/');
          if (parts.length > 1) {
            const shortName = parts[parts.length - 1];
            // Adicionar apenas se não for duplicata
            if (!modelNamesShort.includes(shortName)) {
              modelNamesShort.push(shortName);
            }
          }
        }
      }
    }
    
    // Priorizar nomes curtos (mais fáceis de usar)
    const finalList = [...modelNamesShort, ...modelNames];
    
    console.log('📋 Modelos disponíveis com generateContent:', finalList.slice(0, 15));
    return finalList;
  } catch (error) {
    console.error('❌ Erro ao listar modelos:', error.message);
    // Continuar mesmo se falhar ao listar
    return [];
  }
}

// Função para inicializar cliente do Google Speech-to-Text
function getSpeechClient() {
  const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const googleCredentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  
  // Opção 1: Usar arquivo JSON de credenciais (caminho)
  if (googleCredentialsPath) {
    const credPath = path.isAbsolute(googleCredentialsPath) 
      ? googleCredentialsPath 
      : path.join(__dirname, '..', googleCredentialsPath);
    
    if (fs.existsSync(credPath)) {
      console.log('🔑 Usando Google Speech-to-Text com arquivo de credenciais:', credPath);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
      return new speech.SpeechClient();
    }
  }
  
  // Opção 2: Usar JSON de credenciais como string (variável de ambiente)
  if (googleCredentialsJson && googleCredentialsJson.trim() !== '') {
    try {
      console.log('🔑 Usando Google Speech-to-Text com credenciais JSON (variável de ambiente)');
      const credentials = JSON.parse(googleCredentialsJson);
      
      // Criar arquivo temporário com as credenciais
      const tempCredPath = path.join(__dirname, '../temp-google-credentials.json');
      fs.writeFileSync(tempCredPath, JSON.stringify(credentials));
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredPath;
      
      const client = new speech.SpeechClient();
      
      // Limpar arquivo temporário após um delay (não bloquear)
      setTimeout(() => {
        try {
          if (fs.existsSync(tempCredPath)) {
            fs.unlinkSync(tempCredPath);
          }
        } catch (e) {
          console.warn('Não foi possível remover arquivo temporário de credenciais:', e);
        }
      }, 5000);
      
      return client;
    } catch (e) {
      console.error('Erro ao fazer parse do GOOGLE_CREDENTIALS_JSON:', e);
      throw new Error('GOOGLE_CREDENTIALS_JSON inválido. Deve ser um JSON válido.');
    }
  }
  
  // Opção 3: Tentar usar variável de ambiente padrão do Google Cloud
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(credPath)) {
      console.log('🔑 Usando Google Speech-to-Text com GOOGLE_APPLICATION_CREDENTIALS padrão');
      return new speech.SpeechClient();
    }
  }
  
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_CREDENTIALS_JSON não configurado. Configure no arquivo .env');
}

// Função para transcrever áudio usando Google Speech-to-Text API
async function transcreverAudioComGoogleSpeech(audioBuffer, mimeType) {
  try {
    console.log('🔧 Usando Google Speech-to-Text para transcrição...');
    console.log(`📊 Tamanho do buffer: ${audioBuffer.length} bytes`);
    console.log(`🎵 Tipo MIME: ${mimeType}`);
    
    // Inicializar cliente
    const client = getSpeechClient();
    
    // Determinar encoding baseado no tipo MIME
    // Google Speech-to-Text suporta: LINEAR16, FLAC, MULAW, AMR, AMR_WB, OGG_OPUS, SPEEX_WITH_HEADER_BYTE, WEBM_OPUS
    let encoding = 'WEBM_OPUS';
    const mimeTypeLower = (mimeType || '').toLowerCase();
    
    if (mimeTypeLower.includes('linear16') || mimeTypeLower.includes('pcm') || mimeTypeLower.includes('wav')) {
      encoding = 'LINEAR16';
    } else if (mimeTypeLower.includes('flac')) {
      encoding = 'FLAC';
    } else if (mimeTypeLower.includes('mp3') || mimeTypeLower.includes('mpeg')) {
      encoding = 'MP3';
    } else if (mimeTypeLower.includes('ogg') || mimeTypeLower.includes('opus')) {
      encoding = 'OGG_OPUS';
    } else {
      // WebM é o padrão para gravações do navegador
      encoding = 'WEBM_OPUS';
    }
    
    console.log(`📁 Encoding: ${encoding}`);
    
    // Configurar requisição
    const request = {
      audio: {
        content: audioBuffer.toString('base64')
      },
      config: {
        encoding: encoding,
        languageCode: 'pt-BR',
        alternativeLanguageCodes: ['pt-PT'], // Fallback para português de Portugal
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
        model: 'latest_long', // Modelo otimizado para áudios longos
        useEnhanced: true, // Usar modelo melhorado (mais preciso)
        audioChannelCount: 1, // Mono (padrão para gravações de voz)
        enableSeparateRecognitionPerChannel: false
      }
    };
    
    // Adicionar sampleRateHertz apenas para LINEAR16 e FLAC
    if (encoding === 'LINEAR16' || encoding === 'FLAC') {
      request.config.sampleRateHertz = encoding === 'LINEAR16' ? 16000 : 44100;
    }
    
    console.log('📤 Enviando áudio para Google Speech-to-Text...');
    
    // Fazer a requisição
    const [response] = await client.recognize(request);
    
    if (!response.results || response.results.length === 0) {
      throw new Error('Nenhum resultado de transcrição retornado pela API');
    }
    
    // Combinar todos os resultados
    const transcricao = response.results
      .map(result => result.alternatives[0]?.transcript || '')
      .filter(text => text.trim() !== '')
      .join(' ');
    
    if (!transcricao || transcricao.trim() === '') {
      throw new Error('Transcrição vazia retornada pela API');
    }
    
    console.log(`✅ Transcrição concluída: ${transcricao.length} caracteres`);
    return transcricao.trim();
    
  } catch (error) {
    console.error('❌ Erro detalhado ao transcrever com Google Speech-to-Text:');
    console.error('   Tipo:', error.constructor.name);
    console.error('   Mensagem:', error.message);
    console.error('   Code:', error.code);
    console.error('   Stack:', error.stack);
    
    // Mensagens de erro mais específicas
    if (error.message.includes('API key') || error.message.includes('authentication') || error.code === 7) {
      throw new Error('Erro de autenticação: GOOGLE_SPEECH_API_KEY inválida ou expirada. Verifique a chave no arquivo .env');
    } else if (error.message.includes('quota') || error.code === 8) {
      throw new Error('Limite de quota excedido. Aguarde alguns minutos ou verifique sua conta Google Cloud.');
    } else if (error.message.includes('permission') || error.code === 7) {
      throw new Error('Erro de permissão. Verifique se a API Speech-to-Text está habilitada no Google Cloud Console.');
    }
    
    throw error;
  }
}

// Função para transcrever áudio usando Gemini (fallback)
// Nota: Gemini 1.5 Pro e Flash suportam áudio, mas precisamos converter para o formato correto
async function transcreverAudioComGemini(audioBuffer, mimeType) {
  try {
    console.log('🔧 Inicializando Gemini AI...');
    const genAI = getGenAI();
    
    // Verificar se o buffer está vazio
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Buffer de áudio está vazio');
    }
    
    // Converter buffer para base64
    const base64Audio = audioBuffer.toString('base64');
    console.log(`📦 Áudio convertido para base64: ${base64Audio.length} caracteres`);
    
    // Normalizar mimeType para o formato esperado pelo Gemini
    let normalizedMimeType = mimeType || 'audio/webm';
    if (normalizedMimeType === 'audio/mp4' || normalizedMimeType === 'audio/x-m4a') {
      normalizedMimeType = 'audio/mp4';
    } else if (normalizedMimeType.includes('webm')) {
      normalizedMimeType = 'audio/webm';
    } else if (normalizedMimeType.includes('wav')) {
      normalizedMimeType = 'audio/wav';
    } else {
      normalizedMimeType = 'audio/webm'; // Default
    }
    
    console.log(`🎵 Tipo MIME normalizado: ${normalizedMimeType}`);
    
    const prompt = "Transcreva esta gravação de consulta médica em português brasileiro. Retorne apenas a transcrição completa e precisa, sem comentários adicionais ou formatação especial.";
    
    // Listar modelos disponíveis
    const modelosDisponiveis = await listarModelosDisponiveis();
    
    // Selecionar modelos para tentar
    const modelosParaTentar = [];
    
    if (modelosDisponiveis.length > 0) {
      // Priorizar modelos que suportam áudio (Flash e Pro)
      const modelosFlash = modelosDisponiveis.filter(name => 
        (name.includes('flash') || name.includes('Flash')) &&
        (name.includes('1.5') || name.includes('2.0'))
      );
      const modelosPro = modelosDisponiveis.filter(name => 
        (name.includes('pro') || name.includes('Pro')) &&
        (name.includes('1.5') || name.includes('2.0'))
      );
      
      if (modelosFlash.length > 0) modelosParaTentar.push(...modelosFlash);
      if (modelosPro.length > 0) modelosParaTentar.push(...modelosPro);
      
      // Adicionar outros modelos disponíveis
      modelosDisponiveis.forEach(m => {
        if (!modelosParaTentar.includes(m)) {
          modelosParaTentar.push(m);
        }
      });
    } else {
      // Fallback para modelos padrão se não conseguir listar
      modelosParaTentar.push('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-pro');
    }
    
    // Remover duplicatas mantendo a ordem
    const modelosUnicos = [...new Set(modelosParaTentar)];
    
    console.log(`📋 Tentando ${modelosUnicos.length} modelos:`, modelosUnicos.slice(0, 5));
    
    // Tentar gerar conteúdo com cada modelo até que um funcione
    let ultimoErroGeracao = null;
    
    for (const nomeModelo of modelosUnicos) {
      try {
        console.log(`🔄 Tentando gerar conteúdo com modelo: ${nomeModelo}...`);
        const modeloAtual = genAI.getGenerativeModel({ model: nomeModelo });
        
        const result = await modeloAtual.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Audio,
              mimeType: normalizedMimeType
            }
          }
        ]);
        
        console.log('📥 Resposta recebida, processando...');
        const response = await result.response;
        const transcricao = response.text();
        
        if (!transcricao || transcricao.trim() === '') {
          throw new Error('Transcrição vazia retornada pelo modelo');
        }
        
        console.log(`✅ Transcrição concluída com ${nomeModelo}: ${transcricao.length} caracteres`);
        return transcricao.trim();
        
      } catch (generateError) {
        const errorMsg = generateError.message || generateError.toString();
        const errorMsgLower = errorMsg.toLowerCase();
        
        // Verificar se é erro 404 ou modelo não suportado
        const is404Error = errorMsgLower.includes('404') || 
                           errorMsgLower.includes('not found') ||
                           errorMsgLower.includes('is not found') ||
                           errorMsgLower.includes('not supported') ||
                           (generateError.status === 404);
        
        if (is404Error) {
          console.log(`⚠️ Modelo ${nomeModelo} não suporta áudio ou não encontrado (404) - tentando próximo...`);
          ultimoErroGeracao = generateError;
          continue; // Tentar próximo modelo
        } else {
          // Para outros erros (como quota, auth), não tentar outros modelos
          console.error(`❌ Erro não recuperável com modelo ${nomeModelo}:`, errorMsg.substring(0, 150));
          ultimoErroGeracao = generateError;
          
          // Se for erro de autenticação ou quota, não tentar outros modelos
          if (errorMsgLower.includes('api key') || 
              errorMsgLower.includes('authentication') || 
              errorMsgLower.includes('quota') ||
              errorMsgLower.includes('rate limit')) {
            throw generateError;
          }
          
          continue; // Tentar próximo modelo para outros erros
        }
      }
    }
    
    // Se chegou aqui, todos os modelos falharam
    throw new Error(`Nenhum modelo conseguiu processar o áudio. Último erro: ${ultimoErroGeracao?.message || 'Desconhecido'}`);
  } catch (error) {
    console.error('❌ Erro detalhado ao transcrever áudio:');
    console.error('   Tipo:', error.constructor.name);
    console.error('   Mensagem:', error.message);
    console.error('   Stack:', error.stack);
    
    // Mensagens de erro mais específicas
    if (error.message.includes('not support') || error.message.includes('audio')) {
      throw new Error('O modelo de IA não suporta processamento de áudio no momento. Por favor, use uma API de transcrição de áudio separada (como Google Speech-to-Text ou Whisper).');
    }
    
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      throw new Error('Erro de autenticação com a API do Gemini. Verifique se a GEMINI_API_KEY está configurada corretamente.');
    }
    
    if (error.message.includes('quota') || error.message.includes('rate limit')) {
      throw new Error('Limite de requisições excedido. Aguarde alguns minutos e tente novamente.');
    }
    
    throw new Error(`Erro ao transcrever áudio: ${error.message}`);
  }
}

// Função para gerar resumo e pontos importantes com Gemini
async function gerarResumoComIA(transcricao, dadosPaciente, outputLang = 'pt-BR') {
  try {
    console.log('🔧 Inicializando Gemini AI para gerar resumo...');
    const genAI = getGenAI();
    
    const outputLangNormalized = (outputLang || 'pt-BR').toString().toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
    
    // Listar modelos disponíveis
    const modelosDisponiveis = await listarModelosDisponiveis();
    
    // Selecionar modelos para tentar
    const modelosParaTentar = [];
    
    if (modelosDisponiveis.length > 0) {
      // Priorizar modelos Flash (mais rápidos) antes de Pro
      const modelosFlash = modelosDisponiveis.filter(name => 
        (name.includes('flash') || name.includes('Flash'))
      );
      const modelosPro = modelosDisponiveis.filter(name => 
        (name.includes('pro') || name.includes('Pro')) &&
        !name.includes('embedding')
      );
      
      if (modelosFlash.length > 0) modelosParaTentar.push(...modelosFlash);
      if (modelosPro.length > 0) modelosParaTentar.push(...modelosPro);
      
      // Adicionar outros modelos disponíveis que suportam texto
      modelosDisponiveis.forEach(m => {
        if (!modelosParaTentar.includes(m) && !m.includes('embedding')) {
          modelosParaTentar.push(m);
        }
      });
    } else {
      // Fallback para modelos padrão se não conseguir listar
      modelosParaTentar.push('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-pro');
    }
    
    // Remover duplicatas mantendo a ordem
    const modelosUnicos = [...new Set(modelosParaTentar)];
    
    console.log(`📋 Tentando ${modelosUnicos.length} modelos:`, modelosUnicos.slice(0, 5));
    
    const prompt = `Você é um assistente médico especializado em análise de consultas. Analise a transcrição da consulta abaixo e gere:

1. Um resumo estruturado da consulta (máximo 500 palavras)
2. Uma lista de pontos importantes extraídos da consulta (máximo 10 pontos, cada um em uma linha separada)

TRANSCRIÇÃO DA CONSULTA:
${transcricao}

DADOS DO PACIENTE (para contexto):
- Nome: ${dadosPaciente.nome || 'Não informado'}
- Idade: ${dadosPaciente.idade || 'Não informado'} anos
- Gênero: ${dadosPaciente.genero || 'Não informado'}

FORMATO DA RESPOSTA:
${outputLangNormalized === 'en' ? 'SUMMARY:\n[your summary here]\n\nKEY POINTS:\n- [point 1]\n- [point 2]\n...' : 'RESUMO:\n[seu resumo aqui]\n\nPONTOS IMPORTANTES:\n- [ponto 1]\n- [ponto 2]\n...'}

Seja objetivo, claro e use linguagem médica apropriada.
${outputLangNormalized === 'en' ? 'IMPORTANT: Write the ENTIRE summary and ALL key points in English. The consultation may have been spoken in Portuguese, but you must output the summary and key points in English only.' : 'Escreva o resumo e os pontos importantes em português brasileiro.'}`;

    // Tentar gerar conteúdo com cada modelo até que um funcione
    let ultimoErroGeracao = null;
    
    for (const nomeModelo of modelosUnicos) {
      try {
        console.log(`🔄 Tentando gerar resumo com modelo: ${nomeModelo}...`);
        const modeloAtual = genAI.getGenerativeModel({ model: nomeModelo });
        
        console.log('📤 Enviando prompt para gerar resumo...');
        const result = await modeloAtual.generateContent(prompt);
        const response = await result.response;
        const textoCompleto = response.text();
        
        console.log(`📥 Resposta recebida do modelo ${nomeModelo}: ${textoCompleto.length} caracteres`);
        
        // Separar resumo e pontos importantes (aceitar PT ou EN no cabeçalho)
        const sepPontos = textoCompleto.includes('KEY POINTS:') ? 'KEY POINTS:' : 'PONTOS IMPORTANTES:';
        const partes = textoCompleto.split(sepPontos);
        let resumo = partes[0].replace(/^SUMMARY:\s*/i, '').replace(/^RESUMO:\s*/i, '').trim();
        const pontosTexto = partes[1] || '';
        
        // Se não encontrou a separação, tentar outras formas
        if (!resumo || resumo.length < 50) {
          const linhas = textoCompleto.split('\n');
          const indicePontos = linhas.findIndex(l => l.includes('PONTOS IMPORTANTES') || l.includes('KEY POINTS'));
          if (indicePontos > 0) {
            resumo = linhas.slice(0, indicePontos).join('\n').replace(/^SUMMARY:\s*/i, '').replace(/^RESUMO:\s*/i, '').trim();
          } else {
            resumo = textoCompleto.substring(0, 500).trim();
          }
        }
        
        // Extrair pontos importantes (linhas que começam com -)
        const pontos = pontosTexto
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-') && line.length > 2)
          .map(line => line.substring(1).trim())
          .filter(ponto => ponto.length > 0);
        
        // Se não encontrou pontos, criar alguns básicos
        if (pontos.length === 0) {
          pontos.push('Consulta registrada com sucesso');
          pontos.push('Aguardando análise detalhada');
        }
        
        console.log(`✅ Resumo gerado com ${nomeModelo}: ${resumo.length} caracteres, ${pontos.length} pontos importantes`);
        
        return {
          resumo,
          pontosImportantes: pontos
        };
        
      } catch (generateError) {
        const errorMsg = generateError.message || generateError.toString();
        const errorMsgLower = errorMsg.toLowerCase();
        
        // Verificar se é erro 404 ou modelo não suportado
        const is404Error = errorMsgLower.includes('404') || 
                           errorMsgLower.includes('not found') ||
                           errorMsgLower.includes('is not found') ||
                           errorMsgLower.includes('not supported') ||
                           (generateError.status === 404);
        
        if (is404Error) {
          console.log(`⚠️ Modelo ${nomeModelo} não encontrado ou não disponível (404) - tentando próximo...`);
          ultimoErroGeracao = generateError;
          continue; // Tentar próximo modelo
        } else {
          // Para outros erros (como quota, auth), não tentar outros modelos
          console.error(`❌ Erro não recuperável com modelo ${nomeModelo}:`, errorMsg.substring(0, 150));
          ultimoErroGeracao = generateError;
          
          // Se for erro de autenticação ou quota, não tentar outros modelos
          if (errorMsgLower.includes('api key') || 
              errorMsgLower.includes('authentication') || 
              errorMsgLower.includes('quota') ||
              errorMsgLower.includes('rate limit')) {
            throw generateError;
          }
          
          continue; // Tentar próximo modelo para outros erros
        }
      }
    }
    
    // Se chegou aqui, todos os modelos falharam
    throw new Error(`Nenhum modelo conseguiu gerar o resumo. Último erro: ${ultimoErroGeracao?.message || 'Desconhecido'}`);
  } catch (error) {
    console.error('❌ Erro detalhado ao gerar resumo com IA:');
    console.error('   Tipo:', error.constructor.name);
    console.error('   Mensagem:', error.message);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

// Controller para processar áudio e gerar resumo
export const processarAudioConsulta = async (req, res) => {
  try {
    console.log('🎙️ Recebendo requisição de processamento de áudio');
    console.log('📋 Body:', req.body);
    console.log('📁 File:', req.file ? { name: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : 'Nenhum arquivo');
    
    const { cpf, motivoConsulta, observacoes, lang } = req.body;
    const medicoId = req.user.id;
    const outputLang = (lang || 'pt-BR').toString().toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
    
    if (!req.file) {
      console.error('❌ Arquivo de áudio não fornecido');
      return res.status(400).json({ 
        success: false,
        message: 'Arquivo de áudio não fornecido' 
      });
    }
    
    if (!cpf) {
      console.error('❌ CPF não fornecido no body');
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e);
        }
      }
      return res.status(400).json({ 
        success: false,
        message: 'CPF do paciente não fornecido' 
      });
    }
    
    // Buscar paciente
    const cpfLimpo = cpf?.replace(/\D/g, '');
    let paciente = await Paciente.findOne({ cpf: cpfLimpo });
    
    if (!paciente) {
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      paciente = await Paciente.findOne({ cpf: cpfFormatado });
    }
    
    if (!paciente) {
      paciente = await Paciente.findOne({ cpf: cpf });
    }
    
    if (!paciente) {
      // Limpar arquivo temporário
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false,
        message: 'Paciente não encontrado' 
      });
    }
    
    // Buscar dados do médico
    console.log('👨‍⚕️ Buscando médico com ID:', medicoId);
    const medico = await User.findById(medicoId);
    if (!medico) {
      console.error('❌ Médico não encontrado com ID:', medicoId);
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ 
        success: false,
        message: 'Médico não encontrado' 
      });
    }
    console.log('✅ Médico encontrado:', medico.nome || medico.name);
    
    // Criar registro inicial
    console.log('💾 Criando registro de resumo de consulta...');
    let resumoConsulta;
    try {
      resumoConsulta = new ResumoConsulta({
        pacienteId: paciente._id,
        medicoId: medicoId,
        dataConsulta: new Date(),
        arquivoAudio: req.file.path,
        status: 'processando',
        tipoConsulta: 'presencial', // Valor padrão
        motivoConsulta: motivoConsulta || '',
        observacoes: observacoes || '',
        resumo: 'Processando...', // Placeholder temporário
        pontosImportantes: []
      });
      
      await resumoConsulta.save();
      console.log('✅ Registro criado com sucesso, ID:', resumoConsulta._id);
    } catch (saveError) {
      console.error('❌ Erro ao salvar resumo de consulta:');
      console.error('   Tipo:', saveError.constructor.name);
      console.error('   Mensagem:', saveError.message);
      console.error('   Stack:', saveError.stack);
      console.error('   Erro completo:', JSON.stringify(saveError, null, 2));
      
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Erro ao deletar arquivo:', e);
        }
      }
      
      throw saveError;
    }
    
    // Processar áudio em background (não bloquear resposta)
    const resumoId = resumoConsulta._id;
    console.log('🚀 Iniciando processamento em background para resumo:', resumoId);
    
    processarAudioEmBackground(resumoId, req.file.path, req.file.mimetype, paciente, outputLang)
      .catch(error => {
        console.error('❌ Erro ao processar áudio em background:', error);
        // Atualizar status para erro
        ResumoConsulta.findByIdAndUpdate(resumoId, {
          status: 'erro',
          erro: error.message
        }).catch(updateError => {
          console.error('❌ Erro ao atualizar status de erro:', updateError);
        });
      });
    
    console.log('✅ Resposta enviada ao cliente, processamento em background iniciado');
    res.json({
      success: true,
      message: 'Áudio recebido e processamento iniciado',
      resumoId: resumoId
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar áudio:');
    console.error('   Tipo:', error.constructor.name);
    console.error('   Mensagem:', error.message);
    console.error('   Stack:', error.stack);
    
    // Limpar arquivo se houver erro
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Erro ao deletar arquivo:', e);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Erro ao processar áudio',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Função para processar áudio em background
async function processarAudioEmBackground(resumoId, caminhoArquivo, mimeType, paciente, outputLang = 'pt-BR') {
  try {
    console.log(`🎙️ Iniciando processamento de áudio para resumo ${resumoId}`);
    console.log(`📁 Arquivo: ${caminhoArquivo}, Tipo: ${mimeType}`);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(caminhoArquivo)) {
      throw new Error(`Arquivo de áudio não encontrado: ${caminhoArquivo}`);
    }
    
    // Ler arquivo de áudio
    const audioBuffer = fs.readFileSync(caminhoArquivo);
    console.log(`📊 Tamanho do arquivo: ${audioBuffer.length} bytes`);
    
    if (audioBuffer.length === 0) {
      throw new Error('Arquivo de áudio está vazio');
    }
    
    // Transcrever áudio - tentar Whisper primeiro, depois Gemini como fallback
    console.log('📝 Transcrevendo áudio...');
    let transcricao;
    let erroTranscricao = null;
    
    // Tentar Google Speech-to-Text primeiro (mais barato e gratuito)
    try {
      console.log('🎯 Tentando transcrição com Google Speech-to-Text API...');
      transcricao = await transcreverAudioComGoogleSpeech(audioBuffer, mimeType);
      console.log('✅ Transcrição concluída com Google Speech-to-Text:', transcricao.substring(0, 100) + '...');
    } catch (googleError) {
      console.error('❌ Erro ao transcrever com Google Speech-to-Text:', googleError.message);
      erroTranscricao = googleError;
      
      // Verificar se é erro de API key ou outro erro específico
      if (googleError.message.includes('API key') || googleError.message.includes('authentication') || googleError.code === 7) {
        console.error('🔑 Erro de autenticação com Google Speech-to-Text API. Verifique se a GOOGLE_SPEECH_API_KEY está correta.');
        throw new Error('Erro de autenticação com Google Speech-to-Text API. Verifique se a GOOGLE_SPEECH_API_KEY está configurada corretamente no arquivo .env');
      }
      
      // Tentar Gemini como fallback apenas se não for erro de autenticação
      if (!googleError.message.includes('API key') && !googleError.message.includes('authentication') && googleError.code !== 7) {
        try {
          console.log('⚠️ Google Speech-to-Text falhou, tentando Gemini como fallback...');
          transcricao = await transcreverAudioComGemini(audioBuffer, mimeType);
          console.log('✅ Transcrição concluída com Gemini:', transcricao.substring(0, 100) + '...');
          erroTranscricao = null; // Sucesso com Gemini
        } catch (geminiError) {
          console.error('❌ Erro ao transcrever com Gemini:', geminiError.message);
          erroTranscricao = geminiError;
        }
      }
    }
    
    // Se ambas falharem, criar uma transcrição placeholder com mensagem mais útil
    if (!transcricao || erroTranscricao) {
      const mensagemErro = erroTranscricao?.message || 'Erro desconhecido';
      console.error('❌ Falha na transcrição com ambos os serviços');
      console.error('   Erro:', mensagemErro);
      
      // Criar mensagem de erro mais específica
      let mensagemErroUsuario = 'Não foi possível transcrever o áudio automaticamente.';
      
      if (mensagemErro.includes('API key') || mensagemErro.includes('401') || mensagemErro.includes('authentication') || mensagemErro.includes('GOOGLE_SPEECH_API_KEY')) {
        mensagemErroUsuario = 'Erro de autenticação com a API de transcrição. Verifique se a GOOGLE_SPEECH_API_KEY está configurada corretamente no arquivo .env do servidor.';
      } else if (mensagemErro.includes('quota') || mensagemErro.includes('rate limit')) {
        mensagemErroUsuario = 'Limite de requisições excedido na API de transcrição. Aguarde alguns minutos e tente novamente.';
      } else if (mensagemErro.includes('network') || mensagemErro.includes('timeout')) {
        mensagemErroUsuario = 'Erro de conexão com a API de transcrição. Verifique sua conexão com a internet.';
      }
      
      transcricao = `[Erro na transcrição: ${mensagemErroUsuario}]\n\nO áudio foi recebido mas não foi possível transcrever automaticamente. Por favor, entre em contato com o suporte técnico ou adicione uma transcrição manual.`;
      console.log('⚠️ Usando transcrição placeholder devido ao erro');
    }
    
    // Preparar dados do paciente para contexto
    const dadosPaciente = {
      nome: paciente.name || paciente.nome,
      idade: calcularIdade(paciente.birthDate || paciente.dataNascimento),
      genero: paciente.gender || paciente.genero
    };
    
    // Gerar resumo e pontos importantes
    console.log('🤖 Gerando resumo com IA...');
    let resumo, pontosImportantes;
    try {
      const resultado = await gerarResumoComIA(transcricao, dadosPaciente, outputLang);
      resumo = resultado.resumo;
      pontosImportantes = resultado.pontosImportantes;
      console.log('✅ Resumo gerado com sucesso');
    } catch (resumoError) {
      console.error('❌ Erro ao gerar resumo:', resumoError);
      // Se o resumo falhar, criar um resumo básico
      resumo = `Resumo da consulta realizada em ${new Date().toLocaleDateString('pt-BR')}.\n\nTranscrição: ${transcricao.substring(0, 500)}...`;
      pontosImportantes = ['Consulta registrada', 'Aguardando processamento completo'];
      console.log('⚠️ Usando resumo básico devido ao erro');
    }
    
    // Calcular duração do áudio (aproximado)
    // Nota: Para calcular duração real, seria necessário usar uma biblioteca de áudio
    const duracaoAudio = Math.round(audioBuffer.length / 16000); // Estimativa grosseira
    
    // Atualizar resumo
    await ResumoConsulta.findByIdAndUpdate(resumoId, {
      transcricao,
      resumo,
      pontosImportantes,
      duracaoAudio,
      status: 'concluido'
    });
    
    console.log(`✅ Resumo ${resumoId} processado com sucesso`);
    
  } catch (error) {
    console.error(`❌ Erro ao processar resumo ${resumoId}:`, error);
    console.error('Stack trace:', error.stack);
    
    // Garantir que o erro seja salvo no banco
    try {
      await ResumoConsulta.findByIdAndUpdate(resumoId, {
        status: 'erro',
        erro: error.message || 'Erro desconhecido ao processar áudio'
      });
    } catch (updateError) {
      console.error('❌ Erro ao atualizar status de erro:', updateError);
    }
    
    throw error;
  }
}

// Função para calcular idade
function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    anos--;
  }
  return anos;
}

// Controller para buscar resumos de um paciente
export const buscarResumosPorPaciente = async (req, res) => {
  try {
    const { cpf } = req.query;
    const medicoId = req.user.id;
    
    const cpfLimpo = cpf?.replace(/\D/g, '');
    let paciente = await Paciente.findOne({ cpf: cpfLimpo });
    
    if (!paciente) {
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      paciente = await Paciente.findOne({ cpf: cpfFormatado });
    }
    
    if (!paciente) {
      paciente = await Paciente.findOne({ cpf: cpf });
    }
    
    if (!paciente) {
      return res.status(404).json({ 
        success: false,
        message: 'Paciente não encontrado' 
      });
    }
    
    const resumos = await ResumoConsulta.find({
      pacienteId: paciente._id,
      medicoId: medicoId
    })
    .sort({ dataConsulta: -1 })
    .limit(50);
    
    res.json({
      success: true,
      resumos: resumos.map(r => ({
        id: r._id,
        dataConsulta: r.dataConsulta,
        resumo: r.resumo,
        pontosImportantes: r.pontosImportantes,
        transcricao: r.transcricao,
        status: r.status,
        duracaoAudio: r.duracaoAudio,
        tipoConsulta: r.tipoConsulta,
        motivoConsulta: r.motivoConsulta,
        observacoes: r.observacoes
      }))
    });
    
  } catch (error) {
    console.error('Erro ao buscar resumos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar resumos',
      error: error.message
    });
  }
};

// Controller para buscar um resumo específico
export const buscarResumoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const medicoId = req.user.id;
    
    const resumo = await ResumoConsulta.findOne({
      _id: id,
      medicoId: medicoId
    });
    
    if (!resumo) {
      return res.status(404).json({
        success: false,
        message: 'Resumo não encontrado'
      });
    }
    
    res.json({
      success: true,
      resumo: {
        id: resumo._id,
        dataConsulta: resumo.dataConsulta,
        resumo: resumo.resumo,
        pontosImportantes: resumo.pontosImportantes,
        transcricao: resumo.transcricao,
        status: resumo.status,
        duracaoAudio: resumo.duracaoAudio,
        tipoConsulta: resumo.tipoConsulta,
        motivoConsulta: resumo.motivoConsulta,
        observacoes: resumo.observacoes,
        erro: resumo.erro
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar resumo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar resumo',
      error: error.message
    });
  }
};

