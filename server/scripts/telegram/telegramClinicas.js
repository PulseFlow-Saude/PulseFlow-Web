import { buscarClinicas } from '../../lib/clinicasSearch.js';
import { isGooglePlacesEnabled } from '../../lib/googlePlacesSearch.js';
import CnesEstabelecimento from '../../models/CnesEstabelecimento.js';

async function replyClinicas(ctx, q) {
  await ctx.sendChatAction('typing');
  const { blocks, googleOk, googleError, mongoCount, googleEnabled } = await buscarClinicas(q, 5);

  if (!blocks.length) {
    let msg = `Nenhuma clínica para: ${q}\n\n`;
    if (mongoCount === 0) {
      msg += 'Baixe a base (grátis, sem Google):\n';
      msg += 'npm run sync-cnes-estabelecimentos -- --uf=SP';
    } else if (googleEnabled && !googleOk && googleError) {
      msg += `Google (opcional): ${googleError}`;
    }
    await ctx.reply(msg);
    return;
  }

  const body = blocks.map((b, i) => `--- ${i + 1} ---\n${b}`).join('\n\n');
  await ctx.reply(body.slice(0, 4000));
}

export function registerClinicasSearch(bot) {
  bot.command(['clinicas', 'clinica'], async (ctx) => {
    const q = ctx.payload?.trim();
    if (!q) {
      const total = await CnesEstabelecimento.estimatedDocumentCount();
      await ctx.reply(
        'Busca clínicas (sem Google — base CNES/DATASUS)\n' +
          'Nome, Endereço, Telefone, E-mail\n\n' +
          '/clinicas Campinas SP\n' +
          '/clinicas clínica São Paulo\n\n' +
          `Unidades no banco: ${total.toLocaleString('pt-BR')}\n` +
          (total === 0
            ? 'Importe: npm run sync-cnes-estabelecimentos -- --uf=SP'
            : 'Fonte: governo (grátis). Google só se CNES_CLINICAS_USE_GOOGLE=true')
      );
      return;
    }
    await replyClinicas(ctx, q);
  });

  bot.hears(/^(cl[ií]nicas?)\s+(.+)/i, async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    const q = ctx.match[2].trim();
    if (!q) return next();
    await replyClinicas(ctx, q);
  });
}
