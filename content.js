(() => {
  try {
    if (!location.href.includes('/pages/laudo/construcao/cadastrarlaudo.xhtml')) return;

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
      const match = texto.match(/(\d{4})\.(\d{4})\.(\d{9})\/(\d{4})\.(\d{2})\.(\d{2})/);
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
        (texto.match(/Cidade\/?UF\s*[:.]?\s*(.+)/i) || [])[1] ||
        (texto.match(/Cidade\s*\/\s*UF\s*[:.]?\s*(.+)/i) || [])[1];

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

    function extrairDadosTxt(texto) {
      const dados = {
        os: extrairCodigoOS(texto),
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
      };

      const atividade = texto.match(/Atividade\s*[:.]?\s*([A-Z]\d{3})/i);
      if (atividade) dados.atividade = atividade[1].trim();

      const produto = texto.match(/Produto\s*\.?\s*[:.]?\s*(\d{4})/i);
      if (produto) dados.produto = produto[1].trim();

      const linha = texto.match(/Linha\s*\.{0,3}\s*[:.]?\s*(\d{4})/i);
      if (linha) dados.linha = linha[1].trim();

      const fonte = texto.match(/Fonte\s*\.{0,3}\s*[:.]?\s*(\d{4})/i);
      if (fonte) dados.fonte = fonte[1].trim();

      const cliente = texto.match(/Cliente\s*\.?\s*[:.]?\s*([0-9./-]+)\s*-\s*(.+)/i);
      if (cliente) {
        dados.cpfCnpj = cliente[1].trim();
        dados.nomeProponente = cliente[2].trim();

        const digits = dados.cpfCnpj.replace(/\D/g, '');
        if (digits.length === 11) dados.tipoPessoa = 'CPF';
        if (digits.length === 14) dados.tipoPessoa = 'CNPJ';
      }

      if (dados.atividade === 'B438') {
        dados.finalidade = 'Aquisição de terreno e construção';
      } else if (dados.atividade === 'B437') {
        dados.finalidade = 'Construção em terreno próprio';
      }

      const endereco = texto.match(/Endere[cç]o\.?\s*[:.]?\s*(.+)/i);
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

      const cidadeUf = extrairMunicipioUf(texto);
      dados.municipio = cidadeUf.municipio;
      dados.uf = cidadeUf.uf;

      const cep = texto.match(/CEP\.{0,6}\s*[:.]?\s*([0-9]{5}-?[0-9]{3})/i);
      if (cep) dados.cep = cep[1].trim();

      const setor = texto.match(/Setor\s*[:.]\s*(.+)/i);
      if (setor) dados.setor = setor[1].trim();

      const quadra = texto.match(/Quadra\s*[:.]\s*(.+)/i);
      if (quadra) dados.quadra = quadra[1].trim();

      const bloco = texto.match(/Bloco\s*[:.]\s*(.+)/i);
      if (bloco) dados.bloco = bloco[1].trim();

      const lote = texto.match(/Lote\s*[:.]\s*(.+)/i);
      if (lote) dados.lote = lote[1].trim();

      const conjunto = texto.match(/Conjunto\s*[:.]\s*(.+)/i);
      if (conjunto) dados.conjunto = conjunto[1].trim();

      const unidade = texto.match(/(?:N[º°o]?\s*Unidade|Unidade)\s*[:.]\s*(.+)/i);
      if (unidade) dados.unidade = unidade[1].trim();

      const nomeEmp = texto.match(/Nome\s+Empreendimento\s*[:.]\s*(.+)/i);
      if (nomeEmp) dados.nomeEmpreendimento = nomeEmp[1].trim();

      const complementos = texto.match(/Complementos\s*[:.]\s*(.+)/i);
      if (complementos) dados.complementos = complementos[1].trim();

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

      el.focus();
      el.value = valor;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      el.blur();

      return true;
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

      const camposTexto = [
        { label: 'Atividade', valor: dados.atividade },
        { label: 'Produto', valor: dados.produto },
        { label: 'Linha', valor: dados.linha },
        { label: 'Fonte', valor: dados.fonte },
        { label: 'Nome do Proponente', valor: dados.nomeProponente },
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

      if (dados.cep) {
        resultado.push(preencherCepSomente(dados.cep));
      }

      return resultado;
    }

    function decodePdfLiteralString(str) {
      return str
        .replace(/\\([nrtbf()\\])/g, (_, c) => {
          const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
          return map[c] ?? c;
        })
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
    }

    async function lerTextoDePdf(file) {
      const buffer = await file.arrayBuffer();
      const raw = new TextDecoder('latin1').decode(new Uint8Array(buffer));

      const blocosTexto = [];
      const blocosBT = raw.matchAll(/BT([\s\S]*?)ET/g);

      for (const [, bloco] of blocosBT) {
        for (const m of bloco.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)) {
          blocosTexto.push(decodePdfLiteralString(m[1]));
        }

        for (const m of bloco.matchAll(/\[((?:.|\n|\r)*?)\]\s*TJ/g)) {
          for (const sub of m[1].matchAll(/\(((?:\\.|[^\\()])*)\)/g)) {
            blocosTexto.push(decodePdfLiteralString(sub[1]));
          }
        }
      }

      const texto = blocosTexto
        .join('\n')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!texto) {
        throw new Error('Não foi possível extrair texto do PDF. Verifique se o PDF contém texto selecionável.');
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
            resolve(texto);
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
      let texto;
      try {
        texto = await lerArquivoComEscolha();
      } catch (err) {
        console.error('[SIMIL-OS-IMPORT][Etapa 1] erro ao ler arquivo:', err);
        toast(`Falha ao ler o arquivo.\n${err?.message || err}`);
        return;
      }
      if (!texto) return;

      const dados = extrairDadosTxt(texto);
      if (!dados.os) {
        toast('Não consegui localizar o código da OS no arquivo.');
        return;
      }

      const resultado = preencherCamposEtapa1(dados);
      const preenchidos = resultado.filter(x => x.ok).length;

      console.log('[SIMIL-OS-IMPORT][Etapa 1] Dados:', dados);
      console.log('[SIMIL-OS-IMPORT][Etapa 1] Resultado:', resultado);

      toast(
        `OS encontrada: ${dados.os.codigoCompleto}\n` +
        `Preenchidos ${preenchidos}/${resultado.length} campos.`
      );
    }

    async function importarEtapa2() {
      let texto;
      try {
        texto = await lerArquivoComEscolha();
      } catch (err) {
        console.error('[SIMIL-OS-IMPORT][Etapa 2] erro ao ler arquivo:', err);
        toast(`Falha ao ler o arquivo.\n${err?.message || err}`);
        return;
      }
      if (!texto) return;

      const dados = extrairDadosTxt(texto);
      const resultado = await preencherCamposEtapa2(dados);
      const preenchidos = resultado.filter(x => x.ok).length;

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
