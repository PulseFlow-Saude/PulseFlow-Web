import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';

function destroyImaskIfAny(el) {
    if (!el) return;
    try {
        const m = el.mask;
        if (m && typeof m.destroy === 'function') m.destroy();
    } catch (_) {}
}

function setPerfilCountryMode(country) {
    const isUS = country === 'US';
    document.body.classList.toggle('perfil-country-us', isUS);
    document.body.classList.toggle('perfil-country-br', !isUS);
}

function applyPerfilFieldMasks(medico) {
    const isUS = medico.country === 'US';
    const telEl = document.getElementById('telefone');
    const telCons = document.getElementById('telefoneConsultorio');
    const cepEl = document.getElementById('cep');
    const cpfEl = document.getElementById('cpf');

    [telEl, telCons, cepEl, cpfEl].forEach(destroyImaskIfAny);

    if (isUS) {
        IMask(telEl, { mask: '(000) 000-0000' });
        IMask(telCons, { mask: '(000) 000-0000' });
        IMask(cepEl, { mask: ['00000', '00000-0000'] });
    } else {
        IMask(telEl, { mask: '(00) 00000-0000' });
        IMask(telCons, {
            mask: [
                { mask: '(00) 0000-0000' },
                { mask: '(00) 00000-0000' }
            ]
        });
        IMask(cepEl, { mask: '00000-000' });
        IMask(cpfEl, { mask: '000.000.000-00' });
    }
}

function splitNomeCompleto(nome) {
    const s = String(nome || '').trim();
    if (!s) return { first: '—', rest: '' };
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], rest: '' };
    return { first: parts[0], rest: parts.slice(1).join(' ') };
}

function buildRqeDisplayString() {
    const inputs = document.querySelectorAll('#rqeContainer input');
    const vals = Array.from(inputs)
        .map((i) => String(i.value || '').replace(/\D/g, ''))
        .filter(Boolean);
    if (!vals.length) return '';
    return vals.join(', ');
}

function refreshHeroFromForm() {
    const nomeEl = document.getElementById('nome');
    const crmEl = document.getElementById('crm');
    const espEl = document.getElementById('especialidade');
    const greetPhrase = document.getElementById('heroGreetingPhrase');
    const firstEl = document.getElementById('heroFirstName');
    const surEl = document.getElementById('heroSurname');
    const metaEl = document.getElementById('heroProMeta');
    if (!firstEl || !metaEl) return;

    const hour = new Date().getHours();
    let greetFb = 'Boa noite';
    if (hour >= 5 && hour < 12) greetFb = 'Bom dia';
    else if (hour >= 12 && hour < 18) greetFb = 'Boa tarde';
    let greetKey = 'perfilMedico.greetEvening';
    if (hour >= 5 && hour < 12) greetKey = 'perfilMedico.greetMorning';
    else if (hour >= 12 && hour < 18) greetKey = 'perfilMedico.greetAfternoon';
    if (greetPhrase) greetPhrase.textContent = t(greetKey, { fallback: greetFb });

    const { first, rest } = splitNomeCompleto(nomeEl ? nomeEl.value : '');
    firstEl.textContent = first;
    if (surEl) {
        if (rest) {
            surEl.textContent = rest;
            surEl.hidden = false;
        } else {
            surEl.textContent = '';
            surEl.hidden = true;
        }
    }

    const bits = [];
    const isUS = document.body.classList.contains('perfil-country-us');
    if (isUS) {
        const npiEl = document.getElementById('npi');
        const licEl = document.getElementById('medicalLicenseNumber');
        const stEl = document.getElementById('medicalLicenseState');
        const npi = npiEl && String(npiEl.value || '').replace(/\D/g, '').trim();
        const lic = licEl && String(licEl.value || '').trim();
        const st = stEl && String(stEl.value || '').trim();
        if (npi) bits.push(`${t('perfilMedico.heroNpi', { fallback: 'NPI' })} ${npi}`);
        if (lic) bits.push(`${t('perfilMedico.heroLicense', { fallback: 'License' })} ${lic}`);
        if (st) bits.push(`${t('perfilMedico.heroState', { fallback: 'State' })} ${st}`);
    } else {
        const crm = crmEl && String(crmEl.value || '').trim();
        if (crm) bits.push(`${t('perfilMedico.heroCrm', { fallback: 'CRM' })} ${crm}`);
        const rqeStr = buildRqeDisplayString();
        if (rqeStr) bits.push(`${t('perfilMedico.heroRqe', { fallback: 'RQE' })} ${rqeStr}`);
    }
    const esp = espEl && String(espEl.value || '').trim();
    if (esp) bits.push(esp);
    metaEl.textContent = bits.join(' · ');
    metaEl.hidden = bits.length === 0;
}

document.addEventListener('DOMContentLoaded', async function() {
    await initApp({ titleKey: 'perfilMedico.title', activePage: 'perfilmedico' });

    const toggleButton = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (toggleButton && sidebar) {
        toggleButton.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            toggleButton.classList.toggle('shifted');
        });
    }

    // Verificar se o usuário está autenticado
    const token = localStorage.getItem('token');
    if (!token) {
        Swal.fire({
            title: t('perfilMedico.swalError'),
            text: t('perfilMedico.swalLoginRequired'),
            icon: 'error',
            confirmButtonText: t('perfilMedico.swalGoLogin'),
            confirmButtonColor: '#002A42'
        }).then(() => {
            window.location.href = '../views/login.html';
        });
        return;
    }

    // Máscaras para os campos
    const telefoneMask = IMask(document.getElementById('telefone'), {
        mask: '(00) 00000-0000'
    });

    const telefoneConsultorioMask = IMask(document.getElementById('telefoneConsultorio'), {
        mask: [
            { mask: '(00) 0000-0000' }, // Telefone fixo
            { mask: '(00) 00000-0000' } // Celular
        ]
    });

    const cepMask = IMask(document.getElementById('cep'), {
        mask: '00000-000'
    });

    const cpfMask = IMask(document.getElementById('cpf'), {
        mask: '000.000.000-00'
    });

    // Event listeners
    document.getElementById('profileForm').addEventListener('submit', salvarAlteracoes);
    document.getElementById('editBtn').addEventListener('click', habilitarEdicao);
    document.getElementById('saveBtn').addEventListener('click', salvarAlteracoes);
    document.getElementById('cancelBtn').addEventListener('click', () => {
        Swal.fire({
            title: t('perfilMedico.swalCancelEdit'),
            text: t('perfilMedico.swalCancelEditText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: t('perfilMedico.swalYesCancel'),
            cancelButtonText: t('perfilMedico.swalNoContinue'),
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#002A42'
        }).then((result) => {
            if (result.isConfirmed) {
                desabilitarEdicao();
            }
        });
    });
    document.getElementById('cep').addEventListener('blur', buscarCep);
    document.getElementById('changePhotoBtn').addEventListener('click', alterarFoto);
    document.getElementById('addRqeBtn').addEventListener('click', adicionarCampoRQE);
    document.getElementById('submitValidationBtn')?.addEventListener('click', enviarParaAnalise);
    ['docCrm', 'docPhoto', 'docOther', 'docStateLicense', 'docNpi'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', (e) => uploadDocumentoValidacao(e, id));
    });

    const profileFormEl = document.getElementById('profileForm');
    if (profileFormEl) {
        profileFormEl.addEventListener('input', (e) => {
            const el = e.target;
            if (!(el instanceof HTMLInputElement)) return;
            if (
                el.id === 'especialidade' ||
                el.id === 'crm' ||
                el.id === 'nome' ||
                el.id === 'npi' ||
                el.id === 'medicalLicenseNumber' ||
                el.id === 'medicalLicenseState' ||
                el.id === 'crmUf' ||
                el.closest('#rqeContainer')
            ) {
                refreshHeroFromForm();
            }
        });
    }

    // Carregar dados iniciais
    carregarDadosMedico();
});

async function refreshToken() {
    try {
        const oldToken = localStorage.getItem('token');
        const response = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: oldToken })
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar token');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        return data.token;
    } catch (error) {
        console.error('Erro ao atualizar token:', error);
        throw error;
    }
}

async function carregarDadosMedico() {
    try {
        const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar dados do médico');
        }

        const medico = await response.json();
        console.log('Dados recebidos da API:', medico);

        setPerfilCountryMode(medico.country || 'BR');

        if (medico.validationStatus) {
          localStorage.setItem('validationStatus', medico.validationStatus);
        }
        if (medico.hasChosenPlan !== undefined) {
          localStorage.setItem('hasChosenPlan', medico.hasChosenPlan ? 'true' : 'false');
        }
        if (medico.role === 'admin' || medico.isAdmin === true) {
          localStorage.setItem('isAdmin', 'true');
        } else {
          localStorage.removeItem('isAdmin');
        }

        // Atualiza o sidebar do médico (mesmo quando há paciente ativo, o nome do médico deve aparecer)
        if (window.updateSidebarInfo) {
          const licSidebar =
              medico.country === 'US'
                  ? medico.npi
                      ? `NPI ${String(medico.npi).replace(/\D/g, '').trim()}`
                      : ''
                  : medico.crm || '';
          window.updateSidebarInfo(medico.nome, medico.areaAtuacao, medico.genero, licSidebar);
        }
        
        // Formatar telefones em um objeto
        const telefones = {
            pessoal: medico.telefonePessoal || '',
            consultorio: medico.telefoneConsultorio || ''
        };
        console.log('Telefones formatados:', telefones);

        // Preencher campos do formulário
        document.getElementById('nome').value = medico.nome || '';
        document.getElementById('cpf').value = medico.cpf || '';
        document.getElementById('email').value = medico.email || '';
        document.getElementById('genero').value = medico.genero || '';
        document.getElementById('crm').value = medico.crm || '';
        const crmUfEl = document.getElementById('crmUf');
        if (crmUfEl) crmUfEl.value = (medico.crmUf || '').toUpperCase();
        const npiEl = document.getElementById('npi');
        if (npiEl) npiEl.value = medico.npi ? String(medico.npi).replace(/\D/g, '').slice(0, 10) : '';
        const licEl = document.getElementById('medicalLicenseNumber');
        if (licEl) licEl.value = medico.medicalLicenseNumber || '';
        const lstEl = document.getElementById('medicalLicenseState');
        if (lstEl) lstEl.value = (medico.medicalLicenseState || '').toUpperCase();
        document.getElementById('especialidade').value = medico.areaAtuacao || '';
        document.getElementById('telefone').value = telefones.pessoal;
        document.getElementById('telefoneConsultorio').value = telefones.consultorio;
        document.getElementById('cep').value = medico.cep || '';
        
        const enderecoCompleto = medico.enderecoCompleto || {};
        document.getElementById('endereco').value = enderecoCompleto.logradouro || medico.enderecoConsultorio || '';
        document.getElementById('numero').value = enderecoCompleto.numero || medico.numeroConsultorio || '';
        document.getElementById('complemento').value = enderecoCompleto.complemento || medico.complemento || '';
        document.getElementById('bairro').value = enderecoCompleto.bairro || medico.bairro || '';
        document.getElementById('cidade').value = enderecoCompleto.cidade || medico.cidade || '';
        document.getElementById('estado').value = enderecoCompleto.estado || medico.estado || '';
        
        if (!document.getElementById('bairro').value && medico.enderecoConsultorio) {
          const enderecoStr = medico.enderecoConsultorio;
          const partes = enderecoStr.split(',').map(p => p.trim());
          if (partes.length >= 3) {
            document.getElementById('endereco').value = partes[0] || '';
            document.getElementById('bairro').value = partes[1] || '';
            const cidadeEstado = partes[2] ? partes[2].split('-').map(p => p.trim()) : [];
            if (cidadeEstado.length >= 2) {
              document.getElementById('cidade').value = cidadeEstado[0] || '';
              document.getElementById('estado').value = cidadeEstado[1] || '';
            } else if (cidadeEstado.length === 1) {
              document.getElementById('cidade').value = cidadeEstado[0] || '';
            }
          }
        }

        applyPerfilFieldMasks(medico);

        // Carregar foto do perfil
        const profileImage = document.getElementById('profileImage');
        if (medico.foto) {
            console.log('URL da foto recebida:', medico.foto);
            profileImage.src = medico.foto;
            profileImage.onerror = () => {
                console.error('Erro ao carregar imagem:', medico.foto);
                profileImage.src = '/client/public/assets/user_logo.png';
            };
        } else {
            console.log('Nenhuma foto encontrada, usando imagem padrão');
            profileImage.src = '/client/public/assets/user_logo.png';
        }

        // Limpar e recriar campos RQE (somente BR)
        const rqeContainer = document.getElementById('rqeContainer');
        rqeContainer.innerHTML = '';
        if ((medico.country || 'BR') !== 'US') {
            console.log('RQEs recebidos:', medico.rqe);
            if (!medico.rqe || medico.rqe.length === 0) {
                rqeContainer.appendChild(criarCampoRQE(''));
            } else {
                medico.rqe.forEach((rqe) => {
                    if (rqe !== null && rqe !== undefined) {
                        rqeContainer.appendChild(criarCampoRQE(rqe.toString()));
                    }
                });
            }
        }

        perfilMedicoCache = medico;
        applyValidationDocsCountry(medico.country || 'BR');
        renderValidationSection(medico);
        renderProfileProgress(medico, null);
        refreshHeroFromForm();
        loadValidationDocuments().catch(() => {});

    } catch (error) {
        console.error('Erro:', error);
        Swal.fire({
            icon: 'error',
            title: t('perfilMedico.swalError'),
            text: t('perfilMedico.swalLoadError')
        });
    }
}

function criarCampoRQE(valor = '') {
    const rqeRow = document.createElement('div');
    rqeRow.className = 'input-row rqe-row rqe-row--plain';

    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';

    const label = document.createElement('label');
    label.textContent = t('perfilMedico.labelRQE');

    const input = document.createElement('input');
    input.type = 'text';
    input.value = valor;
    input.readOnly = true;
    input.maxLength = 6;

    IMask(input, {
        mask: '000000',
        prepare: function(str) {
            return str.replace(/[^0-9]/g, '');
        }
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-rqe-btn';
    removeBtn.setAttribute('aria-label', t('perfilMedico.removeRqe', { fallback: 'Remover RQE' }));
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.style.display = 'none';

    removeBtn.onclick = function() {
        rqeRow.remove();
        atualizarBotoesRQE();
    };

    inputGroup.appendChild(label);
    inputGroup.appendChild(input);
    rqeRow.appendChild(inputGroup);
    rqeRow.appendChild(removeBtn);

    return rqeRow;
}

function atualizarBotoesRQE() {
    const rqeContainer = document.getElementById('rqeContainer');
    const addRqeRow = document.getElementById('addRqeRow');
    const rqeRows = rqeContainer.getElementsByClassName('rqe-row');
    
    // Mostra o botão de adicionar apenas se estiver em modo de edição (somente BR)
    if (document.getElementById('editBtn').style.display === 'none') {
        const isUS = document.body.classList.contains('perfil-country-us');
        addRqeRow.style.display = isUS ? 'none' : 'flex';
    }
    
    // Atualiza os números dos RQEs
    Array.from(rqeRows).forEach((row, index) => {
        const label = row.querySelector('label');
        const input = row.querySelector('input');
        const numero = index + 1;
        label.htmlFor = `rqe${numero}`;
        label.textContent = t('perfilMedico.labelRQE') + ' ' + numero;
        input.id = `rqe${numero}`;
        input.name = `rqe${numero}`;
    });
    refreshHeroFromForm();
}

function adicionarCampoRQE() {
    if (document.body.classList.contains('perfil-country-us')) return;
    const rqeContainer = document.getElementById('rqeContainer');
    const novoCampo = criarCampoRQE('');
    rqeContainer.appendChild(novoCampo);
    
    // Se estiver em modo de edição, mostrar o botão de remover e tornar o campo editável
    if (document.getElementById('editBtn').style.display === 'none') {
        const removeBtn = novoCampo.querySelector('.remove-rqe-btn');
        const input = novoCampo.querySelector('input');
        
        removeBtn.style.display = 'flex';
        input.readOnly = false;
        
        // Reaplicar a máscara para o novo campo
        IMask(input, {
            mask: '000000',
            prepare: function(str) {
                return str.replace(/[^0-9]/g, '');
            }
        });
    }
    
    atualizarBotoesRQE();
}

function preencherFormulario(user) {
    console.log('Preenchendo formulário com dados:', user);
    
    // Campos do formulário
    document.getElementById('nome').value = user.nome || '';
    document.getElementById('genero').value = user.genero || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('crm').value = user.crm || '';
    
    // Limpar e preencher RQEs
    const rqeContainer = document.getElementById('rqeContainer');
    rqeContainer.innerHTML = '';
    
    const rqeArray = Array.isArray(user.rqe) ? user.rqe : [];
    rqeArray.forEach((rqe) => {
        const rqeRow = criarCampoRQE(rqe != null ? String(rqe) : '');
        rqeContainer.appendChild(rqeRow);
    });
    
    document.getElementById('especialidade').value = user.areaAtuacao || '';
    
    // Aplicar máscaras aos telefones
    const telefoneMask = IMask(document.getElementById('telefone'), {
        mask: '(00) 00000-0000'
    });
    telefoneMask.value = user.telefonePessoal || '';
    
    const telefoneConsultorioMask = IMask(document.getElementById('telefoneConsultorio'), {
        mask: [
            { mask: '(00) 0000-0000' }, // Telefone fixo
            { mask: '(00) 00000-0000' } // Celular
        ]
    });
    telefoneConsultorioMask.value = user.telefoneConsultorio || '';
    
    // Endereço
    const cepMask = IMask(document.getElementById('cep'), {
        mask: '00000-000'
    });
    cepMask.value = user.cep || '';
    
    document.getElementById('endereco').value = user.enderecoConsultorio || '';
    document.getElementById('numero').value = user.numeroConsultorio || '';

    // Foto do perfil
    const profileImage = document.getElementById('profileImage');
    if (user.foto) {
        console.log('URL da foto:', user.foto);
        profileImage.src = user.foto;
        profileImage.onerror = () => {
            console.error('Erro ao carregar imagem:', user.foto);
            profileImage.src = '/client/public/assets/user_logo.png';
        };
    } else {
        console.log('Nenhuma foto encontrada, usando imagem padrão');
        profileImage.src = '/client/public/assets/user_logo.png';
    }
}

async function alterarFoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/jpg';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Verificar tamanho do arquivo (5MB)
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                title: t('perfilMedico.swalError'),
                text: t('perfilMedico.swalPhotoMaxSize'),
                icon: 'error',
                confirmButtonText: t('perfilMedico.swalOk'),
                confirmButtonColor: '#002A42'
            });
            return;
        }

        // Verificar tipo do arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            Swal.fire({
                title: t('perfilMedico.swalError'),
                text: t('perfilMedico.swalPhotoFormat'),
                icon: 'error',
                confirmButtonText: t('perfilMedico.swalOk'),
                confirmButtonColor: '#002A42'
            });
            return;
        }

        // Mostrar preview da imagem antes do upload
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profileImage').src = e.target.result;
        };
        reader.readAsDataURL(file);

        const formData = new FormData();
        formData.append('foto', file);

        try {
            let token = localStorage.getItem('token');
            console.log('Token usado no upload:', token);

            const response = await fetch('/api/usuarios/perfil/foto', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            // Tentar fazer parse do JSON, se falhar, mostrar erro mais claro
            let data;
            try {
                const text = await response.text();
                if (!text) {
                    throw new Error('Resposta vazia do servidor');
                }
                // Verificar se começa com < (HTML) ou { (JSON)
                if (text.trim().startsWith('<')) {
                    console.error('Servidor retornou HTML em vez de JSON:', text.substring(0, 200));
                    throw new Error('Erro: O servidor retornou uma página HTML em vez de JSON. Verifique se a rota está configurada corretamente.');
                }
                data = JSON.parse(text);
            } catch (parseError) {
                console.error('Erro ao fazer parse da resposta:', parseError);
                throw new Error('Erro ao processar resposta do servidor. Verifique se a rota está configurada corretamente.');
            }

            if (response.status === 401) {
                // Token expirado, tenta refresh
                token = await refreshToken();
                // Tenta o upload novamente com o novo token
                const newResponse = await fetch('/api/usuarios/perfil/foto', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                // Tentar fazer parse do JSON, se falhar, mostrar erro mais claro
                let newData;
                try {
                    const text = await newResponse.text();
                    if (!text) {
                        throw new Error('Resposta vazia do servidor');
                    }
                    // Verificar se começa com < (HTML) ou { (JSON)
                    if (text.trim().startsWith('<')) {
                        console.error('Servidor retornou HTML em vez de JSON:', text.substring(0, 200));
                        throw new Error('Erro: O servidor retornou uma página HTML em vez de JSON. Verifique se a rota está configurada corretamente.');
                    }
                    newData = JSON.parse(text);
                } catch (parseError) {
                    console.error('Erro ao fazer parse da resposta:', parseError);
                    throw new Error('Erro ao processar resposta do servidor. Verifique se a rota está configurada corretamente.');
                }

                if (!newResponse.ok) {
                    throw new Error(newData.message || 'Erro ao atualizar foto');
                }
                document.getElementById('profileImage').src = newData.fotoUrl;
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao atualizar foto');
            }

            // Atualiza a imagem com a URL retornada pelo servidor
            document.getElementById('profileImage').src = data.fotoUrl;

            Swal.fire({
                title: t('perfilMedico.swalSuccess'),
                text: t('perfilMedico.swalPhotoSuccess'),
                icon: 'success',
                confirmButtonText: t('perfilMedico.swalOk'),
                confirmButtonColor: '#002A42'
            });
        } catch (error) {
            console.error('Erro ao atualizar foto:', error);
            // Reverte para a imagem anterior em caso de erro
            carregarDadosMedico();
            
            if (error.message.includes('Token inválido') || error.message.includes('não autorizado')) {
                Swal.fire({
                    title: t('perfilMedico.swalSessionExpired'),
                    text: t('perfilMedico.swalSessionExpiredText'),
                    icon: 'warning',
                    confirmButtonText: t('perfilMedico.swalGoLogin'),
                    confirmButtonColor: '#002A42'
                }).then(() => {
                    window.location.href = '../views/login.html';
                });
                return;
            }
            
            Swal.fire({
                title: t('perfilMedico.swalError'),
                text: error.message || t('perfilMedico.swalPhotoError'),
                icon: 'error',
                confirmButtonText: t('perfilMedico.swalOk'),
                confirmButtonColor: '#002A42'
            });
        }
    };

    input.click();
}

async function salvarAlteracoes(event) {
    event.preventDefault();

    // Mostrar popup de salvamento
    Swal.fire({
        title: t('perfilMedico.swalSaving'),
        text: t('perfilMedico.swalSavingText'),
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const token = localStorage.getItem('token');

        const isUS =
            (perfilMedicoCache && perfilMedicoCache.country === 'US') ||
            document.body.classList.contains('perfil-country-us');

        // Coletar dados do formulário
        const dadosPerfil = {
            nome: document.getElementById('nome').value.trim(),
            email: document.getElementById('email').value.trim(),
            genero: document.getElementById('genero').value.trim(),
            areaAtuacao: document.getElementById('especialidade').value.trim(),
            telefonePessoal: document.getElementById('telefone').value.replace(/\D/g, ''),
            telefoneConsultorio: document.getElementById('telefoneConsultorio').value.replace(/\D/g, ''),
            cep: document.getElementById('cep').value.replace(/\D/g, ''),
            enderecoConsultorio: document.getElementById('endereco').value.trim(),
            numeroConsultorio: document.getElementById('numero').value.trim(),
            complemento: document.getElementById('complemento').value.trim(),
            bairro: document.getElementById('bairro').value.trim(),
            cidade: document.getElementById('cidade').value.trim(),
            estado: document.getElementById('estado').value.trim()
        };

        if (isUS) {
            const npiEl = document.getElementById('npi');
            const licEl = document.getElementById('medicalLicenseNumber');
            const stEl = document.getElementById('medicalLicenseState');
            dadosPerfil.npi = (npiEl?.value || '').replace(/\D/g, '').slice(0, 10);
            dadosPerfil.medicalLicenseNumber = (licEl?.value || '').trim().toUpperCase();
            dadosPerfil.medicalLicenseState = (stEl?.value || '').trim().toUpperCase();
        } else {
            dadosPerfil.crm = document.getElementById('crm').value.trim();
            dadosPerfil.crmUf = (document.getElementById('crmUf')?.value || '').trim().toUpperCase();
            const rqeInputs = document.querySelectorAll('#rqeContainer input');
            dadosPerfil.rqe = Array.from(rqeInputs)
                .map((input) => input.value.replace(/\D/g, ''))
                .filter((rqe) => rqe && rqe.trim() !== '');
        }

        console.log('Dados a serem enviados:', dadosPerfil);

        // Fazer a requisição com JSON
        const response = await fetch(`${API_URL}/api/usuarios/perfil`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dadosPerfil)
        });

        const responseData = await response.json();

        if (!response.ok) {
            // Se a resposta não for ok, lançar erro com a mensagem do servidor
            const errorMessage = responseData.message || responseData.error || 'Erro ao salvar alterações';
            throw new Error(errorMessage);
        }

        // Fechar popup de salvamento e mostrar sucesso
        Swal.close();
        Swal.fire({
            icon: 'success',
            title: t('perfilMedico.swalSuccess'),
            text: responseData.message || t('perfilMedico.swalSaveSuccess'),
            confirmButtonColor: '#002A42'
        });

        desabilitarEdicao();
        await carregarDadosMedico();

        if (window.updateNotificationBadge) {
          window.updateNotificationBadge();
        }

    } catch (error) {
        console.error('Erro ao salvar:', error);
        Swal.close();
        
        // Mostrar mensagem de erro específica
        let errorMessage = t('perfilMedico.swalSaveError');
        
        if (error.message) {
            errorMessage = error.message;
        } else if (error.response && error.response.data) {
            errorMessage = error.response.data.message || errorMessage;
        }

        // Verificar se é erro de autenticação
        if (errorMessage.includes('Token') || errorMessage.includes('não autorizado') || errorMessage.includes('expirou')) {
            Swal.fire({
                icon: 'warning',
                title: t('perfilMedico.swalSessionExpired'),
                text: t('perfilMedico.swalSessionExpiredText'),
                confirmButtonText: t('perfilMedico.swalGoLogin'),
                confirmButtonColor: '#002A42'
            }).then(() => {
                window.location.href = '../views/login.html';
            });
            return;
        }

        Swal.fire({
            icon: 'error',
            title: t('perfilMedico.swalError'),
            text: errorMessage,
            confirmButtonColor: '#002A42'
        });
    }
}

async function buscarCep() {
    const cepInput = document.getElementById('cep');

    if (document.body.classList.contains('perfil-country-us')) {
        return;
    }

    // Só buscar CEP se o campo estiver editável
    if (cepInput.readOnly) {
        return;
    }

    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
        return;
    }

    try {
        // Mostrar loading
        Swal.fire({
            title: t('perfilMedico.swalSearchingCEP'),
            text: t('perfilMedico.swalSearchingCEPText'),
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        Swal.close();

        if (data.erro) {
            throw new Error('CEP não encontrado');
        }

        // Preencher todos os campos do endereço
        document.getElementById('endereco').value = data.logradouro || '';
        document.getElementById('bairro').value = data.bairro || '';
        document.getElementById('cidade').value = data.localidade || '';
        document.getElementById('estado').value = data.uf || '';
        
        // Limpar o campo número apenas se não estiver preenchido
        if (!document.getElementById('numero').value) {
            document.getElementById('numero').value = '';
        }

        // Mostrar mensagem de sucesso
        Swal.fire({
            title: t('perfilMedico.swalCEPFound'),
            text: t('perfilMedico.swalCEPFoundText'),
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            confirmButtonColor: '#002A42'
        });

    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        Swal.fire({
            title: t('perfilMedico.swalError'),
            text: error.message === 'CEP não encontrado' 
                ? t('perfilMedico.swalCEPNotFound')
                : t('perfilMedico.swalCEPError'),
            icon: 'error',
            confirmButtonText: t('perfilMedico.swalOk'),
            confirmButtonColor: '#002A42'
        });
    }
}

function habilitarEdicao() {
    const isUS =
        (perfilMedicoCache && perfilMedicoCache.country === 'US') ||
        document.body.classList.contains('perfil-country-us');

    // Esconder botão de editar e mostrar botões de salvar e cancelar
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    document.getElementById('changePhotoBtn').disabled = false;
    document.getElementById('changePhotoBtn').style.display = 'inline-flex';

    // Mostrar botão de adicionar RQE (somente BR)
    document.getElementById('addRqeRow').style.display = isUS ? 'none' : 'flex';
    
    // Mostrar botões de remover RQE
    const removeButtons = document.querySelectorAll('.remove-rqe-btn');
    removeButtons.forEach(btn => { btn.style.display = 'flex'; });
    
    // Tornar campos editáveis
    const camposEditaveis = [
        'telefone',
        'telefoneConsultorio',
        'cep',
        'endereco',
        'numero',
        'complemento',
        'bairro',
        'cidade',
        'estado',
        'especialidade'
    ];
    
    camposEditaveis.forEach((campo) => {
        const input = document.getElementById(campo);
        if (input) {
            input.readOnly = false;
        }
    });

    if (perfilMedicoCache) {
        applyPerfilFieldMasks(perfilMedicoCache);
    }
    
    // Tornar campos RQE editáveis (somente BR)
    if (!isUS) {
        const rqeInputs = document.querySelectorAll('#rqeContainer input');
        rqeInputs.forEach((input) => {
            input.readOnly = false;
            IMask(input, {
                mask: '000000'
            });
        });
    }
}

const STATUS_LABELS = {
    pending_complement: { key: 'validacao.statusPending', fallback: 'Pendente de complemento', class: 'status-pending' },
    under_review: { key: 'validacao.statusUnderReview', fallback: 'Em análise', class: 'status-under_review' },
    denied: { key: 'validacao.statusDenied', fallback: 'Negado', class: 'status-denied' },
    approved: { key: 'validacao.statusApproved', fallback: 'Aprovado', class: 'status-approved' }
};

/** Último payload do perfil (para atualizar barra de progresso após carregar documentos). */
let perfilMedicoCache = null;

const STEP_ICONS = {
    photo: 'fa-camera',
    personal: 'fa-user',
    professional: 'fa-briefcase-medical',
    office: 'fa-map-marker-alt',
    validation: 'fa-shield'
};

function hasStr(v) {
    return v != null && String(v).trim() !== '';
}

function computeProfileCompletion(medico, docsArray) {
    const docs = Array.isArray(docsArray) ? docsArray : [];
    const docTypes = new Set(docs.map((d) => d.type));
    const isUS = medico.country === 'US';
    const hasCrmDoc = docTypes.has('crm');
    const hasStateLicenseDoc = docTypes.has('state_license');
    const hasPhotoDoc = docTypes.has('document_with_photo');

    const fotoOk = !!medico.foto;
    const personalOk = isUS
        ? hasStr(medico.nome) &&
          hasStr(medico.genero) &&
          hasStr(medico.email) &&
          hasStr(medico.telefonePessoal) &&
          hasStr(medico.npi)
        : hasStr(medico.nome) &&
          hasStr(medico.cpf) &&
          hasStr(medico.genero) &&
          hasStr(medico.email) &&
          hasStr(medico.telefonePessoal);
    const rqeList = Array.isArray(medico.rqe) ? medico.rqe : [];
    const rqeOk = rqeList.some((r) => hasStr(r) && String(r).replace(/\D/g, '').length >= 1);
    const profOk = isUS
        ? hasStr(medico.npi) &&
          hasStr(medico.medicalLicenseNumber) &&
          hasStr(medico.medicalLicenseState) &&
          hasStr(medico.areaAtuacao)
        : hasStr(medico.crm) && hasStr(medico.areaAtuacao) && rqeOk;

    const ec = medico.enderecoCompleto || {};
    const officeOk =
        hasStr(medico.cep) &&
        (hasStr(ec.logradouro) || hasStr(medico.enderecoConsultorio)) &&
        (hasStr(ec.numero) || hasStr(medico.numeroConsultorio)) &&
        hasStr(ec.cidade || medico.cidade) &&
        hasStr(ec.estado || medico.estado) &&
        hasStr(medico.telefoneConsultorio);

    const status = medico.validationStatus || 'pending_complement';
    const validationDone = status === 'approved' || status === 'under_review';
    const validationWarning = status === 'denied';

    const seg = 20;
    let pct = 0;
    if (fotoOk) pct += seg;
    if (personalOk) pct += seg;
    if (profOk) pct += seg;
    if (officeOk) pct += seg;
    if (validationDone) pct += seg;
    else if (status === 'pending_complement' || status === 'denied') {
        const docsOk = isUS ? hasStateLicenseDoc && hasPhotoDoc : hasCrmDoc && hasPhotoDoc;
        const oneDoc = isUS ? hasStateLicenseDoc || hasPhotoDoc : hasCrmDoc || hasPhotoDoc;
        if (docsOk) pct += seg * 0.65;
        else if (oneDoc) pct += seg * 0.35;
    }
    pct = Math.min(100, Math.round(pct));

    const checks = { fotoOk, personalOk, profOk, officeOk, validationDone, validationWarning };

    let current = null;
    if (!fotoOk) current = 'photo';
    else if (!personalOk) current = 'personal';
    else if (!profOk) current = 'professional';
    else if (!officeOk) current = 'office';
    else if (!validationDone) current = 'validation';
    else current = null;

    return {
        pct,
        checks,
        current,
        status,
        hasCrmDoc,
        hasStateLicenseDoc,
        hasPhotoDoc,
        validationWarning,
        isUS
    };
}

function setStepDot(el, state, stepKey) {
    const dot = el.querySelector('.perfil-step__dot');
    if (!dot) return;
    if (state === 'done') {
        dot.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
    } else if (state === 'warning') {
        dot.innerHTML = '<i class="fas fa-exclamation" aria-hidden="true"></i>';
    } else {
        const ic = STEP_ICONS[stepKey] || 'fa-circle';
        dot.innerHTML = `<i class="fas ${ic}" aria-hidden="true"></i>`;
    }
}

function renderProfileProgress(medico, validationDocs) {
    const track = document.getElementById('perfilProgressTrack');
    const fill = document.getElementById('perfilProgressFill');
    const pctEl = document.getElementById('perfilProgressPercent');
    const hintEl = document.getElementById('perfilProgressHint');
    if (!track || !fill || !pctEl || !hintEl || !medico) return;

    const {
        pct,
        checks,
        current,
        status,
        hasCrmDoc,
        hasStateLicenseDoc,
        hasPhotoDoc,
        validationWarning,
        isUS
    } = computeProfileCompletion(medico, validationDocs);

    fill.style.width = pct + '%';
    track.setAttribute('aria-valuenow', String(pct));
    track.setAttribute(
        'aria-label',
        `${t('perfilMedico.progressTitle', { fallback: 'Andamento do cadastro' })}: ${pct}%`
    );
    pctEl.textContent = pct + '%';

    const order = ['photo', 'personal', 'professional', 'office', 'validation'];
    const doneMap = {
        photo: checks.fotoOk,
        personal: checks.personalOk,
        professional: checks.profOk,
        office: checks.officeOk,
        validation: checks.validationDone
    };

    order.forEach((key) => {
        const el = document.querySelector(`.perfil-step[data-step="${key}"]`);
        if (!el) return;
        el.classList.remove('perfil-step--done', 'perfil-step--current', 'perfil-step--todo', 'perfil-step--warning');
        let state = 'todo';
        if (key === 'validation' && validationWarning) {
            state = 'warning';
            el.classList.add('perfil-step--warning');
            setStepDot(el, 'warning', key);
        } else if (doneMap[key]) {
            state = 'done';
            el.classList.add('perfil-step--done');
            setStepDot(el, 'done', key);
        } else {
            setStepDot(el, 'current', key);
            el.classList.add('perfil-step--todo');
        }
        if (current === key && state !== 'done' && state !== 'warning') {
            el.classList.remove('perfil-step--todo');
            el.classList.add('perfil-step--current');
        }
    });

    if (!current) {
        if (status === 'under_review') {
            hintEl.textContent = t('perfilMedico.hintUnderReview', {
                fallback: 'Documentos em análise. Você será notificado quando houver atualização.'
            });
            return;
        }
        hintEl.textContent = t('perfilMedico.progressAllDone', {
            fallback: 'Seu cadastro está completo. Obrigado por manter suas informações atualizadas.'
        });
        return;
    }

    if (current === 'validation') {
        if (validationWarning) {
            hintEl.textContent = t('perfilMedico.hintDeniedStep', {
                fallback: 'Ajuste o que foi solicitado e reenvie os documentos, se necessário.'
            });
            return;
        }
        if ((isUS ? hasStateLicenseDoc && hasPhotoDoc : hasCrmDoc && hasPhotoDoc)) {
            hintEl.textContent = t('perfilMedico.hintValidationSubmit', {
                fallback: 'Documentos obrigatórios anexados. Envie para análise quando estiver pronto.'
            });
        } else if (isUS ? !hasStateLicenseDoc && !hasPhotoDoc : !hasCrmDoc && !hasPhotoDoc) {
            hintEl.textContent = isUS
                ? t('perfilMedico.hintValidationDocsUS', {
                      fallback: 'Attach state license and a photo ID to complete this step.'
                  })
                : t('perfilMedico.hintValidationDocs', {
                      fallback: 'Anexe o comprovante de CRM e um documento com foto para concluir esta etapa.'
                  });
        } else {
            hintEl.textContent = isUS
                ? t('perfilMedico.hintValidationOneDocUS', {
                      fallback: 'One required document is still missing (license or photo ID).'
                  })
                : t('perfilMedico.hintValidationOneDoc', {
                      fallback: 'Falta anexar um dos documentos obrigatórios (CRM ou documento com foto).'
                  });
        }
        return;
    }

    const hintKeys = {
        photo: ['perfilMedico.hintStepPhoto', 'Adicione uma foto de perfil nítida.'],
        personal: isUS
            ? ['perfilMedico.hintStepPersonalUS', 'Complete nome, NPI, gênero, e-mail e telefone.']
            : ['perfilMedico.hintStepPersonal', 'Complete nome, CPF, gênero, e-mail e telefone.'],
        professional: isUS
            ? ['perfilMedico.hintStepProfessionalUS', 'Informe NPI, licença estadual e especialidade.']
            : ['perfilMedico.hintStepProfessional', 'Informe CRM, RQE e especialidade.'],
        office: isUS
            ? ['perfilMedico.hintStepOfficeUS', 'Preencha ZIP, endereço, cidade, estado e telefone do consultório.']
            : ['perfilMedico.hintStepOffice', 'Preencha o endereço e o telefone do consultório.']
    };
    const [hk, fb] = hintKeys[current] || ['', ''];
    hintEl.textContent = t(hk, { fallback: fb });
}

function applyValidationDocsCountry(country) {
    const us = country === 'US';
    document.querySelectorAll('.validation-doc-row-br').forEach((el) => {
        el.style.display = us ? 'none' : '';
    });
    document.querySelectorAll('.validation-doc-row-us').forEach((el) => {
        el.style.display = us ? '' : 'none';
    });
    const nb = document.querySelector('.validation-doc-note-br');
    const nu = document.querySelector('.validation-doc-note-us');
    if (nb) nb.style.display = us ? 'none' : '';
    if (nu) nu.style.display = us ? '' : 'none';
}

function setValidationUploadsLocked(locked) {
    ['docCrm', 'docPhoto', 'docOther', 'docStateLicense', 'docNpi'].forEach((id) => {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.disabled = locked;
        const label = inp.closest('label.perfil-file-btn');
        if (label) {
            label.classList.toggle('perfil-file-btn--locked', locked);
            label.setAttribute('aria-disabled', locked ? 'true' : 'false');
        }
    });
}

function renderValidationSection(medico) {
    const status = medico.validationStatus || 'pending_complement';
    const badgeEl = document.getElementById('validationStatusBadge');
    const reasonEl = document.getElementById('validationDeniedReason');
    const hintEl = document.getElementById('validationHint');
    const docsEl = document.getElementById('validationDocuments');
    const submitBtn = document.getElementById('submitValidationBtn');
    const lockedMsgEl = document.getElementById('validationUploadsLockedMsg');
    if (!badgeEl) return;

    const labels = STATUS_LABELS[status] || STATUS_LABELS.pending_complement;
    badgeEl.textContent = t(labels.key, { fallback: labels.fallback });
    badgeEl.className = 'validation-badge ' + labels.class;

    if (status === 'denied' && medico.validationDeniedReason) {
        reasonEl.style.display = 'block';
        reasonEl.innerHTML = '<strong>' + t('validacao.deniedReason', { fallback: 'Motivo da recusa:' }) + '</strong> ' + medico.validationDeniedReason;
    } else {
        reasonEl.style.display = 'none';
    }

    const showDocs = status !== 'approved';
    const uploadsLocked = status === 'under_review' || status === 'approved';
    setValidationUploadsLocked(uploadsLocked && showDocs);

    if (docsEl) docsEl.style.display = showDocs ? 'block' : 'none';

    if (lockedMsgEl) {
        lockedMsgEl.style.display = uploadsLocked && showDocs ? 'block' : 'none';
    }

    if (hintEl) {
        if (uploadsLocked && status === 'under_review') {
            hintEl.style.display = 'none';
        } else {
            hintEl.style.display = showDocs ? 'block' : 'none';
        }
    }

    if (submitBtn) {
        submitBtn.style.display = (status === 'pending_complement' || status === 'denied') ? 'inline-flex' : 'none';
    }

    const planBanner = document.getElementById('validationPlanBanner');
    if (planBanner) {
        if (status === 'approved' && !medico.hasChosenPlan) {
            planBanner.style.display = 'block';
        } else {
            planBanner.style.display = 'none';
        }
    }
}

function appendValidationDocRow(tbody, doc, typeLabel, fileCount = 1) {
    const label = typeLabel[doc.type] || doc.type || '';
    const dateStr = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—';
    const url = doc.url || '#';

    const tr = document.createElement('tr');

    const tdType = document.createElement('td');
    tdType.textContent = label;

    const tdDate = document.createElement('td');
    if (fileCount > 1) {
        tdDate.textContent =
            dateStr +
            ' · ' +
            t('perfilMedico.docFilesCount', {
                n: fileCount,
                fallback: '{{n}} arquivos (último envio)'
            });
    } else {
        tdDate.textContent = dateStr;
    }

    const tdQty = document.createElement('td');
    tdQty.textContent = String(fileCount);

    const tdAct = document.createElement('td');
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.className = 'perfil-sheet__open-link';
    a.innerHTML = '<i class="fas fa-external-link-alt" aria-hidden="true"></i> ';
    a.appendChild(document.createTextNode(t('perfilMedico.sheetOpen', { fallback: 'Abrir' })));
    tdAct.appendChild(a);

    tr.appendChild(tdType);
    tr.appendChild(tdDate);
    tr.appendChild(tdQty);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
}

function latestDocsByType(docs) {
    const counts = {};
    const latest = {};
    for (const d of docs) {
        const ty = d.type || 'other';
        counts[ty] = (counts[ty] || 0) + 1;
        const ts = d.uploadedAt ? new Date(d.uploadedAt).getTime() : 0;
        if (!latest[ty] || ts >= latest[ty]._ts) {
            latest[ty] = { doc: d, _ts: ts };
        }
    }
    const order = ['crm', 'state_license', 'npi_proof', 'document_with_photo', 'other'];
    return order
        .filter((ty) => latest[ty])
        .map((ty) => ({ doc: latest[ty].doc, count: counts[ty] }));
}

async function loadValidationDocuments() {
    const tbody = document.getElementById('validationDocumentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const photoDocLabel =
        perfilMedicoCache && perfilMedicoCache.country === 'US'
            ? t('validacao.docPhotoUS', { fallback: 'Government-issued photo ID' })
            : t('validacao.docPhotoBR', { fallback: 'Documento com foto (RG, CNH ou similar)' });
    const typeLabel = {
        crm: t('validacao.docCRM', { fallback: 'CRM' }),
        state_license: t('validacao.docStateLicense', { fallback: 'Licença estadual (US)' }),
        npi_proof: t('validacao.docNpiOptional', { fallback: 'Comprovante NPI' }),
        document_with_photo: photoDocLabel,
        other: t('validacao.docOther', { fallback: 'Outro' })
    };
    const emptyMsg = t('validacao.noDocs', { fallback: 'Nenhum documento anexado ainda.' });
    try {
        const res = await fetch(`${API_URL}/api/usuarios/perfil/validation-documents`, {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        if (!res.ok) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.className = 'perfil-sheet__empty';
            td.textContent = emptyMsg;
            tr.appendChild(td);
            tbody.appendChild(tr);
            if (perfilMedicoCache) renderProfileProgress(perfilMedicoCache, []);
            return;
        }
        const docs = await res.json();
        if (!Array.isArray(docs) || docs.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 4;
            td.className = 'perfil-sheet__empty';
            td.textContent = emptyMsg;
            tr.appendChild(td);
            tbody.appendChild(tr);
            if (perfilMedicoCache) renderProfileProgress(perfilMedicoCache, []);
            return;
        }
        latestDocsByType(docs).forEach(({ doc, count }) =>
            appendValidationDocRow(tbody, doc, typeLabel, count)
        );
        if (perfilMedicoCache) renderProfileProgress(perfilMedicoCache, docs);
    } catch (e) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 4;
        td.className = 'perfil-sheet__empty';
        td.textContent = emptyMsg;
        tr.appendChild(td);
        tbody.appendChild(tr);
        if (perfilMedicoCache) renderProfileProgress(perfilMedicoCache, []);
    }
}

async function uploadDocumentoValidacao(e, inputId) {
    const input = e.target;
    if (input.disabled) return;
    const file = input.files && input.files[0];
    if (!file) return;
    const type = input.dataset.type || input.getAttribute('data-type');
    const statusEl = document.getElementById(inputId + 'Status');
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        if (statusEl) statusEl.textContent = t('validacao.fileTooBig', { fallback: 'Arquivo maior que 10 MB' });
        return;
    }
    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', type);
    try {
        const res = await fetch(`${API_URL}/api/usuarios/perfil/validation-documents`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            if (statusEl) statusEl.textContent = t('validacao.uploadOk', { fallback: 'Enviado' });
            loadValidationDocuments();
            input.value = '';
        } else {
            if (statusEl) statusEl.textContent = data.message || 'Erro';
        }
    } catch (err) {
        if (statusEl) statusEl.textContent = t('validacao.uploadError', { fallback: 'Erro ao enviar' });
    }
}

async function enviarParaAnalise() {
    const btn = document.getElementById('submitValidationBtn');
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/api/usuarios/perfil/submit-validation`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token'), 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('validationStatus', 'under_review');
            Swal.fire({
                title: t('validacao.submitSuccessTitle', { fallback: 'Enviado' }),
                text: data.message || t('validacao.submitSuccess', { fallback: 'Sua solicitação foi enviada para análise.' }),
                icon: 'success',
                confirmButtonColor: '#002A42'
            }).then(() => {
                carregarDadosMedico();
            });
        } else {
            Swal.fire({
                title: t('perfilMedico.swalError'),
                text: data.message || t('validacao.submitError', { fallback: 'Não foi possível enviar.' }),
                icon: 'error',
                confirmButtonColor: '#002A42'
            });
        }
    } catch (err) {
        Swal.fire({
            title: t('perfilMedico.swalError'),
            text: t('validacao.submitError', { fallback: 'Erro ao enviar. Tente novamente.' }),
            icon: 'error',
            confirmButtonColor: '#002A42'
        });
    } finally {
        if (btn) btn.disabled = false;
    }
}

function desabilitarEdicao() {
    // Esconder botões de edição
    document.getElementById('editBtn').style.display = 'inline-block';
    document.getElementById('saveBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('changePhotoBtn').disabled = true;
    document.getElementById('changePhotoBtn').style.display = 'none';
    
    // Esconder botão de adicionar RQE
    document.getElementById('addRqeRow').style.display = 'none';
    
    // Esconder botões de remover RQE
    const removeButtons = document.querySelectorAll('.remove-rqe-btn');
    removeButtons.forEach(btn => btn.style.display = 'none');
    
    // Tornar todos os campos readonly
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]');
    inputs.forEach(input => input.readOnly = true);

    carregarDadosMedico().catch(error => {
        console.error('Erro ao recarregar dados:', error);
        Swal.fire({
            title: t('perfilMedico.swalError'),
            text: t('perfilMedico.swalReloadError'),
            icon: 'error',
            confirmButtonText: t('perfilMedico.swalOk'),
            confirmButtonColor: '#002A42'
        }).then(() => {
            window.location.reload();
        });
    });
}