import PaymentTransaction from '../models/PaymentTransaction.js';

function escapeCsvCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function getFinancialSummary(req, res) {
  try {
    const [totals] = await PaymentTransaction.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalGross: { $sum: '$amountGross' },
          totalNet: { $sum: '$netAmount' },
          totalPlatformFees: { $sum: '$platformFeeAmount' },
          totalGatewayFees: { $sum: '$gatewayFeeAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const byMethod = await PaymentTransaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$method', count: { $sum: 1 }, gross: { $sum: '$amountGross' } } }
    ]);

    const byCycle = await PaymentTransaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$billingCycle', count: { $sum: 1 }, gross: { $sum: '$amountGross' } } }
    ]);

    res.json({
      totals: totals || {
        totalGross: 0,
        totalNet: 0,
        totalPlatformFees: 0,
        totalGatewayFees: 0,
        count: 0
      },
      byMethod,
      byCycle
    });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao resumir financeiro' });
  }
}

export async function listTransactions(req, res) {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(String(req.query.limit || '20'), 10) || 20));
    const method = req.query.method === 'pix' || req.query.method === 'card' ? req.query.method : null;
    const q = req.query.q && String(req.query.q).trim() ? String(req.query.q).trim() : '';

    const filter = { status: 'completed' };
    if (method) filter.method = method;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ userEmail: rx }, { userNome: rx }];
    }

    const total = await PaymentTransaction.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;

    const items = await PaymentTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      items,
      total,
      page,
      limit,
      totalPages
    });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Erro ao listar transações' });
  }
}

export async function exportTransactionsCsv(req, res) {
  try {
    const rows = await PaymentTransaction.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const header = [
      'createdAt',
      'userEmail',
      'userNome',
      'amountGross',
      'currency',
      'billingCycle',
      'method',
      'cardLast4',
      'cardModality',
      'pixKeyType',
      'platformFeeAmount',
      'gatewayFeeAmount',
      'netAmount',
      'transactionId'
    ];
    const lines = [header.join(',')];
    for (const r of rows) {
      const vals = [
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
        r.userEmail,
        r.userNome,
        r.amountGross,
        r.currency,
        r.billingCycle,
        r.method,
        r.cardLast4,
        r.cardModality,
        r.pixKeyType,
        r.platformFeeAmount,
        r.gatewayFeeAmount,
        r.netAmount,
        r._id ? String(r._id) : ''
      ].map(escapeCsvCell);
      lines.push(vals.join(','));
    }
    const csv = lines.join('\r\n') + '\r\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pulseflow-transacoes.csv"');
    res.send('\uFEFF' + csv);
  } catch (e) {
    res.status(500).send(e.message || 'Erro');
  }
}
