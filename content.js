(() => {
  try {
    const allowedPaths = [
      '/pages/laudo/construcao/cadastrarlaudo.xhtml',
      '/pages/laudo/cadastrarlaudo.xhtml'
    ];
    if (!allowedPaths.some((path) => location.href.includes(path))) return;

    const BTN1_ID = 'similImportarOsEtapa1Btn';
    const BTN2_ID = 'similImportarOsEtapa2Btn';
    const TOAST_ID = 'similImportarOsTxtToast';

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
    };

    const normalize = (s) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

    const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const criarDadosBase = () => ({
      os: null,
      atividade: null,
      produto: null,
      linha: null,
      fonte: null,
      tipoPessoa: null,
      cpfCnpj: null,
      nomeProponente: null,
      finalidade: null,
      cep: null,
      uf: null,
      municipio: null,
      bairro: null,
      logradouro: null,
      numero: null,
      setor: null,
      quadra: null,
      bloco: null,
      lote: null,
      conjunto: null,
      unidade: null,
      nomeEmpreendimento: null,
      complementos: null
    });

    const toast = (msg) => {
      let t = document.getElementById(TOAST_ID);
      if (!t) {
        t = document.createElement('div');
        t.id = TOAST_ID;
        t.style.cssText = `
          position: fixed;
          right: 16px;
          bottom: 160px;
          z-index: 2147483647;
          background: rgba(0,0,0,.82);
          color: #fff;
          padding: 10px 12px;
          border-radius: 10px;
          font: 13px Arial, sans-serif;
          max-width: 420px;
          white-space: pre-line;
        `;
        (document.body || document.documentElement).appendChild(t);
      }
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(window.__similImportarToastTimer);
      window.__similImportarToastTimer = setTimeout(() => {
        t.style.display = 'none';
      }, 3500);
    };

    function extrairCodigoOS(texto) {
      const match = String(texto || '').match(/(\d{4})\.(\d{4})\.(\d{9})\/(\d{4})\.(\d{2})\.(\d{2})/);
      if (!match) return null;

      const [, gihab, codSolicitante, ordenador, ano, comp1, comp2] = match;

      return {
        codigoCompleto: `${gihab}.${codSolicitante}.${ordenador}/${ano}.${comp1}.${comp2}`,
        gihab,
        codSolicitante,
        ordenador,
        ano,
        complemento: `${comp1}.${comp2}.01`
      };
    }

    function extrairMunicipioUf(texto) {
      const linha =
        (String(texto || '').match(/Cidade\/?UF\s*[:.]?\s*(.+)/i) || [])[1] ||
        (String(texto || '').match(/Cidade\s*\/\s*UF\s*[:.]?\s*(.+)/i) || [])[1];

      if (!linha) return { municipio: null, uf: null };

      const limpa = linha.replace(/\s+/g, ' ').trim();

      if (limpa.includes('/')) {
        const partes = limpa.split('/');
        return {
          municipio: partes[0]?.trim() || null,
          uf: partes[1]?.trim() || null
        };
      }

      const m = limpa.match(/^(.*?)([A-Z]{2})$/i);
      if (m) {
        return {
          municipio: m[1].trim(),
          uf: m[2].toUpperCase()
        };
      }

      return { municipio: limpa, uf: null };
    }

    function definirFinalidadePorAtividade(dados) {
      const atividade = (dados.atividade || '').trim().toUpperCase();

      if (atividade === 'A413') {
        dados.finalidade = 'Aquisição de imóvel usado';
      } else if (atividade === 'B438') {
        dados.finalidade = 'Aquisição de terreno e construção';
      } else if (atividade === 'B437') {
        dados.finalidade = 'Construção em terreno próprio';
      }
    }

    function formatarAtividadeParaTela(valor) {
      const limpo = String(valor || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9-]/g, '');

      const m = limpo.match(/^([A-Z])[-]?(\d{3})$/);
      if (!m) return valor || '';

      return `${m[1]}-${m[2]}`;
    }

    function extrairDadosTxt(texto) {
      const dados = criarDadosBase();
      const bruto = String(texto || '');

      dados.os = extrairCodigoOS(bruto);

      const atividade = bruto.match(/Atividade\s*[:.]?\s*([A-Z]\d{3})/i);
      if (atividade) dados.atividade = atividade[1].trim().toUpperCase();

      const produto = bruto.match(/Produto\s*\.?\s*[:.]?\s*(\d{3,4})/i);
      if (produto) dados.produto = produto[1].trim();

      const linha = bruto.match(/Linha\s*\.{0,3}\s*[:.]?\s*(\d{3,4})/i);
      if (linha) dados.linha = linha[1].trim();

      const fonte = bruto.match(/Fonte\s*\.{0,3}\s*[:.]?\s*(\d{3,4})/i);
      if (fonte) dados.fonte = fonte[1].trim();

      const cliente = bruto.match(/Cliente\s*\.?\s*[:.]?\s*([0-9./-]+)\s*-\s*(.+)/i);
      if (cliente) {
        dados.cpfCnpj = cliente[1].trim();
        dados.nomeProponente = cliente[2].trim();

        const digits = dados.cpfCnpj.replace(/\D/g, '');
        if (digits.length === 11) dados.tipoPessoa = 'CPF';
        if (digits.length === 14) dados.tipoPessoa = 'CNPJ';
      }

      const endereco = bruto.match(/Endere[cç]o\.?\s*[:.]?\s*(.+)/i);
      if (endereco) {
        const linhaEndereco = endereco[1].trim();
        const partes = linhaEndereco.split(/\s*-\s*/);
        const parteRuaNumero = partes[0] || '';
        const parteBairro = partes.slice(1).join(' - ').trim();

        const ruaNumeroMatch = parteRuaNumero.match(/^(.*?),\s*([^,]+)$/);
        if (ruaNumeroMatch) {
          dados.logradouro = ruaNumeroMatch[1].trim();
          dados.numero = ruaNumeroMatch[2].trim();
        } else {
          dados.logradouro = parteRuaNumero.trim();
        }

        if (parteBairro) dados.bairro = parteBairro;
      }

      const cidadeUf = extrairMunicipioUf(bruto);
      dados.municipio = cidadeUf.municipio;
      dados.uf = cidadeUf.uf;

      const cep = bruto.match(/CEP\.{0,6}\s*[:.]?\s*([0-9]{5}-?[0-9]{3})/i);
      if (cep) dados.cep = cep[1].trim();

      const setor = bruto.match(/Setor\s*[:.]\s*(.+)/i);
      if (setor) dados.setor = setor[1].trim();

      const quadra = bruto.match(/Quadra\s*[:.]\s*(.+)/i);
      if (quadra) dados.quadra = quadra[1].trim();

      const bloco = bruto.match(/Bloco\s*[:.]\s*(.+)/i);
      if (bloco) dados.bloco = bloco[1].trim();

      const lote = bruto.match(/Lote\s*[:.]\s*(.+)/i);
      if (lote) dados.lote = lote[1].trim();

      const conjunto = bruto.match(/Conjunto\s*[:.]\s*(.+)/i);
      if (conjunto) dados.conjunto = conjunto[1].trim();

      const unidade = bruto.match(/(?:N[º°o]?\s*Unidade|Unidade)\s*[:.]\s*(.+)/i);
      if (unidade) dados.unidade = unidade[1].trim();

      const nomeEmp = bruto.match(/Nome\s+Empreendimento\s*[:.]\s*(.+)/i);
      if (nomeEmp) dados.nomeEmpreendimento = nomeEmp[1].trim();

      const complementos = bruto.match(/Complementos\s*[:.]\s*(.+)/i);
      if (complementos) dados.complementos = complementos[1].trim();

      definirFinalidadePorAtividade(dados);
      return dados;
    }

    const ROTULOS_PDF = [
      'Empresa', 'Município', 'Telefone', 'Email', 'A/C', 'CNPJ', 'UF', 'FAX',
      'Assunto', 'Atividade', 'Produto', 'Linha', 'Fonte', 'Referência', 'Nome Cliente',
      'Identificação', 'Endereço', 'Numero', 'CEP', 'Cidade/UF', 'Prazo de Execução',
      'Valor Previsto do Serviço', 'Nome do Contato', 'Telefone do Contato',
      'Local de Retirada de Documentos', 'Complemento', 'Bairro', 'Observação',
      'Matrícula', 'Data/Hora Solicitação', 'Telefone Adicional'
    ];

    function obterLinhasUteis(texto) {
      return String(texto || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(l => l.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean);
    }

    function ehRotuloPdf(linha) {
      const base = normalize(String(linha || '').replace(/[:.]\s*$/, ''));
      return ROTULOS_PDF.some(rotulo => normalize(rotulo) === base);
    }

    function extrairCampoPdfPorRotulo(linhas, rotulo, opcoes = {}) {
      const { pegarLinhaSeguinte = true } = opcoes;
      const alvo = normalize(rotulo);
      const regexLinha = new RegExp(`^\\s*${escapeRegex(rotulo)}\\s*[:.]?\\s*(.*)$`, 'i');

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const linhaNorm = normalize(String(linha || '').replace(/[:.]\s*$/, ''));

        if (linhaNorm !== alvo) {
          const mMesmaLinha = linha.match(regexLinha);
          if (mMesmaLinha && mMesmaLinha[1]?.trim()) {
            return mMesmaLinha[1].trim();
          }
          continue;
        }

        const m = linha.match(regexLinha);
        const resto = m?.[1]?.trim();
        if (resto) return resto;
        if (!pegarLinhaSeguinte) return null;

        for (let j = i + 1; j < linhas.length; j++) {
          const prox = linhas[j]?.trim();
          if (!prox) continue;
          if (ehRotuloPdf(prox)) return null;
          return prox;
        }
      }

      return null;
    }

    function extrairBlocoSequencialPdf(linhas, rotulos) {
      const rotulosNorm = rotulos.map(r => normalize(r));

      for (let i = 0; i <= linhas.length - rotulos.length; i++) {
        let blocoValido = true;
        const saida = {};

        for (let k = 0; k < rotulos.length; k++) {
          const linha = linhas[i + k] || '';
          const regex = new RegExp(`^\\s*${escapeRegex(rotulos[k])}\\s*[:.]?\\s*(.*)$`, 'i');
          const base = normalize(String(linha).replace(/[:.]\s*$/, ''));
          const m = linha.match(regex);

          if (!(base === rotulosNorm[k] || m)) {
            blocoValido = false;
            break;
          }

          const valorMesmaLinha = m?.[1]?.trim();
          if (valorMesmaLinha) {
            saida[rotulos[k]] = valorMesmaLinha;
          }
        }

        if (!blocoValido) continue;

        let cursor = i + rotulos.length;

        for (const rotulo of rotulos) {
          if (saida[rotulo]) continue;

          while (cursor < linhas.length && !linhas[cursor]?.trim()) {
            cursor++;
          }

          if (cursor >= linhas.length) break;

          if (ehRotuloPdf(linhas[cursor])) {
            saida[rotulo] = null;
            continue;
          }

          saida[rotulo] = linhas[cursor].trim();
          cursor++;
        }

        return saida;
      }

      return {};
    }

    function limparCep(valor) {
      if (!valor) return null;
      const m = String(valor).match(/\d{2}\.?\d{3}-?\d{3}/);
      return m ? m[0] : String(valor).trim();
    }

    function extrairPrimeiroCodigoNumerico(valor) {
      const m = String(valor || '').match(/\b\d{3,4}\b/);
      return m ? m[0] : null;
    }

    function extrairDadosPdf(texto) {
      const dados = criarDadosBase();
      const linhas = obterLinhasUteis(texto);

      dados.os = extrairCodigoOS(texto);

      const bloco1 = extrairBlocoSequencialPdf(linhas, [
        'Assunto',
        'Atividade',
        'Produto',
        'Linha',
        'Fonte'
      ]);

      const bloco2 = extrairBlocoSequencialPdf(linhas, [
        'Referência',
        'Nome Cliente',
        'Identificação',
        'Endereço',
        'Numero'
      ]);

      const bloco3 = extrairBlocoSequencialPdf(linhas, [
        'CEP',
        'Cidade/UF',
        'Prazo de Execução',
        'Valor Previsto do Serviço',
        'Nome do Contato'
      ]);

      const assunto = bloco1['Assunto'] || extrairCampoPdfPorRotulo(linhas, 'Assunto');
      const atividadeNumero = bloco1['Atividade'] || extrairCampoPdfPorRotulo(linhas, 'Atividade');

      if (assunto && atividadeNumero) {
        dados.atividade = `${String(assunto).trim()}${String(atividadeNumero).trim()}`.toUpperCase();
      }

      dados.produto = extrairPrimeiroCodigoNumerico(
        bloco1['Produto'] || extrairCampoPdfPorRotulo(linhas, 'Produto')
      );

      dados.linha = extrairPrimeiroCodigoNumerico(
        bloco1['Linha'] || extrairCampoPdfPorRotulo(linhas, 'Linha')
      );

      dados.fonte = extrairPrimeiroCodigoNumerico(
        bloco1['Fonte'] || extrairCampoPdfPorRotulo(linhas, 'Fonte')
      );

      dados.nomeProponente =
        bloco2['Nome Cliente'] || extrairCampoPdfPorRotulo(linhas, 'Nome Cliente');

      dados.logradouro =
        bloco2['Endereço'] || extrairCampoPdfPorRotulo(linhas, 'Endereço');

      dados.numero =
        bloco2['Numero'] || extrairCampoPdfPorRotulo(linhas, 'Numero');

      dados.cep = limparCep(
        bloco3['CEP'] || extrairCampoPdfPorRotulo(linhas, 'CEP')
      );

      const cidadeUf =
        bloco3['Cidade/UF'] || extrairCampoPdfPorRotulo(linhas, 'Cidade/UF');

      if (cidadeUf) {
        const partes = cidadeUf.split('/');
        dados.municipio = partes[0]?.trim() || null;
        dados.uf = partes[1]?.trim() || null;
      }

      dados.bairro = extrairCampoPdfPorRotulo(linhas, 'Bairro');
      dados.complementos = extrairCampoPdfPorRotulo(linhas, 'Complemento', { pegarLinhaSeguinte: false });

      const identificacao =
        bloco2['Identificação'] || extrairCampoPdfPorRotulo(linhas, 'Identificação');

      const digits = String(identificacao || '').replace(/\D/g, '');
      if (digits.length === 11 || digits.length === 14) {
        dados.cpfCnpj = identificacao.trim();
        dados.tipoPessoa = digits.length === 11 ? 'CPF' : 'CNPJ';
      }

      definirFinalidadePorAtividade(dados);
      return dados;
    }

    function encontrarCampoPorLabel(textoLabel, tipo = 'input') {
      const nodes = [...document.querySelectorAll('label, span, div, td')];
      const alvo = normalize(textoLabel);

      for (const node of nodes) {
        const txt = normalize(node.textContent || '');
        if (txt !== alvo) continue;

        const candidatos = [];
        const scopes = [
          node,
          node.parentElement,
          node.parentElement?.parentElement,
          node.parentElement?.parentElement?.parentElement
        ];

        scopes.forEach(scope => {
          if (!scope) return;
          if (tipo === 'select') {
            candidatos.push(...scope.querySelectorAll('select'));
          } else {
            candidatos.push(...scope.querySelectorAll('input[type="text"], input:not([type])'));
          }
        });

        const unicos = [...new Set(candidatos)].filter(el => isVisible(el) && !el.disabled && !el.readOnly);
        if (unicos.length) return unicos[0];
      }

      return null;
    }

    function preencherCampo(el, valor) {
      if (!el || valor == null || valor === '') return false;

      const valorFinal = String(valor);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

      el.focus();

      if (setter) {
        setter.call(el, valorFinal);
      } else {
        el.value = valorFinal;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      el.blur();

      return true;
    }

    async function preencherAtividadeComoDigitacao(el, valor) {
      if (!el || !valor) return false;

      const bruto = String(valor).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-Z]\d{3}$/.test(bruto)) return false;

      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const setValor = (v) => {
        if (setter) setter.call(el, v);
        else el.value = v;
      };

      el.focus();
      el.click();

      setValor('');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));

      await sleep(120);

      for (const ch of bruto) {
        const antes = String(el.value || '');
        const proximo = antes + ch;

        el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keypress', { key: ch, bubbles: true }));

        setValor(proximo);

        try {
          const pos = String(el.value || '').length;
          el.setSelectionRange?.(pos, pos);
        } catch (_) { }

        if (typeof InputEvent !== 'undefined') {
          el.dispatchEvent(new InputEvent('input', {
            data: ch,
            inputType: 'insertText',
            bubbles: true
          }));
        } else {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }

        el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));

        await sleep(140);
      }

      el.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(180);

      let valorFinalNormalizado = String(el.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (valorFinalNormalizado !== bruto) {
        const formatado = formatarAtividadeParaTela(bruto);
        setValor(formatado);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(180);
        valorFinalNormalizado = String(el.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      }

      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      el.blur();

      await sleep(180);

      return String(el.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === bruto;
    }

    function selecionarOpcao(select, textoOpcao) {
      if (!select || !textoOpcao) return false;

      const alvo = normalize(textoOpcao);
      const option = [...select.options].find(opt => normalize(opt.textContent) === alvo);

      if (!option) return false;

      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.blur();
      return true;
    }

    function clicarRadioPorTexto(texto) {
      const labels = [...document.querySelectorAll('label, span, div, td')];
      const alvo = normalize(texto);

      for (const node of labels) {
        const txt = normalize(node.textContent || '');
        if (txt !== alvo) continue;

        const scopes = [node, node.parentElement, node.parentElement?.parentElement];
        for (const scope of scopes) {
          if (!scope) continue;
          const radios = [...scope.querySelectorAll('input[type="radio"]')].filter(r => !r.disabled);
          if (radios.length) {
            radios[0].click();
            radios[0].dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }

      return false;
    }

    function encontrarInputCpfCnpj() {
      let el = document.querySelector(
        'input[id$="inputCpfCnpj"], input[name$="inputCpfCnpj"], input[id*="inputCpfCnpj"], input[name*="inputCpfCnpj"]'
      );
      if (el && isVisible(el) && !el.disabled && !el.readOnly) return el;

      const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')]
        .filter(el => isVisible(el) && !el.disabled && !el.readOnly);

      el = inputs.find(i => {
        const ph = normalize(i.getAttribute('placeholder') || '');
        return ph.includes('___.___.___-__') || ph.includes('___.___.___/____-__');
      });
      if (el) return el;

      return null;
    }

    function preencherCepSomente(cep) {
      if (!cep) return { campo: 'CEP', ok: false, valor: cep };

      const inputCep = encontrarCampoPorLabel('CEP', 'input');
      if (!inputCep) return { campo: 'CEP', ok: false, valor: cep };

      inputCep.focus();
      inputCep.value = cep;
      inputCep.dispatchEvent(new Event('input', { bubbles: true }));
      inputCep.dispatchEvent(new Event('change', { bubbles: true }));
      inputCep.dispatchEvent(new Event('blur', { bubbles: true }));
      inputCep.blur();

      return { campo: 'CEP', ok: true, valor: cep };
    }

    function preencherCamposEtapa1(dados) {
      if (!dados.os) return [];

      const mapa = [
        { label: 'GIHAB', valor: dados.os.gihab },
        { label: 'Cod. Solicitante', valor: dados.os.codSolicitante },
        { label: 'Ordenador', valor: dados.os.ordenador },
        { label: 'Ano', valor: dados.os.ano },
        { label: 'Complemento', valor: dados.os.complemento }
      ];

      return mapa.map(item => {
        const input = encontrarCampoPorLabel(item.label, 'input');
        return { campo: item.label, ok: preencherCampo(input, item.valor), valor: item.valor };
      });
    }

    async function preencherCamposEtapa2(dados) {
      const resultado = [];
      const atividadeTela = formatarAtividadeParaTela(dados.atividade);

      const inputAtividade = encontrarCampoPorLabel('Atividade', 'input');
      const atividadeOk = await preencherAtividadeComoDigitacao(inputAtividade, dados.atividade);

      resultado.push({
        campo: 'Atividade',
        ok: atividadeOk,
        valor: atividadeTela
      });

      const camposTexto = [
        { label: 'Produto', valor: dados.produto },
        { label: 'Linha', valor: dados.linha },
        { label: 'Fonte', valor: dados.fonte },
        { label: 'Nome do Cliente', valor: dados.nomeProponente },
        { label: 'Município', valor: dados.municipio },
        { label: 'Bairro', valor: dados.bairro },
        { label: 'Logradouro', valor: dados.logradouro },
        { label: 'Número', valor: dados.numero },
        { label: 'Setor', valor: dados.setor },
        { label: 'Quadra', valor: dados.quadra },
        { label: 'Bloco', valor: dados.bloco },
        { label: 'Lote', valor: dados.lote },
        { label: 'Conjunto', valor: dados.conjunto },
        { label: 'Nº Unidade', valor: dados.unidade },
        { label: 'Nome Empreendimento', valor: dados.nomeEmpreendimento },
        { label: 'Complementos', valor: dados.complementos }
      ];

      camposTexto.forEach(item => {
        if (!item.valor) return;
        const input = encontrarCampoPorLabel(item.label, 'input');
        resultado.push({ campo: item.label, ok: preencherCampo(input, item.valor), valor: item.valor });
      });

      if (dados.cpfCnpj) {
        if (dados.tipoPessoa === 'CPF') {
          resultado.push({ campo: 'Radio CPF', ok: clicarRadioPorTexto('CPF'), valor: 'CPF' });
        } else if (dados.tipoPessoa === 'CNPJ') {
          resultado.push({ campo: 'Radio CNPJ', ok: clicarRadioPorTexto('CNPJ'), valor: 'CNPJ' });
        }

        let okDoc = false;
        for (let tentativa = 0; tentativa < 4; tentativa++) {
          await sleep(150);
          const inputDoc = encontrarInputCpfCnpj();
          okDoc = preencherCampo(inputDoc, dados.cpfCnpj);
          if (okDoc) break;
        }

        resultado.push({
          campo: 'CPF/CNPJ',
          ok: okDoc,
          valor: dados.cpfCnpj
        });
      }

      if (dados.finalidade) {
        const selectFinalidade = encontrarCampoPorLabel('Finalidade', 'select');
        resultado.push({
          campo: 'Finalidade',
          ok: selecionarOpcao(selectFinalidade, dados.finalidade),
          valor: dados.finalidade
        });
      }

      const selectCategoria = encontrarCampoPorLabel('Categoria', 'select');
      resultado.push({
        campo: 'Categoria',
        ok: selecionarOpcao(selectCategoria, 'Casa'),
        valor: 'Casa'
      });

      if (dados.uf) {
        const selectUf = encontrarCampoPorLabel('UF', 'select');
        resultado.push({
          campo: 'UF',
          ok: selecionarOpcao(selectUf, dados.uf),
          valor: dados.uf
        });
      }

      if (dados.cep) {
        resultado.push(preencherCepSomente(dados.cep));
      }

      return resultado;
    }

    function decodePdfLiteralString(str) {
      return String(str || '')
        .replace(/\\([nrtbf()\\])/g, (_, c) => {
          const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
          return map[c] ?? c;
        })
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    }

    function decodePdfHexString(hex) {
      const clean = String(hex || '').replace(/\s+/g, '');
      if (!clean) return '';

      const pares = clean.match(/.{1,2}/g) || [];
      const bytes = new Uint8Array(pares.map(h => parseInt(h, 16)).filter(n => !Number.isNaN(n)));
      if (!bytes.length) return '';

      try {
        if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
          return new TextDecoder('utf-16be').decode(bytes.slice(2));
        }
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
          return new TextDecoder('utf-16le').decode(bytes.slice(2));
        }
      } catch (_) { }

      return new TextDecoder('latin1').decode(bytes);
    }

    function extrairTextoDosOperadoresPdf(conteudo) {
      const blocosTexto = [];

      for (const [, bloco] of String(conteudo || '').matchAll(/\bBT\b([\s\S]*?)\bET\b/g)) {
        for (const m of bloco.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj\b/g)) {
          blocosTexto.push(decodePdfLiteralString(m[1]));
        }

        for (const m of bloco.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj\b/g)) {
          blocosTexto.push(decodePdfHexString(m[1]));
        }

        for (const m of bloco.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ\b/g)) {
          for (const sub of m[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)) {
            blocosTexto.push(decodePdfLiteralString(sub[1]));
          }
          for (const sub of m[1].matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
            blocosTexto.push(decodePdfHexString(sub[1]));
          }
        }
      }

      const linhas = blocosTexto
        .map(x => String(x || '').replace(/\r/g, '\n'))
        .join('\n')
        .split('\n')
        .map(x => x.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean);

      const semDuplicidadeSequencial = [];
      for (const linha of linhas) {
        if (semDuplicidadeSequencial[semDuplicidadeSequencial.length - 1] !== linha) {
          semDuplicidadeSequencial.push(linha);
        }
      }

      return semDuplicidadeSequencial.join('\n').trim();
    }

    async function descomprimirFlate(bytes) {
      if (typeof DecompressionStream === 'undefined') return null;

      try {
        const ds = new DecompressionStream('deflate');
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
      } catch (_) {
        return null;
      }
    }

    async function lerTextoDePdf(file) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const raw = new TextDecoder('latin1').decode(bytes);

      const candidatos = [raw];
      const streamRegex = /(\d+\s+\d+\s+obj[\s\S]*?)stream\r?\n/g;
      let m;

      while ((m = streamRegex.exec(raw)) !== null) {
        const header = m[1] || '';
        const inicioStream = streamRegex.lastIndex;
        const resto = raw.slice(inicioStream);
        const endstreamMatch = /\r?\nendstream/.exec(resto);
        if (!endstreamMatch) continue;

        const fimStream = inicioStream + endstreamMatch.index;
        const bytesStream = bytes.slice(inicioStream, fimStream);

        if (/\/FlateDecode/i.test(header)) {
          const descompactado = await descomprimirFlate(bytesStream);
          if (descompactado?.length) {
            candidatos.push(new TextDecoder('latin1').decode(descompactado));
          }
        } else {
          candidatos.push(new TextDecoder('latin1').decode(bytesStream));
        }

        streamRegex.lastIndex = fimStream + endstreamMatch[0].length;
      }

      const partesExtraidas = candidatos
        .map(extrairTextoDosOperadoresPdf)
        .filter(Boolean);

      const texto = partesExtraidas.join('\n').trim();
      if (!texto) {
        throw new Error('Não foi possível extrair texto do PDF.');
      }

      return texto;
    }

    async function lerArquivoComEscolha() {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain,.pdf,application/pdf';
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            input.remove();
            return resolve(null);
          }

          try {
            const isPdf =
              file.type === 'application/pdf' ||
              file.name.toLowerCase().endsWith('.pdf');

            const texto = isPdf ? await lerTextoDePdf(file) : await file.text();
            resolve({ texto, origem: isPdf ? 'pdf' : 'txt', nome: file.name });
          } catch (err) {
            reject(err);
          } finally {
            input.remove();
          }
        });

        (document.body || document.documentElement).appendChild(input);
        input.click();
      });
    }

    async function importarEtapa1() {
      let arquivo;
      try {
        arquivo = await lerArquivoComEscolha();
      } catch (err) {
        console.error('[SIMIL-OS-IMPORT][Etapa 1] erro ao ler arquivo:', err);
        toast(`Falha ao ler o arquivo.\n${err?.message || err}`);
        return;
      }
      if (!arquivo?.texto) return;

      const dados = arquivo.origem === 'pdf' ? extrairDadosPdf(arquivo.texto) : extrairDadosTxt(arquivo.texto);
      if (!dados.os) {
        toast('Não consegui localizar o código da OS no arquivo.');
        return;
      }

      const resultado = preencherCamposEtapa1(dados);
      const preenchidos = resultado.filter(x => x.ok).length;

      console.log('[SIMIL-OS-IMPORT][Etapa 1] Origem:', arquivo.origem);
      console.log('[SIMIL-OS-IMPORT][Etapa 1] Dados:', dados);
      console.log('[SIMIL-OS-IMPORT][Etapa 1] Resultado:', resultado);

      toast(
        `OS encontrada: ${dados.os.codigoCompleto}\n` +
        `Preenchidos ${preenchidos}/${resultado.length} campos.`
      );
    }

    async function importarEtapa2() {
      let arquivo;
      try {
        arquivo = await lerArquivoComEscolha();
      } catch (err) {
        console.error('[SIMIL-OS-IMPORT][Etapa 2] erro ao ler arquivo:', err);
        toast(`Falha ao ler o arquivo.\n${err?.message || err}`);
        return;
      }
      if (!arquivo?.texto) return;

      const dados = arquivo.origem === 'pdf' ? extrairDadosPdf(arquivo.texto) : extrairDadosTxt(arquivo.texto);
      const resultado = await preencherCamposEtapa2(dados);
      const preenchidos = resultado.filter(x => x.ok).length;

      console.log('[SIMIL-OS-IMPORT][Etapa 2] Origem:', arquivo.origem);
      console.log('[SIMIL-OS-IMPORT][Etapa 2] Dados:', dados);
      console.log('[SIMIL-OS-IMPORT][Etapa 2] Resultado:', resultado);

      toast(
        `Dados da OS processados.\n` +
        `Preenchidos ${preenchidos}/${resultado.length} campos.`
      );
    }

    function ensureButtons() {
      if (!document.getElementById(BTN1_ID)) {
        const btn1 = document.createElement('button');
        btn1.id = BTN1_ID;
        btn1.type = 'button';
        btn1.textContent = 'Cadastrar OS';
        btn1.title = 'Preencher campos iniciais da OS';

        btn1.style.cssText = `
          position: fixed;
          right: 16px;
          bottom: 64px;
          z-index: 2147483647;
          padding: 10px 12px;
          border: 0;
          border-radius: 10px;
          background: #198754;
          color: #fff;
          font: 600 13px Arial, sans-serif;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,.18);
        `;

        btn1.addEventListener('click', importarEtapa1);
        (document.body || document.documentElement).appendChild(btn1);
      }

      if (!document.getElementById(BTN2_ID)) {
        const btn2 = document.createElement('button');
        btn2.id = BTN2_ID;
        btn2.type = 'button';
        btn2.textContent = 'Arquivo OS - Demais Campos';
        btn2.title = 'Preencher campos após gravar a OS';

        btn2.style.cssText = `
          position: fixed;
          right: 138px;
          bottom: 64px;
          z-index: 2147483647;
          padding: 10px 12px;
          border: 0;
          border-radius: 10px;
          background: #198754;
          color: #fff;
          font: 600 13px Arial, sans-serif;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(0,0,0,.18);
        `;

        btn2.addEventListener('click', importarEtapa2);
        (document.body || document.documentElement).appendChild(btn2);
      }
    }

    ensureButtons();

    const obs = new MutationObserver(() => ensureButtons());
    obs.observe(document.documentElement, { childList: true, subtree: true });

  } catch (err) {
    console.error('[SIMIL-OS-IMPORT] erro:', err);
  }
})();