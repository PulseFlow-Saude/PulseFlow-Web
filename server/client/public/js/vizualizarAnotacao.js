import { t, getLanguage } from './i18n.js';
import { API_URL } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Carrega dados do médico logado primeiro
  let medicoLogado = null;
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error(t('vizualizacaoAnotacao.tokenNaoEncontrado'));

    const res = await fetch(`${API_URL}/api/usuarios/perfil`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Erro ao carregar dados do médico');
    }

    medicoLogado = await res.json();
    const prefixo = medicoLogado.genero?.toLowerCase() === 'feminino' ? t('vizualizacaoAnotacao.prefixoDra') : t('vizualizacaoAnotacao.prefixoDr');
    const nomeFormatado = `${prefixo} ${medicoLogado.nome}`;
    
    // Atualiza o nome na sidebar
    const tituloSidebar = document.getElementById('medicoNomeSidebar');
    if (tituloSidebar) {
      tituloSidebar.textContent = nomeFormatado;
    }

    // Não atualiza o campo médico responsável aqui - será atualizado depois com os dados da API

  } catch (error) {
    console.error("Erro ao carregar dados do médico:", error);
    const fallback = document.getElementById('medicoNomeSidebar');
    if (fallback) {
      fallback.textContent = t('vizualizacaoAnotacao.nomeNaoEncontrado');
    }
    mostrarAviso(t('vizualizacaoAnotacao.erroCarregarMedico'));
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const anotacaoId = urlParams.get('id');
    console.log('Buscando anotação com ID:', anotacaoId);

    if (!anotacaoId) {
      mostrarAviso(t('vizualizacaoAnotacao.idNaoEncontrado'));
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      mostrarAviso(t('vizualizacaoAnotacao.tokenNaoEncontrado'));
      return;
    }

    const response = await fetch(`${API_URL}/api/anotacoes/detalhe/${anotacaoId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || t('vizualizacaoAnotacao.erroBuscarDetalhes'));
    }

    const anotacao = await response.json();
    console.log('Dados da anotação:', anotacao);
    console.log('Tipo de consulta recebido:', anotacao.tipoConsulta);
    console.log('Médico recebido:', anotacao.medico);

    // Se a interface está em inglês, traduzir título e conteúdo do registro
    let tituloExibir = anotacao.titulo || t('vizualizacaoAnotacao.registroClinicoFallback');
    let conteudoExibir = anotacao.anotacao || t('vizualizacaoAnotacao.semAnotacao');
    if (getLanguage() === 'en' && (anotacao.titulo || anotacao.anotacao)) {
      try {
        const tokenAuth = localStorage.getItem('token');
        if (tokenAuth) {
          if (anotacao.titulo && anotacao.titulo.trim()) {
            const resTitulo = await fetch(`${API_URL}/api/gemini/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAuth}` },
              body: JSON.stringify({ text: anotacao.titulo, lang: 'en' })
            });
            if (resTitulo.ok) {
              const dataT = await resTitulo.json();
              if (dataT.translated) tituloExibir = dataT.translated;
            }
          }
          if (anotacao.anotacao && anotacao.anotacao.trim()) {
            const resConteudo = await fetch(`${API_URL}/api/gemini/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAuth}` },
              body: JSON.stringify({ text: anotacao.anotacao, lang: 'en' })
            });
            if (resConteudo.ok) {
              const dataC = await resConteudo.json();
              if (dataC.translated) conteudoExibir = dataC.translated;
            }
          }
        }
      } catch (err) {
        console.warn('Tradução do registro não disponível, exibindo texto original:', err);
      }
    }

    // Atualiza os elementos com os dados da anotação
    // Atualiza o título no elemento oculto (para compatibilidade)
    const tituloElement = document.querySelector('.titulo');
    if (tituloElement) {
      tituloElement.innerHTML = `
        <strong>${t('vizualizacaoAnotacao.motivoConsulta')}</strong>
        <span>${tituloExibir}</span>
      `;
    }
    
    // Atualiza o título no elemento visível
    const tituloAnotacao = document.getElementById('tituloAnotacao');
    if (tituloAnotacao) {
      tituloAnotacao.textContent = tituloExibir;
    }
    
    // Formatação correta da data usando UTC
    const data = new Date(anotacao.data);
    const dataFormatada = `${data.getUTCDate().toString().padStart(2, '0')}/${(data.getUTCMonth() + 1).toString().padStart(2, '0')}/${data.getUTCFullYear()}`;
    const dataElement = document.querySelector('.data');
    if (dataElement) {
      dataElement.textContent = anotacao.data ? dataFormatada : t('vizualizacaoAnotacao.dataNaoInformada');
    }
    
    const categoriaElement = document.querySelector('.categoria');
    if (categoriaElement) {
      categoriaElement.textContent = anotacao.categoria || t('vizualizacaoAnotacao.categoriaNaoInformada');
    }
    
    // Função para formatar o tipo de consulta
    const formatarTipoConsulta = (tipo) => {
      if (!tipo) return t('vizualizacaoAnotacao.tipoNaoInformado');
      
      const tipos = {
        'primeira': t('vizualizacaoAnotacao.motivoPrimeira'),
        'rotina': t('vizualizacaoAnotacao.motivoRotina'),
        'preventiva': t('vizualizacaoAnotacao.motivoPreventiva'),
        'urgencia': t('vizualizacaoAnotacao.motivoUrgencia'),
        'retorno': t('vizualizacaoAnotacao.motivoRetorno'),
        'segundaOpniao': t('vizualizacaoAnotacao.motivoSegundaOpniao'),
        'acompanhamento': t('vizualizacaoAnotacao.motivoAcompanhamento'),
        'exame': t('vizualizacaoAnotacao.motivoExame')
      };
      
      // Normaliza o valor para minúsculas para busca
      const tipoNormalizado = tipo.toLowerCase().trim();
      
      // Se encontrar no mapeamento, retorna o texto formatado
      if (tipos[tipoNormalizado]) {
        return tipos[tipoNormalizado];
      }
      
      // Se não encontrar no mapeamento, retorna o valor original formatado
      return tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/([A-Z])/g, ' $1').trim();
    };
    
    // Usa tipoConsulta (camelCase) que é o nome correto do campo no modelo
    const tipoConsulta = anotacao.tipoConsulta || anotacao.tipo_consulta;
    const tipoConsultaElement = document.querySelector('.tipo-consulta');
    if (tipoConsultaElement) {
      const tipoFormatado = formatarTipoConsulta(tipoConsulta);
      tipoConsultaElement.textContent = tipoFormatado;
      console.log('Tipo de consulta formatado:', tipoFormatado);
    } else {
      console.error('Elemento .tipo-consulta não encontrado no DOM');
    }
    
    // Atualiza o nome do médico responsável usando o valor da API
    // Se a API retornar o nome do médico, usa ele, senão usa o médico logado como fallback
    const medicoNome = document.querySelector('.medico-nome');
    if (medicoNome) {
      if (anotacao.medico) {
        // Se a API já retornou o nome formatado do médico, usa ele
        medicoNome.textContent = anotacao.medico;
        console.log('Médico responsável definido da API:', anotacao.medico);
      } else if (medicoLogado) {
        // Fallback: usa o médico logado
        const prefixo = medicoLogado.genero?.toLowerCase() === 'feminino' ? 'Dra.' : 'Dr.';
        const nomeFormatado = `${prefixo} ${medicoLogado.nome}`;
        medicoNome.textContent = nomeFormatado;
        console.log('Médico responsável definido do médico logado:', nomeFormatado);
      } else {
        medicoNome.textContent = t('vizualizacaoAnotacao.medicoNaoInformado');
      }
    } else {
      console.error('Elemento .medico-nome não encontrado no DOM');
    }
    
    // Atualiza o conteúdo da anotação no elemento oculto (para compatibilidade)
    const anotacaoPElement = document.querySelector('.anotacao p');
    if (anotacaoPElement) {
      anotacaoPElement.textContent = conteudoExibir;
    }
    
    // Atualiza o conteúdo da anotação no elemento visível
    const conteudoAnotacao = document.getElementById('conteudoAnotacao');
    if (conteudoAnotacao) {
      conteudoAnotacao.textContent = conteudoExibir;
    }

  } catch (error) {
    console.error('Erro:', error);
    mostrarAviso(error.message || t('vizualizacaoAnotacao.erroBuscarDetalhes'));
  }
});

// Função para baixar o registro clínico como PDF
function downloadClinicalRecordAsPdf() {
  console.log('Botão Salvar PDF clicado.');
  const element = document.querySelector('.note-card');

  if (element) {
    console.log('Elemento .note-card encontrado. Iniciando conversão para PDF.', element);

    const clone = element.cloneNode(true);
    const container = document.createElement('div');
    container.style.padding = '20px';

    // Remover o logo duplicado do clone
    const duplicateLogo = clone.querySelector('.logo');
    if (duplicateLogo) {
        duplicateLogo.remove();
    }

    // Adicionar o logo e nome da empresa
    const logoElement = document.querySelector('.header .logo img');
    if (logoElement) {
        const headerContent = document.createElement('div');
        headerContent.style.textAlign = 'center';
        headerContent.style.marginBottom = '20px';
        
        const logoClone = logoElement.cloneNode(true);
        logoClone.style.height = '60px';
        headerContent.appendChild(logoClone);
        container.appendChild(headerContent);
    }

    // Hide buttons before generating PDF - apply to the cloned element
    const buttonsToHide = clone.querySelectorAll('.card-footer button, .btn-primary, .btn-secondary');
    buttonsToHide.forEach(button => {
      button.style.display = 'none';
    });

    container.appendChild(clone);

    // Configurações para html2pdf
    const options = {
      margin: 10,
      filename: 'registro_clinico.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        logging: true,
        dpi: 192,
        letterRendering: true,
        useCORS: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(container).set(options).save().then(() => {
      // Show buttons again after PDF is generated (on the original element)
      const originalButtons = element.querySelectorAll('.card-footer button, .btn-primary, .btn-secondary');
      originalButtons.forEach(button => {
        button.style.display = '';
      });
      container.remove(); // Clean up the temporary container
    }).catch(error => {
        console.error('Erro ao gerar PDF:', error);
        mostrarAviso(t('vizualizacaoAnotacao.erroGerarPDFAviso'));
        container.remove(); // Ensure container is removed even on error
    });

  } else {
    console.log('Elemento .note-card não encontrado.');
    mostrarAviso(t('vizualizacaoAnotacao.conteudoNaoEncontradoPDF'));
  }
}

// Função para mostrar mensagem de aviso
function mostrarAviso(mensagem) {
  const aviso = document.createElement('div');
  aviso.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #ffffff;
    color: #002A42;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 42, 66, 0.1);
    z-index: 1000;
    font-family: 'Montserrat', sans-serif;
    font-size: 14px;
    border: 1px solid #e1e5eb;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 300px;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
  `;

  // Ícone de alerta
  const icon = document.createElement('div');
  icon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #00c3b7;">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  // Container do texto
  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    flex: 1;
    line-height: 1.4;
  `;
  textContainer.textContent = mensagem;

  // Botão de fechar
  const closeButton = document.createElement('button');
  closeButton.style.cssText = `
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  `;
  closeButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeButton.onclick = () => {
    aviso.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(aviso);
      document.head.removeChild(style);
    }, 300);
  };

  // Adiciona os elementos ao aviso
  aviso.appendChild(icon);
  aviso.appendChild(textContainer);
  aviso.appendChild(closeButton);
  document.body.appendChild(aviso);

  // Adiciona estilo para a animação
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Remove o aviso após 5 segundos
  setTimeout(() => {
    if (document.body.contains(aviso)) {
      aviso.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (document.body.contains(aviso)) {
          document.body.removeChild(aviso);
          document.head.removeChild(style);
        }
      }, 300);
    }
  }, 5000);
}

async function deleteAnnotation() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const anotacaoId = urlParams.get('id');
    
    if (!anotacaoId) {
      mostrarAviso(t('vizualizacaoAnotacao.idNaoEncontrado'));
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      mostrarAviso(t('vizualizacaoAnotacao.tokenNaoEncontrado'));
      return;
    }

    const confirmacao = confirm(t('vizualizacaoAnotacao.confirmarExcluir'));
    if (!confirmacao) {
      return;
    }

    const response = await fetch(`${API_URL}/api/anotacoes/${anotacaoId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || t('vizualizacaoAnotacao.erroExcluir'));
    }

    mostrarAviso(t('vizualizacaoAnotacao.anotacaoExcluidaSucesso'));
    setTimeout(() => {
      window.location.href = 'historicoProntuario.html';
    }, 1500);

  } catch (error) {
    console.error('Erro:', error);
    mostrarAviso(error.message || t('vizualizacaoAnotacao.erroExcluir'));
  }
}

// Adicionar event listeners para os botões (aguarda o DOM estar pronto)
document.addEventListener('DOMContentLoaded', () => {
  const btnExcluir = document.getElementById('btnExcluir');
  if (btnExcluir) {
    // Remove o onclick inline se existir
    btnExcluir.removeAttribute('onclick');
    btnExcluir.addEventListener('click', () => {
      Swal.fire({
        title: t('vizualizacaoAnotacao.excluirAnotacaoTitle'),
        text: t('vizualizacaoAnotacao.excluirAnotacaoText'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: t('vizualizacaoAnotacao.simExcluir'),
        cancelButtonText: t('vizualizacaoAnotacao.cancelar'),
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d'
      }).then((result) => {
        if (result.isConfirmed) {
          deleteAnnotation();
        }
      });
    });
  }

  const btnSalvarPDF = document.getElementById('btnSalvarPDF');
  if (btnSalvarPDF) {
    btnSalvarPDF.addEventListener('click', async () => {
    try {
        Swal.fire({
            title: t('vizualizacaoAnotacao.gerandoPDF'),
            text: t('vizualizacaoAnotacao.aguardePDF'),
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => { Swal.showLoading(); }
        });

        // Coletar textos atuais da tela (já traduzidos se EN)
        const titulo = document.getElementById('tituloAnotacao')?.textContent?.trim() || t('vizualizacaoAnotacao.registroClinicoFallback');
        const dataAtend = document.querySelector('.info-item .data')?.textContent?.trim() || '';
        const especialidade = document.querySelector('.info-item .categoria')?.textContent?.trim() || '';
        const tipoConsulta = document.querySelector('.info-item .tipo-consulta')?.textContent?.trim() || '';
        const medico = document.querySelector('.info-item .medico-nome')?.textContent?.trim() || '';
        const conteudo = document.getElementById('conteudoAnotacao')?.textContent?.trim() || '';

        const agora = new Date();
        const lang = getLanguage();
        const localeDate = lang === 'en' ? 'en-US' : 'pt-BR';
        const dataFormatada = agora.toLocaleDateString(localeDate, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const horaFormatada = agora.toLocaleTimeString(localeDate, { hour: '2-digit', minute: '2-digit' });
        const docGerado = t('vizualizacaoAnotacao.documentoGeradoEm', { date: dataFormatada, time: horaFormatada });

        // Carregar logo em base64 (tenta pulseLogo.png ou logoMiniatura.png)
        let logoBase64 = null;
        const logoPaths = ['/client/public/assets/pulseLogo.png', '/client/public/assets/logoMiniatura.png'];
        for (const path of logoPaths) {
          try {
            const logoUrl = path.startsWith('http') ? path : (window.location.origin + path);
            const logoRes = await fetch(logoUrl);
            if (logoRes.ok) {
              const blob = await logoRes.blob();
              logoBase64 = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(blob);
              });
              break;
            }
          } catch (e) {
            continue;
          }
        }

        const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (!JsPDF) {
          throw new Error('Biblioteca jsPDF não carregada');
        }
        const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const margin = 22;
        const pageW = 210;
        const pageH = 297;
        const maxW = pageW - margin * 2;
        let y = 0;

        // Cores da marca
        const brandDark = [0, 42, 66];      // #002A42
        const brandLight = [0, 195, 183];   // #00c3b7 (teal)
        const textDark = [15, 23, 42];      // #0f172a
        const textMuted = [100, 116, 139]; // #64748b
        const borderLight = [226, 232, 240]; // #e2e8f0
        const bgLight = [248, 250, 252];    // #f8fafc

        // ----- Faixa superior (cabeçalho profissional) -----
        const headerH = 28;
        doc.setFillColor(...brandDark);
        doc.rect(0, 0, pageW, headerH);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', margin, 5, 24, 10);
          doc.setFontSize(14);
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.text(t('vizualizacaoAnotacao.registroClinico'), pageW - margin - 2, 14, { align: 'right' });
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(200, 220, 230);
          doc.text(docGerado, pageW - margin - 2, 21, { align: 'right' });
        } else {
          doc.setFontSize(18);
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.text('PulseFlow', margin, 12);
          doc.setFontSize(11);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(200, 220, 230);
          doc.text(t('vizualizacaoAnotacao.registroClinico'), margin, 19);
          doc.setFontSize(8);
          doc.text(docGerado, margin, 24);
        }
        y = headerH + 18;

        // ----- Título do registro -----
        doc.setFontSize(15);
        doc.setTextColor(...textDark);
        doc.setFont(undefined, 'bold');
        const tituloLines = doc.splitTextToSize(titulo, maxW);
        doc.text(tituloLines, margin, y);
        y += tituloLines.length * 6.5 + 14;

        // ----- Bloco de informações (card com borda lateral na cor da marca) -----
        const infoBoxH = 42;
        doc.setFillColor(...bgLight);
        doc.rect(margin, y, maxW, infoBoxH);
        doc.setDrawColor(...borderLight);
        doc.setLineWidth(0.2);
        doc.rect(margin, y, maxW, infoBoxH);
        doc.setFillColor(...brandDark);
        doc.rect(margin, y, 3, infoBoxH);
        y += 10;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...textMuted);
        const pad = margin + 6;
        doc.text(t('vizualizacaoAnotacao.dataAtendimento'), pad, y);
        doc.setTextColor(...textDark);
        doc.text(dataAtend, pad + 52, y);
        y += 8;
        doc.setTextColor(...textMuted);
        doc.text(t('vizualizacaoAnotacao.especialidade'), pad, y);
        doc.setTextColor(...textDark);
        doc.text(especialidade, pad + 52, y);
        y += 8;
        doc.setTextColor(...textMuted);
        doc.text(t('vizualizacaoAnotacao.tipoConsulta'), pad, y);
        doc.setTextColor(...textDark);
        doc.text(tipoConsulta, pad + 52, y);
        y += 8;
        doc.setTextColor(...textMuted);
        doc.text(t('vizualizacaoAnotacao.medicoResponsavel'), pad, y);
        doc.setTextColor(...textDark);
        doc.text(medico, pad + 52, y);
        y += 20;

        // ----- Linha separadora sutil -----
        doc.setDrawColor(...borderLight);
        doc.setLineWidth(0.4);
        doc.line(margin, y, pageW - margin, y);
        y += 12;

        // ----- Seção Registro Clínico -----
        doc.setFontSize(11);
        doc.setTextColor(...brandDark);
        doc.setFont(undefined, 'bold');
        doc.text(t('vizualizacaoAnotacao.registroClinico'), margin, y);
        y += 10;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(...textDark);
        const conteudoLines = doc.splitTextToSize(conteudo || '-', maxW);
        const lineHeight = 5.5;
        for (let i = 0; i < conteudoLines.length; i++) {
          if (y > pageH - margin - 22) {
            doc.addPage();
            y = margin;
            doc.setDrawColor(...borderLight);
            doc.setLineWidth(0.2);
            doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
            doc.setFontSize(7);
            doc.setTextColor(...textMuted);
            doc.text('PulseFlow · ' + t('vizualizacaoAnotacao.registroClinico'), pageW / 2, pageH - 8, { align: 'center' });
          }
          doc.text(conteudoLines[i], margin, y);
          y += lineHeight;
        }

        // ----- Rodapé primeira página -----
        doc.setDrawColor(...borderLight);
        doc.setLineWidth(0.2);
        doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        doc.text('PulseFlow · ' + t('vizualizacaoAnotacao.registroClinico'), pageW / 2, pageH - 8, { align: 'center' });

        const filename = `registro-clinico-${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);

        Swal.fire({
            icon: 'success',
            title: t('vizualizacaoAnotacao.pdfGerado'),
            text: t('vizualizacaoAnotacao.pdfSalvoSucesso'),
            confirmButtonColor: '#002A42'
        });

    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        Swal.fire({
            icon: 'error',
            title: t('vizualizacaoAnotacao.erro'),
            text: t('vizualizacaoAnotacao.erroGerarPDF'),
            confirmButtonColor: '#002A42'
        });
    }
    });
  }

  const btnImprimir = document.getElementById('btnImprimir');
  if (btnImprimir) {
    btnImprimir.addEventListener('click', () => {
      window.print();
    });
  }
});