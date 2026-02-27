import { API_URL } from './config.js';
import { initApp } from './initApp.js';
import { t } from './i18n.js';

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
    document.getElementById('logoutBtn').addEventListener('click', fazerLogout);
    document.getElementById('cep').addEventListener('blur', buscarCep);
    document.getElementById('changePhotoBtn').addEventListener('click', alterarFoto);
    document.getElementById('addRqeBtn').addEventListener('click', adicionarCampoRQE);
    document.getElementById('submitValidationBtn')?.addEventListener('click', enviarParaAnalise);
    ['docCrm', 'docPhoto', 'docOther'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', (e) => uploadDocumentoValidacao(e, id));
    });

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

        if (medico.validationStatus) {
          localStorage.setItem('validationStatus', medico.validationStatus);
        }
        if (medico.role === 'admin' || medico.isAdmin === true) {
          localStorage.setItem('isAdmin', 'true');
        } else {
          localStorage.removeItem('isAdmin');
        }

        // Atualiza o sidebar do médico (mesmo quando há paciente ativo, o nome do médico deve aparecer)
        if (window.updateSidebarInfo) {
          window.updateSidebarInfo(medico.nome, medico.areaAtuacao, medico.genero, medico.crm);
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

        // Aplicar máscaras nos campos
        IMask(document.getElementById('telefone'), {
            mask: '(00) 00000-0000'
        });
        
        IMask(document.getElementById('telefoneConsultorio'), {
            mask: [
                { mask: '(00) 0000-0000' }, // Telefone fixo
                { mask: '(00) 00000-0000' } // Celular
            ]
        });
        
        IMask(document.getElementById('cep'), {
            mask: '00000-000'
        });

        IMask(document.getElementById('cpf'), {
            mask: '000.000.000-00'
        });

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

        // Limpar e recriar campos RQE
        const rqeContainer = document.getElementById('rqeContainer');
        rqeContainer.innerHTML = '';
        
        console.log('RQEs recebidos:', medico.rqe);
        
        // Se não houver RQEs, cria um campo vazio
        if (!medico.rqe || medico.rqe.length === 0) {
            const rqeField = criarCampoRQE('');
            rqeContainer.appendChild(rqeField);
        } else {
            // Adiciona cada RQE como um campo
            medico.rqe.forEach(rqe => {
                if (rqe !== null && rqe !== undefined) {
                    const rqeField = criarCampoRQE(rqe.toString());
                    rqeContainer.appendChild(rqeField);
                }
            });
        }

        renderValidationSection(medico);
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
    rqeRow.className = 'rqe-row';
    
    const rqeGroup = document.createElement('div');
    rqeGroup.className = 'rqe-group';
    
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group';
    
    const label = document.createElement('label');
    label.textContent = t('perfilMedico.labelRQE');
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-wrapper';
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-certificate input-icon';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = valor;
    input.readOnly = true;
    input.maxLength = 6;
    
    // Aplicar máscara de 6 dígitos
    IMask(input, {
        mask: '000000',
        prepare: function(str) {
            return str.replace(/[^0-9]/g, '');
        }
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-rqe-btn';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.style.display = 'none';
    
    removeBtn.onclick = function() {
        rqeRow.remove();
        atualizarBotoesRQE();
    };
    
    // Montar a estrutura corretamente
    inputWrapper.appendChild(icon);
    inputWrapper.appendChild(input);
    inputGroup.appendChild(label);
    inputGroup.appendChild(inputWrapper);
    rqeGroup.appendChild(inputGroup);
    rqeGroup.appendChild(removeBtn);
    rqeRow.appendChild(rqeGroup);
    
    return rqeRow;
}

function atualizarBotoesRQE() {
    const rqeContainer = document.getElementById('rqeContainer');
    const addRqeRow = document.getElementById('addRqeRow');
    const rqeRows = rqeContainer.getElementsByClassName('rqe-row');
    
    // Mostra o botão de adicionar apenas se estiver em modo de edição
    if (document.getElementById('editBtn').style.display === 'none') {
        addRqeRow.style.display = 'flex';
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
}

function adicionarCampoRQE() {
    const rqeContainer = document.getElementById('rqeContainer');
    const rqeRows = rqeContainer.getElementsByClassName('rqe-row');
    const novoNumero = rqeRows.length + 1;
    
    const novoCampo = criarCampoRQE(novoNumero);
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
    rqeArray.forEach((rqe, index) => {
        const rqeRow = criarCampoRQE(index + 1, rqe);
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

        // Coletar dados do formulário
        const dadosPerfil = {
            nome: document.getElementById('nome').value.trim(),
            email: document.getElementById('email').value.trim(),
            genero: document.getElementById('genero').value.trim(),
            crm: document.getElementById('crm').value.trim(),
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

        // Coletar RQEs
        const rqeInputs = document.querySelectorAll('#rqeContainer input');
        const rqeValues = Array.from(rqeInputs)
            .map(input => input.value.replace(/\D/g, ''))
            .filter(rqe => rqe && rqe.trim() !== '');
        
        dadosPerfil.rqe = rqeValues;

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

function fazerLogout() {
    window.location.href = '../views/selecao.html';
}

function habilitarEdicao() {
    // Esconder botão de editar e mostrar botões de salvar e cancelar
    document.getElementById('editBtn').style.display = 'none';
    document.getElementById('saveBtn').style.display = 'inline-block';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    document.getElementById('changePhotoBtn').disabled = false;
    document.getElementById('changePhotoBtn').style.display = 'inline-block';
    
    // Esconder botão voltar
    document.getElementById('logoutBtn').style.display = 'none';
    
    // Mostrar botão de adicionar RQE
    document.getElementById('addRqeRow').style.display = 'table-row';
    
    // Mostrar botões de remover RQE
    const removeButtons = document.querySelectorAll('.remove-rqe-btn');
    removeButtons.forEach(btn => btn.style.display = 'inline-block');
    
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
    
    camposEditaveis.forEach(campo => {
        const input = document.getElementById(campo);
        if (input) {
            input.readOnly = false;
            
            // Aplicar máscaras específicas para cada campo
            if (campo === 'telefone') {
                IMask(input, {
                    mask: '(00) 00000-0000'
                });
            } else if (campo === 'telefoneConsultorio') {
                IMask(input, {
                    mask: [
                        { mask: '(00) 0000-0000' }, // Telefone fixo
                        { mask: '(00) 00000-0000' } // Celular
                    ]
                });
            } else if (campo === 'cep') {
                IMask(input, {
                    mask: '00000-000'
                });
            }
        }
    });
    
    // Tornar campos RQE editáveis
    const rqeInputs = document.querySelectorAll('#rqeContainer input');
    rqeInputs.forEach(input => {
        input.readOnly = false;
        IMask(input, {
            mask: '000000'
        });
    });
}

const STATUS_LABELS = {
    pending_complement: { key: 'validacao.statusPending', fallback: 'Pendente de complemento', class: 'status-pending' },
    under_review: { key: 'validacao.statusUnderReview', fallback: 'Em análise', class: 'status-under_review' },
    denied: { key: 'validacao.statusDenied', fallback: 'Negado', class: 'status-denied' },
    approved: { key: 'validacao.statusApproved', fallback: 'Aprovado', class: 'status-approved' }
};

function renderValidationSection(medico) {
    const status = medico.validationStatus || 'pending_complement';
    const badgeEl = document.getElementById('validationStatusBadge');
    const reasonEl = document.getElementById('validationDeniedReason');
    const hintEl = document.getElementById('validationHint');
    const docsEl = document.getElementById('validationDocuments');
    const submitBtn = document.getElementById('submitValidationBtn');
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
    if (docsEl) docsEl.style.display = showDocs ? 'block' : 'none';
    if (hintEl) hintEl.style.display = showDocs ? 'block' : 'none';
    if (submitBtn) {
        submitBtn.style.display = (status === 'pending_complement' || status === 'denied') ? 'inline-flex' : 'none';
    }
}

async function loadValidationDocuments() {
    const listEl = document.getElementById('validationDocumentsList');
    if (!listEl) return;
    try {
        const res = await fetch(`${API_URL}/api/usuarios/perfil/validation-documents`, {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
        if (!res.ok) return;
        const docs = await res.json();
        const typeLabel = { crm: t('validacao.docCRM', { fallback: 'CRM' }), document_with_photo: t('validacao.docPhoto', { fallback: 'Documento com foto' }), other: t('validacao.docOther', { fallback: 'Outro' }) };
        listEl.innerHTML = docs.map(d => '<li><a href="' + d.url + '" target="_blank" rel="noopener">' + (typeLabel[d.type] || d.type) + '</a> <span class="doc-date">' + (d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '') + '</span></li>').join('') || '<li class="no-docs">' + t('validacao.noDocs', { fallback: 'Nenhum documento anexado ainda.' }) + '</li>';
    } catch (e) {
        listEl.innerHTML = '<li class="no-docs">' + t('validacao.noDocs', { fallback: 'Nenhum documento anexado ainda.' }) + '</li>';
    }
}

async function uploadDocumentoValidacao(e, inputId) {
    const input = e.target;
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
    
    // Mostrar botão voltar
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
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