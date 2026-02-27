import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initApp({ titleKey: 'escolhaPlano.title', activePage: 'configuracoes' });

  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/client/views/login.html';
    return;
  }

  let perfil;
  try {
    const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error();
    perfil = await res.json();
  } catch (e) {
    window.location.href = '/client/views/login.html';
    return;
  }

  if (perfil.validationStatus !== 'approved') {
    window.location.href = '/client/views/perfilMedico.html';
    return;
  }
  if (perfil.hasChosenPlan) {
    window.location.href = '/client/views/selecao.html';
    return;
  }

  async function choosePlan(option) {
    const btn = option === 'trial' ? document.getElementById('btnTrial') : document.getElementById('btnPaid');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${API_URL}/api/usuarios/perfil/choose-plan`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ option })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          title: t('escolhaPlano.successTitle', { fallback: 'Tudo certo!' }),
          text: data.message || (option === 'trial' ? t('escolhaPlano.trialSuccess', { fallback: 'Teste de 14 dias ativado.' }) : t('escolhaPlano.paidSuccess', { fallback: 'Em breve entraremos em contato.' })),
          icon: 'success',
          confirmButtonColor: '#002A42'
        }).then(() => {
          window.location.href = '/client/views/selecao.html';
        });
      } else {
        Swal.fire({ title: t('perfilMedico.swalError'), text: data.message || 'Erro', icon: 'error', confirmButtonColor: '#002A42' });
        if (btn) btn.disabled = false;
      }
    } catch (err) {
      Swal.fire({ title: t('perfilMedico.swalError'), text: t('validacao.submitError', { fallback: 'Erro. Tente novamente.' }), icon: 'error', confirmButtonColor: '#002A42' });
      if (btn) btn.disabled = false;
    }
  }

  document.getElementById('btnTrial')?.addEventListener('click', () => choosePlan('trial'));
  document.getElementById('btnPaid')?.addEventListener('click', () => choosePlan('paid'));
});
