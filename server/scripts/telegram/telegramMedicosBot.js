import mongoose from 'mongoose';
import { Telegraf } from 'telegraf';
import {
  onlyDigits,
  isMongoReady,
  countMedicosPulseflow,
  countMedicosCnes,
  searchAllMedicos,
  listCnesPage,
  exportCnesCsv,
  CNES_PAGE_SIZE,
  formatMedicoTelegram
} from '../../lib/medicosMongoSearch.js';
import { registerCnesMenu } from './telegramCnesMenu.js';
import { registerCnesSync, maybeAutoSyncCnes } from './telegramCnesSync.js';
import { registerClinicasSearch } from './telegramClinicas.js';
import { BOT_CONSULTA_API } from '../../lib/consultaExterna.js';

const START_KEYBOARD = {
  inline_keyboard: [
    [{ text: '🗺️ Médicos por estado', callback_data: 'menu:start' }],
    [{ text: '📋 Consultas disponíveis', callback_data: 'help:consultas' }]
  ]
};

function waitMongoReady(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (isMongoReady()) return resolve();
    const timer = setTimeout(() => reject(new Error('MongoDB não conectou a tempo')), timeoutMs);
    mongoose.connection.once('connected', () => {
      clearTimeout(timer);
      resolve();
    });
    mongoose.connection.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function checkMedicosMongo() {
  try {
    await waitMongoReady();
    const [pulse, cnes] = await Promise.all([countMedicosPulseflow(), countMedicosCnes()]);
    return { ok: true, pulse, cnes };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

export function startTelegramMedicosBot(options = {}) {
  const token = options.token || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const allowedIds = (options.allowedIds ?? process.env.TELEGRAM_ALLOWED_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const bot = new Telegraf(token);

  function authMiddleware(ctx, next) {
    if (!allowedIds.length) return next();
    const id = String(ctx.from?.id ?? '');
    if (allowedIds.includes(id)) return next();
    return ctx.reply('Acesso não autorizado.');
  }

  function parseQuery(text) {
    const t = text.trim();
    const lower = t.toLowerCase();
    if (lower.startsWith('/cpf')) return { type: 'cpf', value: t.replace(/^\/cpf\s*/i, '') };
    if (lower.startsWith('/email')) return { type: 'email', value: t.replace(/^\/email\s*/i, '') };
    if (lower.startsWith('/telefone') || lower.startsWith('/tel')) {
      return { type: 'telefone', value: t.replace(/^\/(telefone|tel)\s*/i, '') };
    }
    if (lower.startsWith('/cns')) return { type: 'cns', value: t.replace(/^\/cns\s*/i, '') };
    if (lower.startsWith('/crm')) return { type: 'crm', value: t.replace(/^\/crm\s*/i, '') };
    if (lower.startsWith('/nome')) return { type: 'nome', value: t.replace(/^\/nome\s*/i, '') };
    if (lower.startsWith('/listar')) return { type: 'listar', value: t.replace(/^\/listar\s*/i, '') };
    if (lower.startsWith('/exportar')) return { type: 'exportar', value: t.replace(/^\/exportar\s*/i, '') };
    if (lower.startsWith('/consulta_cpf')) {
      return { type: 'consulta_ext', ext: 'cpf', value: t.replace(/^\/consulta_cpf\s*/i, '') };
    }
    if (lower.startsWith('/consulta_cns')) {
      return { type: 'consulta_ext', ext: 'cns', value: t.replace(/^\/consulta_cns\s*/i, '') };
    }
    if (lower.startsWith('/consulta_nome')) {
      return { type: 'consulta_ext', ext: 'nome', value: t.replace(/^\/consulta_nome\s*/i, '') };
    }
    if (lower.startsWith('/consulta_nascimento')) {
      return { type: 'consulta_ext', ext: 'nascimento', value: t.replace(/^\/consulta_nascimento\s*/i, '') };
    }
    if (lower.startsWith('/consulta_falecimento')) {
      return { type: 'consulta_ext', ext: 'falecimento', value: t.replace(/^\/consulta_falecimento\s*/i, '') };
    }
    return null;
  }

  const HELP_CONSULTAS =
    `*API: Bot de Consultas*\n` +
    `${BOT_CONSULTA_API.baseUrl}\n\n` +
    `Envie *nome*, *e-mail*, *telefone* ou:\n` +
    `/nome …  /email …  /telefone …  /cpf …\n` +
    `/consulta_nome …\n\n` +
    `/estado — CNES por cidade\n` +
    `/stats — totais MongoDB\n` +
    `/sync_cnes — baixa DATASUS → MongoDB (admin)`;

  function guessSearch(text) {
    const v = text.trim();
    if (!v || v.startsWith('/')) return null;
    if (v.includes('@')) return { type: 'email', value: v };
    const digits = onlyDigits(v);
    if (digits.length === 11) return { type: 'cpf', value: digits };
    if (digits.length === 15) return { type: 'cns', value: digits };
    if (digits.length >= 10 && digits.length <= 13) return { type: 'telefone', value: digits };
    if (digits.length >= 4 && digits.length <= 7) return { type: 'crm', value: v };
    return { type: 'nome', value: v };
  }

  bot.use(authMiddleware);
  registerCnesMenu(bot);
  registerCnesSync(bot);
  registerClinicasSearch(bot);

  bot.start((ctx) => {
    const nome = ctx.from?.first_name || 'usuário';
    return ctx.reply(
      `🔹 *Médicos do Brasil — ${nome}*\n\n` +
        `Envie *nome*, *e-mail* ou *telefone* para buscar contato.\n` +
        `Ou use /email /telefone /nome /cpf\n\n` +
        `/estado — lista por cidade (CNES)\n` +
        `/sync_cnes — atualiza base do DATASUS (admin)\n` +
        `/clinicas — buscar clínicas (tipo Google)`,
      { parse_mode: 'Markdown', reply_markup: START_KEYBOARD }
    );
  });

  bot.action('help:consultas', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(HELP_CONSULTAS, { parse_mode: 'Markdown' });
  });

  bot.command('stats', async (ctx) => {
    const [pulse, cnes] = await Promise.all([countMedicosPulseflow(), countMedicosCnes()]);
    await ctx.reply(
      `PulseFlow: ${pulse.toLocaleString('pt-BR')}\n` +
        `CNES (Excel): ${cnes.toLocaleString('pt-BR')}\n\n` +
        (cnes === 0
          ? 'CNES vazio. Use /sync_cnes SP (admin) ou npm run sync-medicos-cnes'
          : '')
    );
  });

  const runSearch = async (ctx, type, value) => {
    if (!value?.trim()) {
      await ctx.reply(`Use: /${type} valor`);
      return;
    }
    try {
      const blocks = await searchAllMedicos(type, value);
      if (!blocks.length) {
        await ctx.reply(
          'Nenhum e-mail/telefone encontrado.\n' +
            'Tente /nome ou importe: npm run import-medicos-contatos'
        );
        return;
      }
      const text = blocks.map((b, i) => `--- ${i + 1} ---\n${b}`).join('\n\n').slice(0, 4000);
      await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (e) {
      console.error('[Telegram] busca:', e.message);
      await ctx.reply('Erro na consulta. Tente de novo.');
    }
  };

  const runConsultaExterna = async (ctx, tipo, value) => {
    await runSearch(ctx, tipo, value);
  };

  bot.command('cpf', (ctx) => runSearch(ctx, 'cpf', ctx.payload));
  bot.command('email', (ctx) => runSearch(ctx, 'email', ctx.payload));
  bot.command(['telefone', 'tel'], (ctx) => runSearch(ctx, 'telefone', ctx.payload));
  bot.command('cns', (ctx) => runSearch(ctx, 'cns', ctx.payload));
  bot.command('crm', (ctx) => runSearch(ctx, 'crm', ctx.payload));
  bot.command('nome', (ctx) => runSearch(ctx, 'nome', ctx.payload));

  bot.command('consulta_cpf', (ctx) => runConsultaExterna(ctx, 'cpf', ctx.payload));
  bot.command('consulta_cns', (ctx) => runConsultaExterna(ctx, 'cns', ctx.payload));
  bot.command('consulta_nome', (ctx) => runConsultaExterna(ctx, 'nome', ctx.payload));
  bot.command('consulta_nascimento', (ctx) => runConsultaExterna(ctx, 'nascimento', ctx.payload));
  bot.command('consulta_falecimento', (ctx) => runConsultaExterna(ctx, 'falecimento', ctx.payload));
  bot.command('ajuda', (ctx) => ctx.reply(HELP_CONSULTAS, { parse_mode: 'Markdown' }));

  async function replyListar(ctx, page) {
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const { items, page: current, totalPages, total } = await listCnesPage(p);
    if (!items.length) {
      await ctx.reply('CNES vazio. Use /sync_cnes SP (admin)');
      return;
    }
    const head =
      `📋 CNES — página ${current} de ${totalPages.toLocaleString('pt-BR')}\n` +
      `Total: ${total.toLocaleString('pt-BR')} | ${CNES_PAGE_SIZE} registros/página\n` +
      `Próxima: /listar ${current + 1}\n` +
      `CSV desta faixa: /exportar ${current}\n\n`;
    const body = (
      await Promise.all(items.map((m, i) => formatMedicoTelegram(m).then((t) => `--- ${i + 1} ---\n${t}`)))
    ).join('\n\n');
    await ctx.reply((head + body).slice(0, 4000), { parse_mode: 'Markdown' });
  }

  async function replyExportar(ctx, arg) {
    const a = String(arg || '').trim();
    const isPage = /^\d+$/.test(a);
    const { csv, count } = await exportCnesCsv(
      isPage ? { page: parseInt(a, 10) } : a ? { nome: a } : { page: 1 }
    );
    if (!count) {
      await ctx.reply('Nenhum registro para exportar.');
      return;
    }
    const name = isPage ? `cnes-pagina-${a}.csv` : `cnes-busca-${a.slice(0, 30)}.csv`;
    await ctx.replyWithDocument({ source: Buffer.from(csv, 'utf8'), filename: name });
    await ctx.reply(`${count} linha(s) — colunas: nome, cpf, cns, cbo, uf, municipio, conselho, registroConselho, codigoEstabelecimentoCnes, fonte, competencia`);
  }

  bot.command('listar', async (ctx) => {
    try {
      await replyListar(ctx, ctx.payload || '1');
    } catch (e) {
      console.error('[Telegram] listar:', e.message);
      await ctx.reply('Erro ao listar.');
    }
  });

  bot.command('exportar', async (ctx) => {
    try {
      await replyExportar(ctx, ctx.payload);
    } catch (e) {
      console.error('[Telegram] exportar:', e.message);
      await ctx.reply('Erro ao exportar.');
    }
  });

  bot.on('text', async (ctx) => {
    const parsed = parseQuery(ctx.message.text);
    if (parsed?.type === 'listar') {
      try {
        await replyListar(ctx, parsed.value || '1');
      } catch (e) {
        await ctx.reply('Erro ao listar.');
      }
      return;
    }
    if (parsed?.type === 'exportar') {
      try {
        await replyExportar(ctx, parsed.value);
      } catch (e) {
        await ctx.reply('Erro ao exportar.');
      }
      return;
    }
    if (parsed?.type === 'consulta_ext') {
      await runConsultaExterna(ctx, parsed.ext, parsed.value);
      return;
    }
    const search = parsed || guessSearch(ctx.message.text);
    if (!search?.value) return;
    await runSearch(ctx, search.type, search.value);
  });

  waitMongoReady()
    .then(async () => {
      const [pulse, cnes] = await Promise.all([countMedicosPulseflow(), countMedicosCnes()]);
      console.log(
        `[Telegram] PulseFlow: ${pulse.toLocaleString('pt-BR')} | CNES: ${cnes.toLocaleString('pt-BR')}`
      );
      if (cnes === 0) {
        console.warn('[Telegram] CNES vazio — use /sync_cnes no Telegram ou npm run sync-medicos-cnes');
      }

      maybeAutoSyncCnes((msg) => console.log(msg)).catch((e) => {
        console.warn('[CNES] Auto-sync falhou:', e.message);
      });

      await bot.launch();
      console.log('[Telegram] Bot ativo');
      console.log(`[Telegram] API consultas: ${BOT_CONSULTA_API.baseUrl}`);
    })
    .catch((err) => {
      console.warn('[Telegram] Bot não iniciado:', err.message);
    });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}
