import { GoogleGenerativeAI } from '@google/generative-ai';
import Paciente from '../models/Paciente.js';
import Diabetes from '../models/Diabetes.js';
import Insonia from '../models/Insonia.js';
import PressaoArterial from '../models/PressaoArterial.js';
import AnotacaoMedica from '../models/AnotacaoMedica.js';
import EventoClinico from '../models/EventoClinico.js';
import { CriseGastrite } from '../models/criseGastriteModel.js';
import Enxaqueca from '../models/Enxaqueca.js';
import CicloMenstrual from '../models/CicloMenstrual.js';

// Inicializar Gemini AI (será recriado a cada requisição para garantir que a API key está atualizada)
let genAI = null;

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY não configurada. Configure a variável GEMINI_API_KEY no arquivo .env');
  }
  
  const apiKeyTrimmed = apiKey.trim();
  
  // Validar formato básico da API key (geralmente começa com "AIza")
  if (apiKeyTrimmed.length < 30) {
    console.warn('⚠️ API key parece muito curta. Verifique se está completa.');
  }
  
  // Recriar a instância para garantir que está usando a API key atualizada
  try {
    genAI = new GoogleGenerativeAI(apiKeyTrimmed);
    return genAI;
  } catch (error) {
    console.error('❌ Erro ao inicializar GoogleGenerativeAI:', error.message);
    throw new Error(`Erro ao inicializar cliente do Gemini: ${error.message}`);
  }
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
        // Não retornar erro aqui, deixar o código principal tratar
        return [];
      }
      
      console.log(`⚠️ Não foi possível listar modelos via API (status ${status})`);
      if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            console.log(`   Mensagem: ${errorData.error.message}`);
          }
        } catch (e) {
          // Ignorar erro de parsing
        }
      }
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
          
          console.log(`  ✅ ${model.name} - suporta generateContent`);
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

// Função para buscar todos os dados do paciente
export const buscarTodosDadosPaciente = async (cpf) => {
  try {
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Validar se CPF tem 11 dígitos
    if (cpfLimpo.length !== 11) {
      console.error('CPF inválido:', cpfLimpo);
      return null;
    }
    
    // Buscar paciente - tentar primeiro com CPF limpo
    let paciente = await Paciente.findOne({ cpf: cpfLimpo });
    console.log('Tentativa 1 - CPF limpo:', cpfLimpo, 'Resultado:', paciente ? 'Encontrado' : 'Não encontrado');
    
    // Se não encontrar, tentar com CPF formatado
    if (!paciente) {
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      paciente = await Paciente.findOne({ cpf: cpfFormatado });
      console.log('Tentativa 2 - CPF formatado:', cpfFormatado, 'Resultado:', paciente ? 'Encontrado' : 'Não encontrado');
    }
    
    // Se ainda não encontrar, tentar com o CPF original (caso já venha formatado)
    if (!paciente && cpf !== cpfLimpo) {
      paciente = await Paciente.findOne({ cpf: cpf });
      console.log('Tentativa 3 - CPF original:', cpf, 'Resultado:', paciente ? 'Encontrado' : 'Não encontrado');
    }
    
    if (!paciente) {
      // Buscar todos os CPFs no banco para debug (apenas os primeiros 5)
      const pacientesExemplo = await Paciente.find({}).limit(5).select('cpf name');
      console.error('Paciente não encontrado com CPF:', cpfLimpo, 'ou', cpf);
      console.error('Exemplos de CPFs no banco:', pacientesExemplo.map(p => ({ cpf: p.cpf, name: p.name || p.nome })));
      return null;
    }
    
    console.log('✅ Paciente encontrado:', paciente.name || paciente.nome, 'CPF:', paciente.cpf);

    // Buscar todos os dados relacionados
    const [
      diabetes,
      insonia,
      pressaoArterial,
      anotacoes,
      eventosClinicos,
      gastrite,
      enxaqueca,
      cicloMenstrual
    ] = await Promise.all([
      Diabetes.find({ 
        $or: [
          { pacienteId: paciente._id },
          { paciente: paciente._id }
        ]
      }).sort({ data: -1 }).limit(30),
      Insonia.find({ paciente: paciente._id }).sort({ data: -1 }).limit(30),
      PressaoArterial.find({ paciente: paciente._id }).sort({ data: -1 }).limit(30),
      AnotacaoMedica.find({ pacienteId: paciente._id }).sort({ data: -1 }).limit(20),
      EventoClinico.find({ paciente: paciente._id }).sort({ dataHora: -1 }).limit(20),
      CriseGastrite.find({ paciente: paciente._id }).sort({ data: -1 }).limit(20),
      Enxaqueca.find({ pacienteId: paciente._id.toString() }).sort({ data: -1 }).limit(20),
      CicloMenstrual.find({ pacienteId: paciente._id }).sort({ dataInicio: -1 }).limit(12)
    ]);

    return {
      perfil: {
        nome: paciente.name || paciente.nome,
        idade: calcularIdade(paciente.birthDate || paciente.dataNascimento),
        genero: paciente.gender || paciente.genero,
        altura: paciente.height || paciente.altura,
        peso: paciente.peso || paciente.weight,
        observacoes: paciente.observacoes
      },
      diabetes: diabetes.map(d => ({
        data: d.data,
        nivelGlicemia: d.glicemia || d.nivelGlicemia,
        observacoes: d.observacoes
      })),
      insonia: insonia.map(i => ({
        data: i.data,
        qualidade: i.qualidade,
        horasSono: i.horasSono,
        observacoes: i.observacoes
      })),
      pressaoArterial: pressaoArterial.map(p => ({
        data: p.data,
        sistolica: p.sistolica,
        diastolica: p.diastolica,
        observacoes: p.observacoes
      })),
      anotacoes: anotacoes.map(a => ({
        data: a.data,
        titulo: a.titulo,
        descricao: a.anotacao,
        categoria: a.categoria,
        medico: a.medico,
        tipoConsulta: a.tipoConsulta
      })),
      eventosClinicos: eventosClinicos.map(e => ({
        data: e.dataHora || e.data,
        tipo: e.tipoEvento || e.tipo,
        descricao: e.descricao,
        intensidadeDor: e.intensidadeDor,
        especialidade: e.especialidade,
        sintomas: e.sintomas
      })),
      gastrite: gastrite.map(g => ({
        data: g.data || g.dataCrise,
        intensidade: g.intensidadeDor,
        sintomas: g.sintomas,
        observacoes: g.observacoes,
        alimentosIngeridos: g.alimentosIngeridos
      })),
      enxaqueca: enxaqueca.map(e => ({
        data: e.data,
        intensidade: e.intensidade,
        duracao: e.duracao,
        sintomas: e.sintomas || ''
      })),
      cicloMenstrual: cicloMenstrual.map(c => ({
        data: c.dataInicio || c.data,
        tipo: Array.from(c.diasPorData?.values() || []).map(d => d.fluxo).join(', ') || 'Não informado',
        colica: Array.from(c.diasPorData?.values() || []).some(d => d.teveColica),
        humor: Array.from(c.diasPorData?.values() || []).map(d => d.humor).join(', ') || ''
      }))
    };
  } catch (error) {
    console.error('Erro ao buscar dados do paciente:', error);
    throw error;
  }
};

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

// Função para gerar insights com Gemini
export const gerarInsightsPaciente = async (req, res) => {
  try {
    const { cpf } = req.params;
    const lang = (req.query.lang || req.headers['x-lang'] || 'pt-BR').toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
    
    console.log('🔍 Buscando insights para CPF:', cpf, '| idioma:', lang);

    // Buscar todos os dados do paciente
    const dadosPaciente = await buscarTodosDadosPaciente(cpf);

    if (!dadosPaciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    // Verificar se a API key do Gemini está configurada
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      console.error('❌ GEMINI_API_KEY não encontrada ou vazia');
      console.error('   Verifique se o arquivo .env existe na raiz do projeto server/');
      console.error('   E se contém a linha: GEMINI_API_KEY=sua_api_key_aqui');
      return res.status(500).json({ 
        success: false,
        message: 'API key do Gemini não configurada',
        error: 'Configure a variável GEMINI_API_KEY no arquivo .env na raiz do diretório server/',
        details: 'Verifique se o arquivo .env existe e contém a chave GEMINI_API_KEY com sua API key do Google AI Studio'
      });
    }
    
    // Validar formato da API key
    const apiKeyTrimmed = apiKey.trim();
    
    // Validar formato básico (geralmente começa com "AIza" e tem 39 caracteres)
    if (!apiKeyTrimmed.startsWith('AIza')) {
      console.warn('⚠️ API key não começa com "AIza" - pode estar incorreta');
    }
    
    if (apiKeyTrimmed.length < 35 || apiKeyTrimmed.length > 45) {
      console.warn('⚠️ API key parece ter tamanho incomum:', apiKeyTrimmed.length, 'caracteres (esperado: 39)');
    }
    
    // Verificar se há caracteres especiais ou espaços que possam causar problemas
    if (apiKeyTrimmed.includes(' ') || apiKeyTrimmed.includes('\n') || apiKeyTrimmed.includes('\r')) {
      console.error('❌ API key contém espaços ou quebras de linha - remova-os!');
      return res.status(500).json({ 
        success: false,
        message: 'API key inválida',
        error: 'A API key contém espaços ou quebras de linha. Remova espaços e quebras de linha da variável GEMINI_API_KEY no arquivo .env',
        details: 'A API key deve estar em uma única linha, sem espaços extras'
      });
    }
    
    console.log('🔑 API Key encontrada:', apiKeyTrimmed.substring(0, 15) + '...' + apiKeyTrimmed.substring(apiKeyTrimmed.length - 5) + ' (total:', apiKeyTrimmed.length, 'caracteres)');

    // Preparar prompt para o Gemini
    console.log('📝 Criando prompt para Gemini...');
    const prompt = criarPromptInsights(dadosPaciente, lang);
    console.log('✅ Prompt criado, tamanho:', prompt.length, 'caracteres');

    // Gerar insights com Gemini
    console.log('🤖 Chamando API do Gemini...');
    console.log('📏 Tamanho do prompt:', prompt.length, 'caracteres');
    
    // Limitar o tamanho do prompt se for muito grande (limite do plano gratuito)
    const maxPromptLength = 30000; // Limite conservador para plano gratuito
    let promptFinal = prompt;
    if (prompt.length > maxPromptLength) {
      console.log('⚠️ Prompt muito grande, truncando para', maxPromptLength, 'caracteres');
      promptFinal = prompt.substring(0, maxPromptLength) + '\n\n[Nota: Dados truncados devido ao limite de tamanho]';
    }
    
    let insights;
    try {
      // Primeiro, testar a API key fazendo uma requisição simples
      console.log('🧪 Testando API key...');
      try {
        const testResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeyTrimmed}`);
        if (!testResponse.ok) {
          const errorText = await testResponse.text();
          let errorMessage = `Erro ${testResponse.status}`;
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch (e) {
            // Ignorar erro de parsing
          }
          
          if (testResponse.status === 401 || testResponse.status === 403) {
            console.error('❌ API key inválida ou sem permissão');
            throw new Error(`API key inválida ou sem permissão. Verifique se a chave está correta e ativa no Google AI Studio. Erro: ${errorMessage}`);
          }
        } else {
          console.log('✅ API key válida - teste de autenticação bem-sucedido');
        }
      } catch (testError) {
        // Se o erro já foi tratado acima, relançar
        if (testError.message.includes('API key inválida')) {
          throw testError;
        }
        console.warn('⚠️ Não foi possível testar a API key:', testError.message);
      }
      
      // Obter instância do Gemini AI com a API key atualizada
      const genAIInstance = getGenAI();
      
      // Primeiro, tentar listar modelos disponíveis
      console.log('📋 Listando modelos disponíveis...');
      const modelosDisponiveis = await listarModelosDisponiveis();
      
      // Lista de modelos para tentar (ordem de preferência)
      const modelosParaTentar = [];
      
      // Se temos modelos disponíveis da lista, usar APENAS esses (não usar fallback)
      if (modelosDisponiveis.length > 0) {
        console.log('📋 Usando apenas modelos listados como disponíveis:', modelosDisponiveis.length);
        
        // Filtrar apenas modelos Gemini (excluir embeddings)
        const modelosGemini = modelosDisponiveis.filter(name => 
          name.includes('gemini') && 
          !name.includes('embedding') && 
          !name.includes('embed') &&
          !name.includes('text-embedding')
        );
        
        if (modelosGemini.length > 0) {
          // Priorizar modelos flash (mais rápidos) se disponíveis
          const modelosFlash = modelosGemini.filter(name => 
            name.includes('flash') || name.includes('Flash')
          );
          const modelosPro = modelosGemini.filter(name => 
            name.includes('pro') || name.includes('Pro')
          );
          
          // Ordem: Flash primeiro, depois Pro, depois outros
          if (modelosFlash.length > 0) {
            modelosParaTentar.push(...modelosFlash);
          }
          if (modelosPro.length > 0) {
            modelosParaTentar.push(...modelosPro);
          }
          // Adicionar outros modelos Gemini que não são flash nem pro
          const outros = modelosGemini.filter(name => 
            !name.includes('flash') && !name.includes('Flash') &&
            !name.includes('pro') && !name.includes('Pro')
          );
          if (outros.length > 0) {
            modelosParaTentar.push(...outros);
          }
        } else {
          // Se não encontrou modelos Gemini, usar todos os disponíveis
          modelosParaTentar.push(...modelosDisponiveis);
        }
      } else {
        // Fallback: apenas se não conseguiu listar modelos
        console.warn('⚠️ Não foi possível listar modelos, usando fallback');
        modelosParaTentar.push(
          'gemini-pro',                // Modelo mais básico
          'gemini-1.5-flash',
          'gemini-1.5-pro'
        );
      }
      
      // Remover duplicatas mantendo a ordem
      const modelosUnicos = [...new Set(modelosParaTentar)];
      
      console.log(`📋 Modelos que serão tentados (${modelosUnicos.length}):`, modelosUnicos.slice(0, 10));
      
      let model = null;
      let ultimoErro = null;
      
      console.log(`🔄 Tentando ${modelosUnicos.length} modelos...`);
      
      for (const nomeModelo of modelosUnicos) {
        try {
          console.log(`📦 Tentando modelo: ${nomeModelo}...`);
          model = genAIInstance.getGenerativeModel({ model: nomeModelo });
          console.log(`✅ Modelo ${nomeModelo} inicializado com sucesso`);
          // Se chegou aqui, o modelo foi inicializado - vamos usar ele
          break;
        } catch (modelError) {
          const errorMsg = modelError.message || modelError.toString();
          const errorMsgLower = errorMsg.toLowerCase();
          
          // Verificar se é erro 404 (modelo não encontrado) - não é fatal, apenas tenta próximo
          const is404Error = errorMsgLower.includes('404') || 
                             errorMsgLower.includes('not found') ||
                             errorMsgLower.includes('is not found') ||
                             (modelError.cause && JSON.stringify(modelError.cause).includes('404'));
          
          if (is404Error) {
            console.log(`⚠️ Modelo ${nomeModelo} não encontrado (404) - tentando próximo modelo...`);
          } else {
            console.log(`⚠️ Modelo ${nomeModelo} não disponível:`, errorMsg.substring(0, 200));
          }
          
          ultimoErro = modelError;
          model = null; // Resetar para próxima tentativa
          continue;
        }
      }
      
      if (!model) {
        const mensagemErro = ultimoErro?.message || 'Desconhecido';
        console.error('❌ Nenhum modelo disponível. Último erro:', mensagemErro);
        
        // Se conseguiu listar modelos, mostrar quais estão disponíveis
        if (modelosDisponiveis.length > 0) {
          throw new Error(`Nenhum dos modelos tentados está disponível. Modelos disponíveis na sua conta: ${modelosDisponiveis.slice(0, 5).join(', ')}. Verifique o Google AI Studio para mais detalhes.`);
        } else {
          throw new Error(`Nenhum modelo disponível. Verifique se sua API key está correta e tem acesso aos modelos Gemini. Último erro: ${mensagemErro.substring(0, 200)}`);
        }
      }
      
      console.log(`🎯 Usando modelo: ${model.model || 'modelo selecionado'}`);
      
      console.log('🔄 Enviando requisição para o Gemini...');
      console.log('📏 Tamanho do prompt final:', promptFinal.length, 'caracteres');
      
      let result, response;
      try {
        result = await model.generateContent(promptFinal);
        console.log('✅ Requisição enviada, aguardando resposta...');
        response = await result.response;
        console.log('✅ Resposta recebida do Gemini');
      } catch (generateError) {
        console.error('❌ Erro ao gerar conteúdo:', generateError);
        console.error('   Tipo:', generateError.constructor.name);
        console.error('   Mensagem:', generateError.message);
        throw generateError;
      }
      
      // Verificar se há bloqueios de segurança
      if (response.candidates && response.candidates[0] && response.candidates[0].finishReason) {
        const finishReason = response.candidates[0].finishReason;
        if (finishReason !== 'STOP') {
          console.warn('⚠️ Finish reason:', finishReason);
          if (finishReason === 'SAFETY') {
            throw new Error('A resposta foi bloqueada por filtros de segurança do Gemini. Tente ajustar o prompt.');
          }
        }
      }
      
      insights = response.text();
      
      if (!insights || insights.trim() === '') {
        throw new Error('A resposta do Gemini está vazia');
      }
      
      console.log('✅ Insights gerados com sucesso, tamanho:', insights.length, 'caracteres');
    } catch (geminiError) {
      console.error('❌ Erro na API do Gemini:');
      console.error('   Tipo:', geminiError.constructor.name);
      console.error('   Mensagem:', geminiError.message);
      console.error('   Código:', geminiError.code);
      console.error('   Status:', geminiError.status);
      console.error('   Status Code:', geminiError.statusCode);
      
      // Capturar resposta completa do erro
      let errorResponse = null;
      if (geminiError.response) {
        errorResponse = geminiError.response;
        console.error('   Response:', JSON.stringify(errorResponse, null, 2));
      }
      
      // Tentar capturar erro do SDK do Google Generative AI
      if (geminiError.cause) {
        console.error('   Cause:', JSON.stringify(geminiError.cause, null, 2));
        errorResponse = geminiError.cause;
      }
      
      // Tentar capturar todas as propriedades do erro
      console.error('   Todas as propriedades do erro:', Object.keys(geminiError));
      if (geminiError.message) {
        console.error('   Mensagem completa:', geminiError.message);
      }
      
      // Tentar obter status code do erro de várias formas
      let statusCode = geminiError.status || geminiError.statusCode;
      if (errorResponse) {
        if (errorResponse.status) {
          statusCode = errorResponse.status;
        }
        if (errorResponse.statusCode) {
          statusCode = errorResponse.statusCode;
        }
        // Tentar obter status de dentro de error
        if (errorResponse.error?.status) {
          statusCode = errorResponse.error.status;
        }
        if (errorResponse.error?.code) {
          statusCode = errorResponse.error.code;
        }
      }
      
      if (geminiError.stack) {
        console.error('   Stack:', geminiError.stack.substring(0, 1000));
      }
      
      // Extrair mensagem de erro mais específica
      let errorMessage = geminiError.message || geminiError.toString();
      
      // Verificar se há informações de erro no response
      if (errorResponse) {
        if (errorResponse.error) {
          const errorObj = errorResponse.error;
          errorMessage = errorObj.message || errorObj.status || errorObj.code || errorObj || errorMessage;
          console.error('   Erro do response:', JSON.stringify(errorObj, null, 2));
        }
        if (errorResponse.message) {
          errorMessage = errorResponse.message;
        }
        // Tentar obter mensagem de dentro de error.message
        if (errorResponse.error?.message) {
          errorMessage = errorResponse.error.message;
        }
      }
      
      // Converter para string para fazer busca case-insensitive
      const errorMessageLower = errorMessage.toLowerCase();
      const errorString = JSON.stringify(errorResponse || geminiError).toLowerCase();
      
      // Verificar se a API key foi reportada como vazada/comprometida
      if (errorMessageLower.includes('leaked') || 
          errorMessageLower.includes('reported as leaked') ||
          errorString.includes('leaked')) {
        console.error('❌ API key reportada como vazada/comprometida');
        throw new Error('Sua API key foi reportada como vazada/comprometida pelo Google. Por segurança, você precisa criar uma nova API key no Google AI Studio (https://aistudio.google.com/app/apikey) e atualizar a variável GEMINI_API_KEY no arquivo .env');
      }
      
      // Verificar se é erro de autenticação (401, 403, API_KEY_INVALID, etc)
      if (statusCode === 401 || statusCode === 403 || 
          errorMessageLower.includes('api_key') || 
          errorMessageLower.includes('authentication') ||
          errorMessageLower.includes('api key not valid') ||
          errorMessageLower.includes('invalid_api_key') ||
          errorMessageLower.includes('invalid api key') ||
          errorMessageLower.includes('unauthorized') ||
          errorMessageLower.includes('permission denied') ||
          errorMessageLower.includes('forbidden') ||
          errorString.includes('api_key') ||
          errorString.includes('authentication') ||
          errorString.includes('401') ||
          errorString.includes('403')) {
        console.error('❌ Erro de autenticação detectado');
        console.error('   Status Code:', statusCode);
        console.error('   Mensagem de erro:', errorMessage);
        const detalhesErro = process.env.NODE_ENV === 'development' 
          ? ` Detalhes técnicos: ${errorMessage}` 
          : '';
        throw new Error(`Erro de autenticação com a API do Gemini. Verifique se a API key está correta e ativa no Google AI Studio.${detalhesErro}`);
      }
      
      // Verificar se é erro de quota
      if (statusCode === 429 ||
          errorMessageLower.includes('quota') ||
          errorMessageLower.includes('rate limit') ||
          errorMessageLower.includes('resource_exhausted') ||
          errorString.includes('quota') ||
          errorString.includes('429')) {
        throw new Error('Limite de requisições excedido no plano gratuito. Aguarde alguns minutos ou considere atualizar seu plano no Google AI Studio.');
      }
      
      // Verificar se é erro de modelo não disponível (404)
      if (statusCode === 404 ||
          errorMessageLower.includes('not found') ||
          errorMessageLower.includes('model_not_found') ||
          errorMessageLower.includes('is not found') ||
          errorMessageLower.includes('not supported for generatecontent') ||
          errorString.includes('not found') ||
          errorString.includes('404')) {
        throw new Error(`O modelo de IA não está disponível no seu plano. O código tentará automaticamente outros modelos disponíveis. Detalhes: ${errorMessage.substring(0, 300)}`);
      }
      
      // Verificar se é erro de modelo não disponível (genérico)
      if (errorMessageLower.includes('model') && 
          (errorMessageLower.includes('not available') || 
           errorMessageLower.includes('not supported'))) {
        throw new Error(`Modelo não disponível no seu plano: ${errorMessage}`);
      }
      
      // Verificar se é erro de segurança/bloqueio
      if (errorMessageLower.includes('safety') ||
          errorMessageLower.includes('blocked') ||
          errorString.includes('safety') ||
          errorString.includes('blocked')) {
        throw new Error('A resposta foi bloqueada por filtros de segurança do Gemini. O conteúdo pode ter sido considerado sensível.');
      }
      
      // Erro genérico com a mensagem específica
      throw new Error(`Erro ao chamar API do Gemini: ${errorMessage}`);
    }

    res.json({
      success: true,
      insights: insights,
      dadosResumo: {
        totalRegistros: {
          diabetes: dadosPaciente.diabetes.length,
          insonia: dadosPaciente.insonia.length,
          pressaoArterial: dadosPaciente.pressaoArterial.length,
          anotacoes: dadosPaciente.anotacoes.length,
          eventosClinicos: dadosPaciente.eventosClinicos.length
        },
        ultimaAtualizacao: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Erro ao gerar insights:', error);
    console.error('❌ Tipo do erro:', error.constructor.name);
    console.error('❌ Mensagem do erro:', error.message);
    if (error.stack) {
      console.error('❌ Stack trace:', error.stack);
    }
    
    // Garantir que sempre retorna JSON, não HTML
    if (!res.headersSent) {
      // Usar a mensagem de erro específica se disponível, caso contrário usar a genérica
      const errorMessage = error.message || 'Erro desconhecido ao gerar insights';
      
      res.status(500).json({ 
        success: false,
        message: 'Erro ao gerar insights', 
        error: errorMessage, // Mensagem específica do erro
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        type: error.constructor.name
      });
    } else {
      console.error('⚠️ Resposta já foi enviada, não é possível retornar erro');
    }
  }
};

// Função para criar o prompt de insights
function criarPromptInsights(dados, lang = 'pt-BR') {
  const { perfil, diabetes, insonia, pressaoArterial, anotacoes, eventosClinicos, gastrite, enxaqueca, cicloMenstrual } = dados;
  const isEnglish = lang === 'en';

  const instrucoesIdioma = isEnglish
    ? `IMPORTANT: Write the ENTIRE response in English. Use clear, professional medical language. Organize the response in sections such as: "General Analysis", "Identified Patterns", "Important Alerts", "Recommendations". Do not use Portuguese in the response.`
    : `Formate a resposta em português brasileiro, de forma clara e profissional.`;

  return `Você é um assistente médico especializado em análise de dados de saúde. Analise os seguintes dados do paciente e forneça insights relevantes, recomendações e alertas importantes.

DADOS DO PACIENTE:
- Nome: ${perfil.nome}
- Idade: ${perfil.idade || 'Não informado'} anos
- Gênero: ${perfil.genero || 'Não informado'}
- Altura: ${perfil.altura || 'Não informado'} cm
- Peso: ${perfil.peso || 'Não informado'} kg
- Observações: ${perfil.observacoes || 'Nenhuma'}

${diabetes.length > 0 ? `
REGISTROS DE GLICEMIA (últimos ${diabetes.length} registros):
${diabetes.map(d => `- Data: ${new Date(d.data).toLocaleDateString('pt-BR')}, Glicemia: ${d.glicemia || d.nivelGlicemia || 'N/A'} ${d.unidade || 'mg/dL'}${d.observacoes ? `, Observações: ${d.observacoes}` : ''}`).join('\n')}
` : 'Nenhum registro de glicemia encontrado.'}

${insonia.length > 0 ? `
REGISTROS DE INSÔNIA (últimos ${insonia.length} registros):
${insonia.map(i => `- Data: ${new Date(i.data).toLocaleDateString('pt-BR')}, Qualidade: ${i.qualidade}, Horas de sono: ${i.horasSono}${i.observacoes ? `, Observações: ${i.observacoes}` : ''}`).join('\n')}
` : 'Nenhum registro de insônia encontrado.'}

${pressaoArterial.length > 0 ? `
REGISTROS DE PRESSÃO ARTERIAL (últimos ${pressaoArterial.length} registros):
${pressaoArterial.map(p => `- Data: ${new Date(p.data).toLocaleDateString('pt-BR')}, ${p.sistolica}/${p.diastolica} mmHg${p.observacoes ? `, Observações: ${p.observacoes}` : ''}`).join('\n')}
` : 'Nenhum registro de pressão arterial encontrado.'}

${gastrite.length > 0 ? `
CRISES DE GASTRITE (últimas ${gastrite.length}):
${gastrite.map(g => `- Data: ${new Date(g.data).toLocaleDateString('pt-BR')}, Intensidade da dor: ${g.intensidade}/10, Sintomas: ${g.sintomas || 'Não informado'}${g.alimentosIngeridos ? `, Alimentos ingeridos: ${g.alimentosIngeridos}` : ''}${g.observacoes ? `, Observações: ${g.observacoes}` : ''}`).join('\n')}
` : 'Nenhuma crise de gastrite registrada.'}

${enxaqueca.length > 0 ? `
REGISTROS DE ENXAQUECA (últimos ${enxaqueca.length}):
${enxaqueca.map(e => `- Data: ${new Date(e.data).toLocaleDateString('pt-BR')}, Intensidade: ${e.intensidade}, Duração: ${e.duracao}${e.sintomas ? `, Sintomas: ${e.sintomas}` : ''}`).join('\n')}
` : 'Nenhum registro de enxaqueca encontrado.'}

${eventosClinicos.length > 0 ? `
EVENTOS CLÍNICOS (últimos ${eventosClinicos.length}):
${eventosClinicos.map(e => `- Data: ${new Date(e.data).toLocaleDateString('pt-BR')}, Tipo: ${e.tipo}, Especialidade: ${e.especialidade}, Intensidade da dor: ${e.intensidadeDor}, Sintomas: ${e.sintomas}, Descrição: ${e.descricao}`).join('\n')}
` : 'Nenhum evento clínico registrado.'}

${anotacoes.length > 0 ? `
ANOTAÇÕES CLÍNICAS (últimas ${anotacoes.length}):
${anotacoes.map(a => `- Data: ${new Date(a.data).toLocaleDateString('pt-BR')}, Categoria: ${a.categoria}, Médico: ${a.medico}, Título: ${a.titulo}, Anotação: ${a.descricao}`).join('\n')}
` : 'Nenhuma anotação clínica encontrada.'}

${cicloMenstrual.length > 0 ? `
CICLO MENSTRUAL (últimos ${cicloMenstrual.length} registros):
${cicloMenstrual.map(c => `- Data início: ${new Date(c.data).toLocaleDateString('pt-BR')}, Fluxo: ${c.tipo}${c.colica ? `, Teve cólica: Sim` : ', Teve cólica: Não'}${c.humor ? `, Humor: ${c.humor}` : ''}`).join('\n')}
` : 'Nenhum registro de ciclo menstrual encontrado.'}

INSTRUÇÕES:
1. Analise todos os dados fornecidos de forma integrada
2. Identifique padrões, tendências e anomalias
3. Forneça insights relevantes para o médico
4. Inclua alertas importantes (valores fora do normal, padrões preocupantes)
5. Sugira recomendações baseadas nos dados
6. Seja objetivo e claro, usando linguagem médica apropriada
7. Organize a resposta em seções como: "Análise Geral", "Padrões Identificados", "Alertas Importantes", "Recomendações"
8. Se houver poucos dados, mencione isso e sugira a importância de mais registros

${instrucoesIdioma}`;
}

// Função para responder perguntas do médico sobre o paciente
export const responderPergunta = async (req, res) => {
  try {
    const { cpf } = req.params;
    const { pergunta, contextoInsights, lang: langParam } = req.body;
    const lang = (langParam || 'pt-BR').toString().toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
    
    if (!pergunta || pergunta.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Pergunta não fornecida',
        error: 'É necessário fornecer uma pergunta'
      });
    }
    
    console.log('❓ Pergunta recebida para CPF:', cpf);
    console.log('📝 Pergunta:', pergunta.substring(0, 100));
    
    // Buscar dados do paciente
    const dadosPaciente = await buscarTodosDadosPaciente(cpf);
    
    if (!dadosPaciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }
    
    // Verificar se a API key está configurada
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({ 
        success: false,
        message: 'API key do Gemini não configurada'
      });
    }
    
    const apiKeyTrimmed = apiKey.trim();
    
    // Preparar contexto para a pergunta
    let contexto = `Você é um assistente médico especializado em análise de dados de saúde. Um médico está fazendo uma pergunta sobre um paciente.
    
DADOS DO PACIENTE:
- Nome: ${dadosPaciente.perfil.nome}
- Idade: ${dadosPaciente.perfil.idade || 'Não informado'} anos
- Gênero: ${dadosPaciente.perfil.genero || 'Não informado'}
- Altura: ${dadosPaciente.perfil.altura || 'Não informado'} cm
- Peso: ${dadosPaciente.perfil.peso || 'Não informado'} kg
`;
    
    // Adicionar contexto dos insights se fornecido
    if (contextoInsights) {
      contexto += `\nCONTEXTO DOS INSIGHTS ANTERIORES:\n${contextoInsights}\n`;
    }
    
    // Adicionar resumo dos dados disponíveis
    contexto += `\nDADOS DISPONÍVEIS:\n`;
    contexto += `- ${dadosPaciente.diabetes.length} registros de glicemia\n`;
    contexto += `- ${dadosPaciente.insonia.length} registros de insônia\n`;
    contexto += `- ${dadosPaciente.pressaoArterial.length} registros de pressão arterial\n`;
    contexto += `- ${dadosPaciente.anotacoes.length} anotações clínicas\n`;
    contexto += `- ${dadosPaciente.eventosClinicos.length} eventos clínicos\n`;
    contexto += `- ${dadosPaciente.gastrite.length} crises de gastrite\n`;
    contexto += `- ${dadosPaciente.enxaqueca.length} registros de enxaqueca\n`;
    contexto += `- ${dadosPaciente.cicloMenstrual.length} registros de ciclo menstrual\n`;
    
    const prompt = `${contexto}\n\nPERGUNTA DO MÉDICO:\n${pergunta}\n\nINSTRUÇÕES:
1.⁠ ⁠Responda a pergunta do médico de forma clara e objetiva
2.⁠ ⁠Baseie sua resposta nos dados disponíveis do paciente
3.⁠ ⁠Se não houver dados suficientes, mencione isso
4.⁠ ⁠Use linguagem médica apropriada
5.⁠ ⁠Seja conciso mas completo
6.⁠ ⁠Se a pergunta for sobre algo que não está nos dados, informe isso claramente

${lang === 'en' ? 'Write the entire response in English, clearly and professionally.' : 'Formate a resposta em português brasileiro, de forma clara e profissional.'}`;
    
    // Gerar resposta com Gemini
    let resposta;
    try {
      const genAIInstance = getGenAI();
      
      // Listar modelos disponíveis
      const modelosDisponiveis = await listarModelosDisponiveis();
      
      // Selecionar modelo (mesma lógica dos insights)
      const modelosParaTentar = [];
      
      if (modelosDisponiveis.length > 0) {
        const modelosGemini = modelosDisponiveis.filter(name => 
          name.includes('gemini') && 
          !name.includes('embedding') && 
          !name.includes('embed')
        );
        
        if (modelosGemini.length > 0) {
          const modelosFlash = modelosGemini.filter(name => name.includes('flash') || name.includes('Flash'));
          const modelosPro = modelosGemini.filter(name => name.includes('pro') || name.includes('Pro'));
          
          if (modelosFlash.length > 0) modelosParaTentar.push(...modelosFlash);
          if (modelosPro.length > 0) modelosParaTentar.push(...modelosPro);
        } else {
          modelosParaTentar.push(...modelosDisponiveis);
        }
      } else {
        modelosParaTentar.push('gemini-pro', 'gemini-1.5-flash', 'gemini-1.5-pro');
      }
      
      const modelosUnicos = [...new Set(modelosParaTentar)];
      let model = null;
      
      for (const nomeModelo of modelosUnicos) {
        try {
          model = genAIInstance.getGenerativeModel({ model: nomeModelo });
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!model) {
        throw new Error('Nenhum modelo disponível');
      }
      
      console.log('🤖 Gerando resposta para a pergunta...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      resposta = response.text();
      
      if (!resposta || resposta.trim() === '') {
        throw new Error('Resposta vazia do Gemini');
      }
      
      console.log('✅ Resposta gerada com sucesso');
    } catch (geminiError) {
      console.error('❌ Erro ao gerar resposta:', geminiError);
      throw geminiError;
    }
    
    res.json({
      success: true,
      resposta: resposta,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro ao responder pergunta:', error);
    
    if (!res.headersSent) {
      const errorMessage = error.message || 'Erro desconhecido ao responder pergunta';
      
      res.status(500).json({ 
        success: false,
        message: 'Erro ao responder pergunta', 
        error: errorMessage
      });
    }
  }
};

/**
 * Traduz texto (ex.: conteúdo de registro clínico) para o idioma da interface.
 * POST body: { text: string, lang: string }
 * lang === 'en' → traduz para inglês; caso contrário retorna o texto original.
 */
export const traduzirTexto = async (req, res) => {
  try {
    const { text, lang } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Texto não informado', translated: '' });
    }
    const targetLang = (lang || '').toString().toLowerCase().startsWith('en') ? 'en' : 'pt-BR';
    if (targetLang !== 'en') {
      return res.json({ success: true, translated: text });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({ success: false, message: 'API key do Gemini não configurada', translated: text });
    }

    const genAI = getGenAI();
    const modelosDisponiveis = await listarModelosDisponiveis();
    const modelosParaTentar = modelosDisponiveis.length > 0
      ? modelosDisponiveis.filter(n => n.includes('gemini') && !n.includes('embed'))
      : ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    const modelosUnicos = [...new Set(modelosParaTentar)];

    const prompt = `Traduza o seguinte texto de registro médico do português para o inglês. Mantenha a formatação e termos médicos precisos. Retorne APENAS o texto traduzido, sem explicações.

TEXTO:
${text}`;

    let translated = text;
    for (const nomeModelo of modelosUnicos) {
      try {
        const model = genAI.getGenerativeModel({ model: nomeModelo });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const out = response.text();
        if (out && out.trim()) {
          translated = out.trim();
          break;
        }
      } catch (e) {
        continue;
      }
    }

    return res.json({ success: true, translated });
  } catch (error) {
    console.error('Erro ao traduzir texto:', error);
    const text = (req.body && req.body.text) || '';
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message || 'Erro ao traduzir', translated: text });
    }
  }
};
