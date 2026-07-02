import Passos from '../models/Passos.js';
import Paciente from '../models/Paciente.js';
import { resolveMonthYearQuery } from '../utils/resolveMonthYearQuery.js';

export const registrarPassos = async (req, res) => {
  const { data, passos } = req.body;
  const pacienteId = req.user.id;

  try {
    // Processar data - pode ser ISO8601 string ou formato YYYY-MM-DD
    let dataCorrigida;
    if (typeof data === 'string' && data.includes('T')) {
      // ISO8601 string
      dataCorrigida = new Date(data);
    } else if (typeof data === 'string') {
      // Formato YYYY-MM-DD
      const [ano, mes, dia] = data.split('-');
      dataCorrigida = new Date(ano, mes - 1, dia, 12);
    } else {
      dataCorrigida = new Date(data);
    }

    const novoRegistro = new Passos({
      paciente: pacienteId,
      pacienteId: pacienteId,
      data: dataCorrigida,
      valor: Number(passos),
      passos: Number(passos) // Mantém para compatibilidade
    });

    await novoRegistro.save();
    res.status(201).json({ message: 'Registro de passos salvo com sucesso' });
  } catch (error) {
    console.error('Erro ao registrar passos:', error);
    res.status(500).json({ message: 'Erro ao registrar passos' });
  }
};

export const buscarPassosMedico = async (req, res) => {
  const paciente = req.paciente;
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    if (!paciente) {
      return res.status(404).json({ message: 'Paciente não encontrado' });
    }

    console.log('✅ Paciente encontrado:', paciente.name || paciente.nome, 'ID:', paciente._id);

    console.log('📅 Buscando registros entre:', startDate, 'e', endDate);

    // Buscar registros - o app mobile usa 'pacienteId' como string
    const pacienteIdString = paciente._id.toString();
    let registros = await Passos.find({
      $and: [
        {
          $or: [
            { paciente: paciente._id },
            { paciente: pacienteIdString },
            { pacienteId: paciente._id },
            { pacienteId: pacienteIdString }
          ]
        },
        {
          data: { $gte: startDate, $lt: endDate }
        }
      ]
    }).sort({ data: 1 });
    
    console.log('📊 Registros encontrados:', registros.length);

    const data = registros.map(r => {
      // Processar data - pode ser Date object ou ISO8601 string
      let dataRegistro;
      if (r.data instanceof Date) {
        dataRegistro = r.data;
      } else if (typeof r.data === 'string') {
        dataRegistro = new Date(r.data);
      } else {
        dataRegistro = new Date(r.data);
      }
      
      // Usar 'valor' se existir, senão usar 'passos' (compatibilidade)
      const passos = r.valor !== undefined && r.valor !== null ? r.valor : (r.passos || 0);
      
      return {
        dia: dataRegistro.getDate(),
        passos: passos
      };
    });

    console.log('📈 Dados processados:', data.length, 'registros');

    // Calcular estatísticas
    const total = data.length;
    const soma = data.reduce((acc, d) => acc + (d.passos || 0), 0);
    const media = total > 0 ? soma / total : 0;
    const meta = data.filter(d => {
      const p = d.passos || 0;
      return p >= 10000; // Meta de 10.000 passos por dia
    }).length;
    const acima = data.filter(d => {
      const p = d.passos || 0;
      return p > 10000; // Acima da meta
    }).length;

    const response = { 
      paciente: paciente.nome || paciente.name,
      data,
      stats: {
        total,
        media: Math.round(media),
        meta,
        acima
      }
    };
    
    console.log('✅ Resposta enviada:', { 
      paciente: response.paciente, 
      totalRegistros: response.data.length,
      stats: response.stats 
    });

    res.json(response);
  } catch (error) {
    console.error('Erro ao buscar dados de passos por CPF:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};

export const buscarPassosPaciente = async (req, res) => {
  const pacienteId = req.user.id;
  const { startDate, endDate } = resolveMonthYearQuery(req.query);

  try {
    const registros = await Passos.find({
      $or: [
        { paciente: pacienteId },
        { pacienteId: pacienteId }
      ],
      data: { $gte: startDate, $lt: endDate }
    }).sort({ data: 1 });

    const data = registros.map(r => {
      // Processar data - pode ser Date object ou ISO8601 string
      let dataRegistro;
      if (r.data instanceof Date) {
        dataRegistro = r.data;
      } else if (typeof r.data === 'string') {
        dataRegistro = new Date(r.data);
      } else {
        dataRegistro = new Date(r.data);
      }
      
      // Usar 'valor' se existir, senão usar 'passos' (compatibilidade)
      const passos = r.valor !== undefined && r.valor !== null ? r.valor : (r.passos || 0);
      
      return {
        dia: dataRegistro.getDate(),
        passos: passos
      };
    });

    res.json({ data });
  } catch (error) {
    console.error('Erro ao buscar dados de passos do próprio paciente:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
};



