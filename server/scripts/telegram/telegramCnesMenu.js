import {
  getEstadosCnes,
  getMunicipiosCnes,
  getMedicosPorMunicipio,
  formatMedicoTelegram
} from '../../lib/medicosMongoSearch.js';
import { clearConsultaCache } from '../../lib/consultaExterna.js';

const CITIES_PER_PAGE = 8;
const MEDICOS_PER_PAGE = 1;

/** @type {Map<string, { uf: string, cities: string[], cityPage: number }>} */
const sessions = new Map();

function userId(ctx) {
  return String(ctx.from?.id ?? '');
}

function chunkRows(items, perRow) {
  const rows = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }
  return rows;
}

async function showEstados(ctx, edit = false) {
  const ufs = await getEstadosCnes();
  if (!ufs.length) {
    const text = 'Nenhum estado no banco.\nUse /sync_cnes SP (admin) para baixar do DATASUS.';
    return edit ? ctx.editMessageText(text) : ctx.reply(text);
  }

  const buttons = ufs.map((uf) => ({
    text: uf,
    callback_data: `menu:uf:${uf}`
  }));
  const keyboard = chunkRows(buttons, 3);
  const text = '🗺️ Selecione o **estado (UF)**:';
  const extra = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };

  if (edit) await ctx.editMessageText(text, extra);
  else await ctx.reply(text, extra);
}

async function showCidades(ctx, uf, cityPage = 0, edit = true) {
  const ufUp = String(uf).toUpperCase();
  let cities = sessions.get(userId(ctx))?.cities;
  if (!cities || sessions.get(userId(ctx))?.uf !== ufUp) {
    cities = await getMunicipiosCnes(ufUp);
    sessions.set(userId(ctx), { uf: ufUp, cities, cityPage: 0 });
  }

  if (!cities.length) {
    return ctx.editMessageText(`Nenhuma cidade em ${ufUp}.`, {
      reply_markup: {
        inline_keyboard: [[{ text: '« Estados', callback_data: 'menu:e' }]]
      }
    });
  }

  const page = Math.max(0, cityPage);
  const start = page * CITIES_PER_PAGE;
  const slice = cities.slice(start, start + CITIES_PER_PAGE);
  const totalPages = Math.ceil(cities.length / CITIES_PER_PAGE);

  sessions.set(userId(ctx), { uf: ufUp, cities, cityPage: page });

  const cityButtons = slice.map((city, i) => {
    const idx = start + i;
    const label = city.length > 28 ? `${city.slice(0, 27)}…` : city;
    return [{ text: label, callback_data: `menu:city:${ufUp}:${idx}` }];
  });

  const nav = [];
  if (page > 0) nav.push({ text: '« Cidades', callback_data: `menu:cid:${ufUp}:${page - 1}` });
  if (page + 1 < totalPages) nav.push({ text: 'Cidades »', callback_data: `menu:cid:${ufUp}:${page + 1}` });

  const keyboard = [...cityButtons];
  if (nav.length) keyboard.push(nav);
  keyboard.push([{ text: '« Estados', callback_data: 'menu:e' }]);

  const text =
    `🏙️ **${ufUp}** — escolha a cidade\n` +
    `Página ${page + 1}/${totalPages} (${cities.length} cidades)`;

  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function showMedicos(ctx, uf, cityIdx, medPage = 1) {
  const ufUp = String(uf).toUpperCase();
  const sess = sessions.get(userId(ctx));
  const municipio = sess?.cities?.[cityIdx];
  if (!municipio) {
    return ctx.answerCbQuery('Sessão expirada. Use /estado');
  }

  const { items, page, totalPages, total } = await getMedicosPorMunicipio(
    ufUp,
    municipio,
    medPage,
    MEDICOS_PER_PAGE
  );

  clearConsultaCache();
  const body = items.length
    ? (
        await Promise.all(
          items.map(async (m, i) => {
            const bloco = await formatMedicoTelegram(m);
            return `${(page - 1) * MEDICOS_PER_PAGE + i + 1}.\n${bloco}`;
          })
        )
      ).join('\n\n')
    : 'Nenhum médico nesta página.';

  const text =
    `👨‍⚕️ ${municipio} / ${ufUp}\n` +
    `${total.toLocaleString('pt-BR')} registro(s) | página ${page}/${totalPages}\n\n` +
    body;

  const nav = [];
  if (page > 1) nav.push({ text: '« Médicos', callback_data: `menu:med:${ufUp}:${cityIdx}:${page - 1}` });
  if (page < totalPages) nav.push({ text: 'Médicos »', callback_data: `menu:med:${ufUp}:${cityIdx}:${page + 1}` });

  const keyboard = [];
  if (nav.length) keyboard.push(nav);
  keyboard.push([{ text: '« Cidades', callback_data: `menu:uf:${ufUp}` }]);
  keyboard.push([{ text: '« Estados', callback_data: 'menu:e' }]);

  await ctx.editMessageText(text.slice(0, 4000), {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

export function registerCnesMenu(bot) {
  bot.command('estado', async (ctx) => {
    try {
      await showEstados(ctx, false);
    } catch (e) {
      console.error('[Telegram] /estado:', e.message);
      await ctx.reply('Erro ao carregar estados.');
    }
  });

  bot.action(/^menu:.+$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const data = ctx.callbackQuery.data;
      const parts = data.split(':');

      if (data === 'menu:e' || data === 'menu:start') {
        await showEstados(ctx, true);
        return;
      }

      if (parts[1] === 'uf' && parts[2]) {
        const sess = sessions.get(userId(ctx));
        const pg = sess?.uf === parts[2] ? sess.cityPage || 0 : 0;
        await showCidades(ctx, parts[2], pg, true);
        return;
      }

      if (parts[1] === 'cid' && parts[2] && parts[3] !== undefined) {
        await showCidades(ctx, parts[2], parseInt(parts[3], 10), true);
        return;
      }

      if (parts[1] === 'city' && parts[2] && parts[3] !== undefined) {
        await showMedicos(ctx, parts[2], parseInt(parts[3], 10), 1);
        return;
      }

      if (parts[1] === 'med' && parts[2] && parts[3] !== undefined && parts[4] !== undefined) {
        await showMedicos(ctx, parts[2], parseInt(parts[3], 10), parseInt(parts[4], 10));
        return;
      }
    } catch (e) {
      console.error('[Telegram] menu:', e.message);
      await ctx.answerCbQuery('Erro. Tente /estado de novo.');
    }
  });
}
