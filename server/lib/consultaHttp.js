import https from 'https';
import http from 'http';
import { URL } from 'url';

/** GET na API de consultas (SSL verify off, timeout 10s). */
export function httpGet(urlString, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch (e) {
      reject(new Error(`URL inválida: ${e.message}`));
      return;
    }

    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.get(
      urlString,
      {
        rejectUnauthorized: false,
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'PulseFlow-Consulta/1.0',
          Accept: 'application/json, text/plain, */*'
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, body });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout (10s)'));
    });

    req.on('error', (err) => {
      const code = err.code || '';
      if (code === 'ENOTFOUND') {
        reject(
          new Error(
            `Domínio não encontrado (${parsed.hostname}). ` +
              `O site da API pode estar fora do ar. ` +
              `Confira CONSULTA_API_BASE_URL no .env.`
          )
        );
      } else if (code === 'ECONNREFUSED') {
        reject(new Error(`Conexão recusada em ${parsed.hostname}`));
      } else if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        reject(new Error(`Erro SSL em ${parsed.hostname}: ${err.message}`));
      } else {
        reject(new Error(err.message || String(err)));
      }
    });
  });
}
