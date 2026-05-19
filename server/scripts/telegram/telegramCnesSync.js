import {
  syncCnesFromDatasus,
  parseUfsFromEnv,
  UFS_BR,
  shouldAutoSyncOnStart
} from '../../lib/cnesDatasusSync.js';
import { countMedicosCnes } from '../../lib/medicosMongoSearch.js';

/** Evita dois syncs simultâneos. */
let syncEmAndamento = false;

function syncAdminIds() {
  const raw = process.env.CNES_SYNC_ADMIN_IDS || process.env.TELEGRAM_ALLOWED_IDS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function canSync(ctx) {
  const ids = syncAdminIds();
  if (!ids.length) return false;
  return ids.includes(String(ctx.from?.id ?? ''));
}

function parseUfsArg(payload) {
  if (!payload?.trim()) return parseUfsFromEnv();
  return payload
    .split(/[,\s]+/)
    .map((u) => u.trim().toUpperCase())
    .filter((u) => UFS_BR.includes(u));
}

export function registerCnesSync(bot) {
  bot.command('sync_cnes', async (ctx) => {
    if (!canSync(ctx)) {
      await ctx.reply(
        '⛔ Sincronização restrita a administradores.\n' +
          'Defina `CNES_SYNC_ADMIN_IDS` ou `TELEGRAM_ALLOWED_IDS` no .env com seu ID do Telegram.'
      );
      return;
    }
    if (syncEmAndamento) {
      await ctx.reply('⏳ Já há uma sincronização em andamento. Aguarde terminar.');
      return;
    }

    const ufs = parseUfsArg(ctx.payload);
    if (!ufs.length) {
      await ctx.reply(
        `Informe UF(s): \`/sync_cnes SP\` ou \`/sync_cnes SP,RJ\`\n` +
          `Padrão (.env CNES_SYNC_UFS): ${parseUfsFromEnv().join(', ') || 'SP'}`
      );
      return;
    }

    syncEmAndamento = true;
    const statusMsg = await ctx.reply(
      `🔄 *Sincronização CNES*\n` +
        `Fonte: cnes.datasus.gov.br\n` +
        `UFs: ${ufs.join(', ')}\n\n` +
        `Iniciando download...`,
      { parse_mode: 'Markdown' }
    );

    const editStatus = async (text) => {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, text.slice(0, 4000), {
          parse_mode: 'Markdown'
        });
      } catch {
        /* mensagem igual ou muito longa */
      }
    };

    try {
      const result = await syncCnesFromDatasus({
        ufs,
        onProgress: async (msg) => {
          await editStatus(
            `🔄 *Sincronização CNES*\n` +
              `UFs: ${ufs.join(', ')}\n\n` +
              msg
          );
        }
      });

      const linhas = Object.entries(result.byUf)
        .map(([uf, n]) => `• ${uf}: ${n.toLocaleString('pt-BR')}`)
        .join('\n');
      const erros = result.errors.map((e) => `• ${e.uf}: ${e.error}`).join('\n');

      await editStatus(
        `✅ *Sincronização concluída*\n\n` +
          `${linhas || 'Nenhum registro novo.'}\n\n` +
          `Total nesta sync: ${result.total.toLocaleString('pt-BR')}\n` +
          `Total no MongoDB: ${result.grandTotal.toLocaleString('pt-BR')}` +
          (erros ? `\n\n⚠️ Falhas:\n${erros}` : '')
      );
    } catch (e) {
      await editStatus(`❌ Erro: ${e.message || e}`);
    } finally {
      syncEmAndamento = false;
    }
  });

  bot.command('sync_status', async (ctx) => {
    const total = await countMedicosCnes();
    const ufs = parseUfsFromEnv();
    await ctx.reply(
      `📊 *Base CNES*\n` +
        `Registros: ${total.toLocaleString('pt-BR')}\n` +
        `UF padrão (sync): ${ufs.join(', ') || 'SP'}\n\n` +
        `Atualizar: \`/sync_cnes\` ou \`/sync_cnes SP\`\n` +
        `(somente admins)`,
      { parse_mode: 'Markdown' }
    );
  });
}

export async function maybeAutoSyncCnes(onLog = console.log) {
  const count = await countMedicosCnes();
  if (!shouldAutoSyncOnStart(count)) return null;
  if (syncEmAndamento) return null;

  const ufs = parseUfsFromEnv();
  onLog(`[CNES] Auto-sync (${count === 0 ? 'banco vazio' : 'CNES_AUTO_SYNC'}): ${ufs.join(', ')}`);

  syncEmAndamento = true;
  try {
    return await syncCnesFromDatasus({
      ufs,
      onProgress: (msg) => onLog(`[CNES] ${msg}`)
    });
  } finally {
    syncEmAndamento = false;
  }
}
