/*
 * Abrir uma DAV ja gravada, ajustar e reenviar (alteracao).
 *
 * Arquivo independente, como o frete.js e o desconto.js. O bundle do Angular
 * (main-*.js) so expoe a tela em window.tvTela e pergunta para este arquivo:
 *   window.tvEdicao()       -> { codigo, data } da DAV aberta (ou null = DAV nova)
 *   window.tvDavUrl(payload)-> webhook de alteracao quando a DAV tem codigo
 *   window.tvLimparEdicao() -> chamado depois de gravar o pedido
 *
 * Fluxo: botao "ABRIR DAV (F6)" -> tipo + numero -> webhook dav-obter (n8n,
 * GET /public-api/v1/davs) -> preenche cliente, vendedor, CFOP, tipo, condicao,
 * financeiro, frete, desconto, observacao e itens. Os filhos voltam das linhas
 * "[PAI x] filho - descricao qtd UN" da observacao, com o preco atual do cadastro.
 * Ao gravar, a DAV vai com o codigo da anterior para o webhook dav-alterar, que
 * cria uma DAV NOVA (numero sequencial, observacao "Substitui ...") e so depois
 * cancela a anterior: o Uniplus nao deixa regravar uma DAV com o mesmo numero.
 */
(function () {
  'use strict';

  var N8N = 'https://n8n.srv1149367.hstgr.cloud/webhook/';
  var URL_OBTER = N8N + 'tela-vendas/dav-obter';
  var URL_ALTERAR = N8N + 'tela-vendas/dav-alterar';

  // So da para alterar DAV em edicao ou nao faturada (status 0 ou 1)
  var STATUS_EDITAVEL = [0, 1];
  var STATUS_NOME = { 0: 'Edição', 1: 'Não faturado', 2: 'PDV', 3: 'Cancelado', 4: 'Nota fiscal gerada',
    5: 'Pré-venda gerada', 6: 'Duplicado', 7: 'Faturado parcialmente', 8: 'Pedido gerado',
    9: 'Incluído por cliente', 10: 'Mesclado' };
  var TIPOS = [[6, 'Pedido de Faturamento'], [4, 'Pedido de Venda'], [2, 'Orçamento'], [7, 'Orçamento de Faturamento']];

  var edicao = null; // { codigo, data, tipoDocumento }

  window.tvEdicao = function () { return edicao; };
  window.tvDavUrl = function (payload) {
    return edicao && payload && payload.dav && payload.dav.codigo ? URL_ALTERAR : undefined;
  };
  window.tvLimparEdicao = function () { edicao = null; atualizarSelo(); };

  // ---------- estilos ----------
  var css = document.createElement('style');
  css.textContent = [
    '#ed-abrir{margin-left:auto;margin-right:8px;display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border:0;border-radius:8px;',
    '  background:#fff;color:#172b4d;font:700 12px/1 Inter,Roboto,Segoe UI,sans-serif;letter-spacing:.04em;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
    '#ed-abrir:hover{background:#dbe8ff}',
    '#ed-abrir small{font-weight:400;opacity:.7}',
    '#ed-abrir ~ #kb-novo{margin-left:0}',
    '#ed-selo{margin-left:12px;align-self:center;padding:5px 10px;border-radius:6px;background:#fdd05a;color:#1c2551;',
    '  font:700 12px/1 Inter,Roboto,Segoe UI,sans-serif;letter-spacing:.03em}',
    '#ed-fundo{position:fixed;inset:0;z-index:1100;display:none;align-items:center;justify-content:center;background:rgba(23,43,77,.45)}',
    '#ed-fundo.aberto{display:flex}',
    '#ed-caixa{background:#fff;color:#172b4d;border-radius:12px;padding:20px 24px;width:min(400px,calc(100% - 32px));',
    '  box-shadow:0 10px 30px rgba(0,0,0,.25);font:14px/1.5 Inter,Roboto,Segoe UI,sans-serif}',
    '#ed-caixa h3{margin:0 0 14px;font-size:13px;letter-spacing:.06em}',
    '#ed-caixa label{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:13px;font-weight:700;color:#004664}',
    '#ed-caixa select,#ed-caixa input{padding:9px 12px;border:1px solid #c4c6d0;border-radius:8px;font:inherit;background:#fff;color:inherit}',
    '#ed-caixa select:focus,#ed-caixa input:focus{outline:2px solid #005cbb;outline-offset:-1px;border-color:#005cbb}',
    '#ed-msg{min-height:20px;margin:0 0 12px;font-size:13px;color:#a12a2e;white-space:pre-line}',
    '#ed-acoes{display:flex;justify-content:flex-end;gap:10px}',
    '#ed-acoes button{padding:10px 18px;border-radius:6px;font:700 13px/1 Inter,Roboto,Segoe UI,sans-serif;cursor:pointer}',
    '#ed-cancelar{background:#fff;color:#004664;border:1px solid #c4c6d0}',
    '#ed-ok{background:#6fae5f;color:#fff;border:0}',
    '#ed-ok:disabled{opacity:.6;cursor:wait}'
  ].join('\n');
  document.head.appendChild(css);

  // ---------- janela ----------
  var fundo = document.createElement('div');
  fundo.id = 'ed-fundo';
  fundo.innerHTML =
    '<div id="ed-caixa" role="dialog" aria-label="Abrir DAV">' +
    '  <h3>ABRIR DAV PARA ALTERAR</h3>' +
    '  <label>Tipo de documento<select id="ed-tipo">' +
    TIPOS.map(function (t) { return '<option value="' + t[0] + '">' + t[0] + ' - ' + t[1] + '</option>'; }).join('') +
    '  </select></label>' +
    '  <label>Número<input id="ed-numero" type="text" inputmode="numeric" autocomplete="off" placeholder="ex.: 17"></label>' +
    '  <p id="ed-msg"></p>' +
    '  <div id="ed-acoes"><button id="ed-cancelar" type="button">CANCELAR</button><button id="ed-ok" type="button">ABRIR</button></div>' +
    '</div>';

  function $(id) { return document.getElementById(id); }
  function msg(t) { $('ed-msg').textContent = t || ''; }

  function abrirJanela() {
    var t = window.tvTela;
    if (!t || t.carregandoCadastros) { window.alert('Aguarde carregar clientes e produtos.'); return; }
    if (!document.body.contains(fundo)) document.body.appendChild(fundo);
    var tipoAtual = Number(String(t.tipoDocumento || '').split(' - ')[0]);
    if (tipoAtual) $('ed-tipo').value = String(tipoAtual);
    msg('');
    fundo.classList.add('aberto');
    setTimeout(function () { $('ed-numero').focus(); $('ed-numero').select(); }, 0);
  }
  function fecharJanela() { fundo.classList.remove('aberto'); }

  fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) fecharJanela(); });
  fundo.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharJanela(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); buscar(); }
  });
  fundo.addEventListener('click', function (e) {
    if (e.target.id === 'ed-cancelar') fecharJanela();
    if (e.target.id === 'ed-ok') buscar();
  });

  // ---------- busca no n8n ----------
  // A resposta pode vir como lista, como { algo: [...] } ou como a propria DAV
  function extrairDavs(j) {
    var saida = [];
    (function andar(v) {
      if (!v || typeof v !== 'object') return;
      if (Array.isArray(v)) { v.forEach(andar); return; }
      if (v.dav && typeof v.dav === 'object') { andar(v.dav); return; }
      if ('codigo' in v && ('itens' in v || 'tipoDocumento' in v)) { saida.push(v); return; }
      Object.keys(v).forEach(function (k) { if (Array.isArray(v[k])) andar(v[k]); });
    })(j);
    return saida;
  }

  function buscar() {
    var numero = $('ed-numero').value.trim();
    var tipo = Number($('ed-tipo').value);
    if (!/^\d+$/.test(numero)) { msg('Informe o número da DAV.'); return; }
    var t = window.tvTela;
    if ((t.itens || []).length && !window.confirm('Descartar os itens lançados na tela e abrir a DAV ' + numero + '?')) return;

    $('ed-ok').disabled = true;
    msg('Buscando DAV ' + numero + '...');
    // O n8n repassa os filtros direto para GET /public-api/v1/davs
    fetch(URL_OBTER + '?codigo.eq=' + encodeURIComponent(numero) + '&tipoDocumento.eq=' + tipo + '&limit=5')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (txt) { return txt ? JSON.parse(txt) : []; })
      .then(function (j) {
        console.log('[editar-dav] resposta do n8n:', j);
        var davs = extrairDavs(j).filter(function (d) {
          return String(d.codigo) === numero && (d.tipoDocumento === undefined || Number(d.tipoDocumento) === tipo);
        });
        if (!davs.length) { msg('DAV ' + numero + ' não encontrada neste tipo de documento.'); return; }
        var d = davs[0];
        var st = Number(d.status);
        if (d.status !== undefined && d.status !== null && STATUS_EDITAVEL.indexOf(st) < 0) {
          msg('Essa DAV não pode ser alterada: status ' + st + ' - ' + (STATUS_NOME[st] || '?') + '.');
          return;
        }
        if (!Array.isArray(d.itens) || !d.itens.length) {
          msg('A DAV veio sem itens do Uniplus. Veja o console (F12) e me mande a resposta.');
          return;
        }
        var avisos = carregar(d);
        fecharJanela();
        if (avisos.length) window.alert('DAV ' + numero + ' carregada, mas confira:\n\n- ' + avisos.join('\n- '));
      })
      .catch(function (e) {
        console.error('[editar-dav]', e);
        msg('Não foi possível buscar a DAV (' + e.message + ').\nO workflow "Editar DAV" está ativo no n8n?');
      })
      .then(function () { $('ed-ok').disabled = false; });
  }

  // ---------- preenche a tela ----------
  function porCodigo(lista, codigo) {
    var c = String(codigo == null ? '' : codigo).trim();
    if (!c) return null;
    return (lista || []).filter(function (x) { return String(x.codigo).trim() === c; })[0] || null;
  }
  function numero(v) { var n = Number(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function brl(n) { return n.toFixed(2).replace('.', ','); }

  function setCampo(id, valor) {
    var el = $(id);
    if (!el) return;
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur'));
  }

  function carregar(d) {
    var t = window.tvTela;
    var avisos = [];
    var base = Date.now();

    // Cabecalho
    var tipo = Number(d.tipoDocumento);
    var tipoTxt = (t.tiposDocumento || []).filter(function (x) { return Number(x.split(' - ')[0]) === tipo; })[0];
    if (tipoTxt) t.tipoDocumento = tipoTxt;

    var cli = porCodigo(t.clientes, d.cliente);
    t.clienteSelecionado = cli;
    t.clienteBusca = cli ? cli.codigo + ' - ' + cli.nome : '';
    if (!cli && d.cliente) avisos.push('cliente ' + d.cliente + ' não está na lista de clientes ativos');

    var ven = porCodigo(t.vendedores, d.vendedor);
    t.vendedorSelecionado = ven;
    t.vendedorBusca = ven ? ven.codigo + ' - ' + ven.nome : '';
    if (!ven && d.vendedor) avisos.push('vendedor ' + d.vendedor + ' não está na lista de vendedores');

    var cfop = porCodigo(t.cfops, d.codigoCfop);
    if (cfop) { t.cfopSelecionado = cfop; t.cfop = cfop.codigo; t.cfopBusca = cfop.codigo + ' - ' + cfop.nome; }

    if (d.condicaoPagamento != null && d.condicaoPagamento !== '') t.condicaoPagamento = String(d.condicaoPagamento);
    if (d.tipoDocumentoFinanceiro != null && d.tipoDocumentoFinanceiro !== '') t.tipoDocumentoFinanceiro = Number(d.tipoDocumentoFinanceiro);

    // Observacao: linhas [PAI x] viram filhos; o resto volta para o texto livre
    var filhosPorPai = {};
    var livre = [];
    String(d.observacao || '').split(/\r?\n/).forEach(function (linha) {
      var m = linha.trim().match(/^\[PAI\s+(\S+)\]\s+(\S+)\s+-\s+.*\s+(\d+(?:[.,]\d+)?)(?:\s+\S+)?$/);
      if (!m) { if (linha.trim()) livre.push(linha); return; }
      (filhosPorPai[m[1]] = filhosPorPai[m[1]] || []).push({ codigo: m[2], quantidade: numero(m[3]) });
    });
    t.observacaoExtra = livre.join('\n');

    // Itens
    var usados = {};
    t.itens = d.itens.slice().sort(function (a, b) { return numero(a.nrItem) - numero(b.nrItem); }).map(function (it, i) {
      var cod = String(it.produto == null ? '' : it.produto).trim();
      var prod = porCodigo(t.produtosPais, cod);
      if (!prod) {
        avisos.push('produto ' + cod + ' não está no cadastro de produtos ativos (mantido como veio da DAV)');
        prod = { id: cod, codigo: cod, nome: 'Produto ' + cod, preco: numero(it.precoUnitario),
          unidade: it.codigoUnidadeMedida || 'UN', casasDecimais: 0 };
      }
      var pai = {
        id: base + i * 1000, tipo: 'PAI', produto: prod,
        quantidade: numero(it.quantidade), preco: numero(it.precoUnitario), precoDav: numero(it.precoUnitario),
        rastreio: String(it.informacaoAdicional || '').trim(), filhos: []
      };
      if (!usados[cod] && filhosPorPai[cod]) {
        usados[cod] = true;
        pai.filhos = filhosPorPai[cod].map(function (f, k) {
          var fp = porCodigo(t.produtosFilhos, f.codigo);
          if (!fp) avisos.push('filho ' + f.codigo + ' (do pai ' + cod + ') não está no cadastro');
          fp = fp || { id: f.codigo, codigo: f.codigo, nome: 'Produto ' + f.codigo, preco: 0, unidade: 'UN', casasDecimais: 0 };
          return { id: pai.id + k + 1, tipo: 'FILHO', produto: fp, quantidade: f.quantidade, preco: numero(fp.preco), paiId: pai.id, filhos: [] };
        });
      }
      return pai;
    });
    t.itemSelecionadoId = null;
    t.recalcularPais();

    // Pai com filhos: o preco passa a ser a soma dos filhos com o preco ATUAL do cadastro
    t.itens.forEach(function (p) {
      if (p.filhos.length && Math.abs(p.preco - p.precoDav) > 0.005) {
        avisos.push('preço do ' + p.produto.codigo + ' mudou de ' + brl(p.precoDav) + ' para ' + brl(p.preco) + ' (soma dos filhos com preço atual)');
      }
      delete p.precoDav;
    });

    // Frete e desconto (campos do frete.js e desconto.js)
    var frete = numero(d.valorFrete);
    setCampo('tv-frete', frete ? brl(frete) : '');
    var perc = numero(d.percentualDescontoSubtotal);
    var desc = numero(d.desconto);
    // O Uniplus grava o desconto do subtotal rateado nos itens (precoTotal menor) e
    // devolve desconto 0: recupera pela diferenca entre bruto e precoTotal
    if (!perc && !desc) {
      var bruto = 0, liquido = 0;
      d.itens.forEach(function (it) { bruto += numero(it.quantidade) * numero(it.precoUnitario); liquido += numero(it.precoTotal); });
      if (liquido > 0 && bruto - liquido > 0.005) desc = Math.round((bruto - liquido) * 100) / 100;
    }
    setCampo('tv-desconto', perc ? String(perc).replace('.', ',') + '%' : (desc ? brl(desc) : ''));

    edicao = { codigo: /^\d+$/.test(String(d.codigo)) ? Number(d.codigo) : d.codigo, data: d.data ? String(d.data).slice(0, 10) : null, tipoDocumento: tipo };
    t.mensagem = '';
    t.resultado = '';
    t.cdr.markForCheck();
    // condicao/financeiro ficam os da DAV (nao reaplica as preferencias do cliente)
    if (window.tvSincronizarPreferencias) window.tvSincronizarPreferencias();
    atualizarSelo();
    return avisos;
  }

  // ---------- botao e selo na barra ----------
  function nomeTipo(n) { var x = TIPOS.filter(function (t) { return t[0] === n; })[0]; return x ? x[1] : 'DAV'; }

  function atualizarSelo() {
    var barra = document.querySelector('app-vendas .topbar');
    if (!barra) return;
    var selo = $('ed-selo');
    if (!edicao) { if (selo) selo.remove(); return; }
    if (!selo) {
      selo = document.createElement('span');
      selo.id = 'ed-selo';
      var tab = barra.firstElementChild;
      barra.insertBefore(selo, tab ? tab.nextSibling : null);
    }
    var txt = 'ALTERANDO ' + nomeTipo(edicao.tipoDocumento).toUpperCase() + ' ' + edicao.codigo + ' · AO GRAVAR GERA NÚMERO NOVO';
    if (selo.textContent !== txt) selo.textContent = txt;
  }

  function montarBotao() {
    var barra = document.querySelector('app-vendas .topbar');
    if (!barra || $('ed-abrir')) return;
    var b = document.createElement('button');
    b.id = 'ed-abrir';
    b.type = 'button';
    b.title = 'Abrir uma DAV já gravada para alterar (F6)';
    b.innerHTML = '&#x270E; ABRIR DAV <small>(F6)</small>';
    b.addEventListener('click', abrirJanela);
    var novo = $('kb-novo');
    barra.insertBefore(b, novo || null);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'F6' || e.ctrlKey || e.altKey || e.metaKey) return;
    if (!document.querySelector('app-vendas')) return;
    e.preventDefault();
    abrirJanela();
  }, true);

  // A barra do Angular aparece depois do carregamento (o selo sai via tvLimparEdicao ao gravar)
  new MutationObserver(function () { montarBotao(); atualizarSelo(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
