/**
 * Busca médicos no portal CFM com navegador real (Playwright).
 *
 * O reCAPTCHA NÃO pode ser resolvido automaticamente de forma gratuita/legal.
 * Este script abre o Chrome, você marca o captcha UMA vez e clica em Buscar;
 * o script intercepta a resposta da API e salva o JSON.
 *
 * Instalação (uma vez):
 *   cd PulseFlow-Web/server
 *   npm install -D playwright
 *   npx playwright install chromium
 *
 * Uso:
 *   node scripts/fetch-medicos-cfm-browser.js --crm=194528 --uf=SP
 *   node scripts/fetch-medicos-cfm-browser.js --nome="João Silva"
 *   node scripts/fetch-medicos-cfm-browser.js --crm=12345 --uf=RJ --output=resultado.json
 *
 * O navegador abre visível. Preencha o captcha se o script não tiver preenchido tudo.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORTAL_URL = 'https://portal.cfm.org.br/busca-medicos/';

function parseArgs(argv) {
  const opts = { crm: '', uf: '', nome: '', output: '', headless: false, timeout: 120000 };
  for (const arg of argv) {
    if (arg.startsWith('--crm=')) opts.crm = arg.slice(6).replace(/\D/g, '');
    else if (arg.startsWith('--uf=')) opts.uf = arg.slice(5).trim().toUpperCase();
    else if (arg.startsWith('--nome=')) opts.nome = arg.slice(7).trim();
    else if (arg.startsWith('--output=')) opts.output = arg.slice(9).trim();
    else if (arg === '--headless') opts.headless = true;
    else if (arg.startsWith('--timeout=')) opts.timeout = parseInt(arg.slice(10), 10) || 120000;
    else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 20).join('\n'));
      process.exit(0);
    }
  }
  if (!opts.crm && !opts.nome) {
    console.error('Informe --crm e --uf OU --nome="..."');
    process.exit(1);
  }
  if (opts.crm && !opts.uf) {
    console.error('Com --crm informe também --uf=SP');
    process.exit(1);
  }
  return opts;
}

function normalizeCfm(d) {
  return {
    pais: 'BR',
    fonte: 'cfm',
    uf: d.SG_UF || d.uf,
    crm: d.NU_CRM || d.NU_REGISTRO || d.numero_registro,
    nome: d.NM_MEDICO || d.nome_razao_social || d.nome,
    situacao: d.SITUACAO || d.situacao || d.DS_SITUACAO,
    tipoInscricao: d.TP_INSCRICAO || d.tipo_inscricao,
    especialidades: d.DS_ESPECIALIDADE || d.especialidades || null,
    municipio: d.NM_MUNICIPIO || d.municipioMedico || null
  };
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    console.error(
      'Playwright não instalado. Rode:\n' +
        '  npm install -D playwright\n' +
        '  npx playwright install chromium'
    );
    process.exit(1);
  }
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const { chromium } = await loadPlaywright();

  let apiPayload = null;
  let apiError = null;

  const browser = await chromium.launch({ headless: opts.headless });
  const context = await browser.newContext({
    locale: 'pt-BR',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('buscar_medicos')) return;
    try {
      const text = await response.text();
      apiPayload = JSON.parse(text);
    } catch (e) {
      apiError = e.message;
    }
  });

  console.log('Abrindo portal CFM...');
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (opts.nome) {
    const nomeInput = page.locator('input[name*="nome" i], input[id*="nome" i]').first();
    if (await nomeInput.count()) await nomeInput.fill(opts.nome);
  }
  if (opts.crm) {
    const crmInput = page.locator('input[name*="crm" i], input[id*="crm" i]').first();
    if (await crmInput.count()) await crmInput.fill(opts.crm);
    const ufSelect = page.locator('select[name*="uf" i], select[id*="uf" i]').first();
    if (await ufSelect.count()) await ufSelect.selectOption(opts.uf);
  }

  console.log('\n>>> Resolva o reCAPTCHA no navegador e clique em ENVIAR/Buscar.');
  console.log('>>> Aguardando resposta da API (até', Math.round(opts.timeout / 1000), 's)...\n');

  const submit = page.locator('button[type="submit"], input[type="submit"], button:has-text("ENVIAR"), button:has-text("Buscar")').first();
  if (await submit.count()) {
    try {
      await submit.click({ timeout: 5000 });
    } catch {
      /* usuário pode clicar manualmente */
    }
  }

  const started = Date.now();
  while (!apiPayload && !apiError && Date.now() - started < opts.timeout) {
    await page.waitForTimeout(500);
  }

  await browser.close();

  if (apiError) {
    console.error('Erro ao ler resposta:', apiError);
    process.exit(1);
  }
  if (!apiPayload) {
    console.error('Tempo esgotado. Confirme que clicou em Buscar após o captcha.');
    process.exit(1);
  }

  const lista = apiPayload.dados || apiPayload.items || [];
  const items = (Array.isArray(lista) ? lista : []).map(normalizeCfm);
  const result = { total: items.length, items, raw: apiPayload };

  const text = JSON.stringify({ total: result.total, items: result.items }, null, 2);
  if (opts.output) {
    fs.writeFileSync(path.resolve(opts.output), text, 'utf8');
    console.log(`${items.length} médico(s) salvo(s) em ${opts.output}`);
  } else {
    console.log(text);
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
