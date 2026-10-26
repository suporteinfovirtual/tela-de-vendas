/*
 * Atalhos de teclado da tela de vendas.
 *
 * Arquivo independente: nao altera o bundle do Angular (main-*.js).
 * Ele so "aperta" os mesmos botoes que o usuario clicaria, entao toda a
 * regra de negocio continua sendo a que ja existe.
 *
 *   F1        Mostrar/ocultar ajuda de atalhos
 *   F2        Gravar pedido
 *   F3        Ir para a busca de produto pai
 *   F4        Adicionar filho ao item selecionado
 *   F8        Editar item selecionado
 *   F9        Voltar para o campo Cliente
 *   Del       Excluir item selecionado (fora de campos de texto, pede confirmacao)
 *   Enter     Proximo campo / escolhe o item destacado da lista
 *   Setas     Navegam nas listas de busca e nos itens lancados
 *   Esc       Fecha lista ou janela aberta
 */
(function () {
  'use strict';

  // ---------- estilos ----------
  var css = [
    '.suggestions button.kb-ativo,.product-results button.kb-ativo,.modal-results button.kb-ativo{',
    '  background:#dbe8ff!important;outline:2px solid #005cbb;outline-offset:-2px}',
    '.items-card tbody tr.selected{outline:2px solid #005cbb;outline-offset:-2px}',
    '.total-card .btn.large::after{content:" (F2)";font-weight:400;opacity:.8}',
    '.product-line .btn.primary::after{content:" (Enter)";font-weight:400;opacity:.8}',
    '.product-line .btn.secondary::after{content:" (F4)";font-weight:400;opacity:.8}',
    '.items-card .actions .btn.secondary::after{content:" (F8)";font-weight:400;opacity:.8}',
    '.items-card .actions .btn.danger::after{content:" (Del)";font-weight:400;opacity:.8}',
    'body.kb-on{padding-bottom:40px}',
    '#kb-barra{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;flex-wrap:wrap;gap:4px 14px;',
    '  align-items:center;padding:8px 16px;background:#172b4d;color:#fff;font:12px/1.4 Inter,Roboto,Segoe UI,sans-serif}',
    '#kb-barra b{display:inline-block;min-width:22px;padding:1px 5px;margin-right:4px;border-radius:4px;',
    '  background:#fff;color:#172b4d;text-align:center;font-weight:700}',
    '#kb-barra span{white-space:nowrap;cursor:pointer}',
    '#kb-ajuda{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;',
    '  background:rgba(23,43,77,.45)}',
    '#kb-ajuda.aberta{display:flex}',
    '#kb-ajuda .kb-box{background:#fff;color:#172b4d;border-radius:12px;padding:20px 24px;max-width:440px;',
    '  width:calc(100% - 32px);box-shadow:0 10px 30px rgba(0,0,0,.25);font:14px/1.5 Inter,Roboto,Segoe UI,sans-serif}',
    '#kb-ajuda h2{margin:0 0 12px;font-size:18px}',
    '#kb-ajuda table{width:100%;border-collapse:collapse}',
    '#kb-ajuda td{padding:5px 4px;border-bottom:1px solid #e3e6ec;vertical-align:top}',
    '#kb-ajuda td:first-child{white-space:nowrap;font-weight:700;width:90px}',
    '#kb-ajuda p{margin:12px 0 0;font-size:12px;color:#5e6c84}',
    '.kb-oculto{display:none!important}',
    '.observation textarea.obs-extra{display:block;width:100%;margin-top:10px;min-height:64px;resize:vertical;',
    '  border:1px solid #c4c6d0;border-radius:8px;padding:10px 12px;font:inherit;font-size:14px;color:inherit;background:#fff}',
    '.observation textarea.obs-extra:focus{outline:2px solid #005cbb;outline-offset:-1px;border-color:#005cbb}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'kb-estilos';
  style.textContent = css;
  document.head.appendChild(style);

  var ATALHOS = [
    ['F1', 'Ajuda'],
    ['F2', 'Gravar (enviar pedido)'],
    ['F3', 'Buscar produto'],
    ['F4', 'Adicionar filho'],
    ['F8', 'Editar item'],
    ['F9', 'Ir para Cliente'],
    ['Del', 'Excluir item'],
    ['Esc', 'Fechar']
  ];
  var DETALHE = [
    ['Enter', 'Vai para o próximo campo. Numa lista de busca, escolhe o item destacado (ou o primeiro).'],
    ['↑ / ↓', 'Andam pela lista de busca aberta. Fora dos campos, andam pelos itens lançados.'],
    ['Enter no produto', 'Escolhe o produto e abre a janela de preço/quantidade.'],
    ['Enter na janela', 'Preço → Quantidade → Confirmar.']
  ];

  // ---------- utilitarios ----------
  function tela() { return document.querySelector('app-vendas'); }
  function visivel(el) { return !!(el && el.offsetParent !== null && !el.disabled); }
  function modalAberto() {
    var m = document.querySelectorAll('.modal-backdrop .modal');
    return m.length ? m[m.length - 1] : null;
  }
  function campoTexto(el) {
    return el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !/^(button|submit|checkbox|radio)$/i.test(el.type)));
  }
  function focar(el, selecionar) {
    if (!el) return;
    el.focus();
    if (selecionar && el.select) { try { el.select(); } catch (e) { /* number inputs */ } }
  }
  function campoCliente() {
    var t = tela();
    return t && t.querySelector('.form-card .form-grid input');
  }
  function campoProduto() {
    var t = tela();
    return t && t.querySelector('.product-line input');
  }
  function botao(seletor) {
    var t = tela();
    var b = t && t.querySelector(seletor);
    return visivel(b) ? b : null;
  }
  function apertar(seletor) {
    var b = botao(seletor);
    if (b) { b.click(); return true; }
    return false;
  }

  // Lista de opcoes ligada a um campo (clientes, vendedores, CFOP, produtos, filhos)
  function listaDoCampo(input) {
    if (!input) return null;
    var lbl = input.closest('label');
    var l = lbl && lbl.querySelector('.suggestions');
    if (l) return l;
    if (input.closest('.product-line')) {
      var sec = input.closest('section');
      return sec && sec.querySelector('.product-results');
    }
    var modal = input.closest('.modal');
    return modal && modal.querySelector('.modal-results');
  }
  function opcoes(lista) {
    return lista ? Array.prototype.slice.call(lista.querySelectorAll(':scope > button')) : [];
  }
  function ativa(lista) { return lista && lista.querySelector(':scope > button.kb-ativo'); }
  function destacar(lista, idx) {
    var ops = opcoes(lista);
    ops.forEach(function (b) { b.classList.remove('kb-ativo'); });
    if (!ops.length) return;
    idx = Math.max(0, Math.min(ops.length - 1, idx));
    ops[idx].classList.add('kb-ativo');
    ops[idx].scrollIntoView({ block: 'nearest' });
  }
  function textoOpcao(b) { return (b.textContent || '').replace(/\s+/g, ' ').replace(' — ', ' - ').trim(); }

  // Campos da tela (fora das janelas) na ordem em que aparecem
  function camposDaTela() {
    var t = tela();
    if (!t) return [];
    return Array.prototype.slice.call(t.querySelectorAll('input, select, textarea'))
      .filter(function (el) { return visivel(el) && !el.closest('.modal-backdrop'); });
  }
  function proximoCampo(atual) {
    var lista = camposDaTela();
    var i = lista.indexOf(atual);
    if (i >= 0 && i < lista.length - 1) focar(lista[i + 1], true);
  }

  // ---------- itens lancados ----------
  function linhasItens() {
    var t = tela();
    return t ? Array.prototype.slice.call(t.querySelectorAll('.items-card tbody tr'))
      .filter(function (tr) { return !tr.querySelector('td.empty'); }) : [];
  }
  function moverItem(delta) {
    var linhas = linhasItens();
    if (!linhas.length) return false;
    var i = linhas.findIndex(function (tr) { return tr.classList.contains('selected'); });
    var n = i < 0 ? (delta > 0 ? 0 : linhas.length - 1) : Math.max(0, Math.min(linhas.length - 1, i + delta));
    linhas[n].click();
    linhas[n].scrollIntoView({ block: 'nearest' });
    return true;
  }
  function itemSelecionado() {
    return linhasItens().some(function (tr) { return tr.classList.contains('selected'); });
  }

  // ---------- Enter ----------
  function enterNoCampo(el, ev) {
    var modal = el.closest('.modal');
    var lista = listaDoCampo(el);
    var ops = opcoes(lista);

    // Campos com lista de busca
    if (lista) {
      var buscaProduto = !!(el.closest('.product-line') || modal);
      var escolhida = ativa(lista);
      if (!escolhida && ops.length && el.value.trim()) {
        // Em Cliente/Vendedor/CFOP, se o texto ja e de um item escolhido, so passa de campo
        var jaEscolhido = !buscaProduto && ops.some(function (b) { return textoOpcao(b) === el.value.trim(); });
        if (!jaEscolhido) escolhida = ops[0];
      }
      ev.preventDefault();
      if (escolhida) escolhida.click();

      if (el.closest('.product-line')) {
        // Produto pai: escolheu -> abre a janela de quantidade
        if (escolhida || el.value.trim()) apertar('.product-line .btn.primary');
        return;
      }
      if (modal) return; // filho: o clique ja abre a janela de quantidade
      proximoCampo(el);
      return;
    }

    // Janela de preco/quantidade
    if (modal) {
      ev.preventDefault();
      // Nome do produto e Rastreio sao opcionais: ficam fora da sequencia do Enter
      var inputs = Array.prototype.slice.call(modal.querySelectorAll('input:not(.nome-produto-input):not(.rastreio-input)')).filter(visivel);
      if (el.classList.contains('nome-produto-input') && inputs.length) { focar(inputs[0], true); return; }
      var i = inputs.indexOf(el);
      if (i >= 0 && i < inputs.length - 1) { focar(inputs[i + 1], true); return; }
      var ok = modal.querySelector('.modal-actions .btn.primary');
      if (visivel(ok)) ok.click();
      return;
    }

    if (el.tagName === 'TEXTAREA') return; // Enter quebra linha normalmente
    ev.preventDefault();
    proximoCampo(el);
  }

  // ---------- teclado ----------
  document.addEventListener('keydown', function (ev) {
    if (!tela()) return; // so na tela de vendas
    if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

    var el = document.activeElement;
    var modal = modalAberto();
    var ajuda = document.getElementById('kb-ajuda');
    var ajudaAberta = ajuda && ajuda.classList.contains('aberta');

    switch (ev.key) {
      case 'F1':
        ev.preventDefault();
        alternarAjuda();
        return;

      case 'Escape':
        if (ajudaAberta) { ev.preventDefault(); alternarAjuda(false); return; }
        if (modal) {
          ev.preventDefault();
          var fechar = modal.querySelector('.close');
          if (fechar) fechar.click();
          return;
        }
        if (campoTexto(el)) {
          var l = listaDoCampo(el);
          if (l) { ev.preventDefault(); el.blur(); }
        }
        return;
    }

    if (ajudaAberta) return;

    // Atalhos de funcao: so com nenhuma janela aberta
    if (/^F(2|3|4|8|9)$/.test(ev.key)) {
      ev.preventDefault();
      if (modal) return;
      switch (ev.key) {
        case 'F2': apertar('.total-card .btn.primary.large'); break;
        case 'F3': focar(campoProduto(), true); break;
        case 'F4': apertar('.product-line .btn.secondary'); break;
        case 'F8': apertar('.items-card .actions .btn.secondary'); break;
        case 'F9': focar(campoCliente(), true); break;
      }
      return;
    }

    // Janela de resultado (DAV GERADA): Enter = OK
    if (modal && ev.key === 'Enter' && !campoTexto(el)) {
      var okRes = modal.querySelector('.modal-actions .btn.primary');
      if (visivel(okRes) && el !== okRes) { ev.preventDefault(); okRes.click(); }
      return;
    }

    if (campoTexto(el)) {
      if (ev.key === 'Enter' && !ev.shiftKey) { enterNoCampo(el, ev); return; }
      if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && el.tagName !== 'SELECT') {
        var lista = listaDoCampo(el);
        var ops = opcoes(lista);
        if (!ops.length) return;
        ev.preventDefault();
        var atual = ops.indexOf(ativa(lista));
        destacar(lista, atual < 0 ? (ev.key === 'ArrowDown' ? 0 : ops.length - 1)
          : atual + (ev.key === 'ArrowDown' ? 1 : -1));
      }
      return;
    }

    // Fora de campos de texto
    if (modal) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (moverItem(ev.key === 'ArrowDown' ? 1 : -1)) ev.preventDefault();
      return;
    }
    if (ev.key === 'Delete') {
      if (!itemSelecionado()) return;
      ev.preventDefault();
      if (window.confirm('Excluir o item selecionado?')) apertar('.items-card .actions .btn.danger');
    }
  }, true);

  // Ao digitar numa busca, destaca o primeiro resultado (o que o Enter vai escolher)
  document.addEventListener('input', function (ev) {
    var el = ev.target;
    if (!tela() || !campoTexto(el)) return;
    setTimeout(function () {
      var lista = listaDoCampo(el);
      if (lista && el.value.trim()) destacar(lista, 0);
    }, 0);
  }, true);

  // ---------- foco automatico nas janelas ----------
  var tinhaModal = false;
  new MutationObserver(function () {
    if (!tela()) return;
    var modal = modalAberto();
    if (modal && !modal.dataset.kbFoco) {
      modal.dataset.kbFoco = '1';
      setTimeout(function () {
        // pula o campo "Nome do produto": o foco vai direto para o preco
        var input = Array.prototype.slice.call(modal.querySelectorAll('input:not(.nome-produto-input):not(.rastreio-input)')).filter(visivel)[0];
        if (input) focar(input, true);
        else focar(modal.querySelector('.modal-actions .btn.primary'));
      }, 0);
    }
    if (tinhaModal && !modal) {
      // Janela fechou: volta para a busca de produto para lancar o proximo
      setTimeout(function () {
        if (!modalAberto() && (!document.activeElement || document.activeElement === document.body)) {
          focar(campoProduto(), true);
        }
      }, 0);
    }
    tinhaModal = !!modal;
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- barra e ajuda ----------
  function montarBarra() {
    if (document.getElementById('kb-barra')) return;
    var barra = document.createElement('div');
    barra.id = 'kb-barra';
    barra.setAttribute('aria-label', 'Atalhos de teclado');
    ATALHOS.forEach(function (a) {
      var s = document.createElement('span');
      var b = document.createElement('b');
      b.textContent = a[0];
      s.appendChild(b);
      s.appendChild(document.createTextNode(a[1]));
      if (a[0] === 'F1') s.addEventListener('click', function () { alternarAjuda(); });
      barra.appendChild(s);
    });
    document.body.appendChild(barra);

    var ajuda = document.createElement('div');
    ajuda.id = 'kb-ajuda';
    var box = document.createElement('div');
    box.className = 'kb-box';
    var h = document.createElement('h2');
    h.textContent = 'Atalhos de teclado';
    box.appendChild(h);
    var tab = document.createElement('table');
    ATALHOS.concat(DETALHE).forEach(function (a) {
      var tr = document.createElement('tr');
      var t1 = document.createElement('td'); t1.textContent = a[0];
      var t2 = document.createElement('td'); t2.textContent = a[1];
      tr.appendChild(t1); tr.appendChild(t2); tab.appendChild(tr);
    });
    box.appendChild(tab);
    var p = document.createElement('p');
    p.textContent = 'Pressione F1 ou Esc para fechar.';
    box.appendChild(p);
    ajuda.appendChild(box);
    ajuda.addEventListener('click', function (e) { if (e.target === ajuda) alternarAjuda(false); });
    document.body.appendChild(ajuda);
  }
  function alternarAjuda(abrir) {
    var a = document.getElementById('kb-ajuda');
    if (!a) return;
    a.classList.toggle('aberta', abrir === undefined ? !a.classList.contains('aberta') : abrir);
  }
  function atualizarBarra() {
    var on = !!tela();
    var barra = document.getElementById('kb-barra');
    if (on && !barra) montarBarra();
    barra = document.getElementById('kb-barra');
    if (barra) barra.style.display = on ? '' : 'none';
    document.body.classList.toggle('kb-on', on);
  }
  // A tela e montada pelo Angular depois; acompanha a troca de rota (tela de config etc.)
  new MutationObserver(atualizarBarra).observe(document.body, { childList: true, subtree: true });
  atualizarBarra();

  // Campo Cliente ja focado ao abrir a tela
  var tentativas = 0;
  (function focoInicial() {
    var c = campoCliente();
    if (c && !c.disabled) { if (document.activeElement === document.body) c.focus(); return; }
    if (++tentativas < 100) setTimeout(focoInicial, 100);
  })();
})();
