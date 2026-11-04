/*
 * Campo "Desconto no subtotal" da tela de vendas.
 *
 * Arquivo independente, como o frete.js: o campo e criado aqui, no quadro do
 * total. O bundle do Angular (main-*.js) so le o valor ao montar a DAV:
 *   window.tvDescontoSubtotal(totalItens) -> desconto em R$ (ou undefined)
 *   window.tvPercentualDesconto()         -> percentual, se digitado com % (ou undefined)
 *   window.tvLimparDesconto()             -> chamado depois de gravar o pedido
 *
 * Formas de digitar:
 *   vazio     -> desconto nao vai na DAV
 *   "12,50"   -> desconto: 12.5
 *   "10%"     -> desconto: 10% do total dos itens; percentualDescontoSubtotal: 10
 */
(function () {
  'use strict';

  var ID = 'tv-desconto';
  var RESUMO = 'tv-desconto-resumo';

  var css = document.createElement('style');
  css.textContent = [
    '#' + ID + '-label{display:flex;flex-direction:column;gap:6px;margin:10px 0 4px;font-size:13px;font-weight:600}',
    '#' + ID + '{width:100%;box-sizing:border-box;border:1px solid #c4c6d0;border-radius:8px;padding:9px 12px;font:inherit;font-size:14px;background:#fff;color:inherit}',
    '#' + ID + ':focus{outline:2px solid #005cbb;outline-offset:-1px;border-color:#005cbb}',
    '#' + ID + '.tv-erro{border-color:#c62828;outline-color:#c62828}',
    '#' + RESUMO + '{margin:0 0 12px;font-size:13px;line-height:1.6}',
    '#' + RESUMO + ' div{display:flex;justify-content:space-between;gap:12px}',
    '#' + RESUMO + ' .tv-final{font-weight:700;font-size:15px;border-top:1px solid #d9dde3;margin-top:4px;padding-top:4px}',
    '#' + RESUMO + ' .tv-erro{color:#c62828;font-weight:600}'
  ].join('\n');
  document.head.appendChild(css);

  function num(txt) {
    txt = String(txt || '').trim().replace(/\s|R\$/g, '');
    if (!txt) return undefined;
    if (txt.indexOf(',') >= 0) txt = txt.replace(/\./g, '').replace(',', '.');
    var n = Number(txt);
    return isFinite(n) && n >= 0 ? n : undefined;
  }
  function r2(n) { return Math.round(n * 100) / 100; }
  function moeda(n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  function texto() { var el = document.getElementById(ID); return el ? el.value.trim() : ''; }
  function ehPercentual() { return /%\s*$/.test(texto()); }

  function percentual() {
    if (!ehPercentual()) return undefined;
    var p = num(texto().replace('%', ''));
    return p === undefined || p === 0 ? undefined : r2(p);
  }
  function descontoReais(totalItens) {
    if (ehPercentual()) {
      var p = percentual();
      return p === undefined ? undefined : r2((Number(totalItens) || 0) * p / 100);
    }
    var v = num(texto());
    return v === undefined || v === 0 ? undefined : r2(v);
  }

  window.tvDescontoSubtotal = descontoReais;
  window.tvPercentualDesconto = percentual;
  window.tvLimparDesconto = function () {
    var el = document.getElementById(ID);
    if (el) el.value = '';
    atualizarResumo();
  };

  // Total dos itens = o que o Angular mostra em "Total geral"
  function totalItens() {
    var s = document.querySelector('.total-card strong');
    return s ? (num(s.textContent) || 0) : 0;
  }

  function atualizarResumo() {
    var box = document.getElementById(RESUMO);
    var el = document.getElementById(ID);
    if (!box || !el) return;
    var itens = totalItens();
    var desc = descontoReais(itens) || 0;
    var frete = (window.tvValorFrete && window.tvValorFrete()) || 0;
    var erro = desc > itens + 1e-9;
    el.classList.toggle('tv-erro', erro);
    if (!desc && !frete) { box.dataset.html = ''; if (box.innerHTML) box.innerHTML = ''; return; }
    var linhas = [];
    if (desc) linhas.push('<div><span>Desconto' + (percentual() ? ' (' + String(percentual()).replace('.', ',') + '%)' : '') + '</span><span>− ' + moeda(desc) + '</span></div>');
    if (frete) linhas.push('<div><span>Frete</span><span>+ ' + moeda(frete) + '</span></div>');
    linhas.push(erro
      ? '<div class="tv-erro">Desconto maior que o total dos itens</div>'
      : '<div class="tv-final"><span>Total do pedido</span><span>' + moeda(r2(itens - desc + frete)) + '</span></div>');
    var html = linhas.join('');
    // so mexe no DOM se mudou: evita laco com o MutationObserver
    if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
  }

  function criarCampo() {
    if (document.getElementById(ID)) return;
    var card = document.querySelector('.total-card');
    var botao = card && card.querySelector('.btn.primary.large, button');
    if (!botao) return;

    var label = document.createElement('label');
    label.id = ID + '-label';
    label.appendChild(document.createTextNode('Desconto no subtotal'));
    var input = document.createElement('input');
    input.id = ID;
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.placeholder = 'R$ 0,00 ou 10%';
    input.title = 'Valor em reais (ex.: 12,50) ou percentual (ex.: 10%)';
    input.addEventListener('input', function () {
      var limpo = input.value.replace(/[^\d.,%]/g, '').replace(/%(?=.)/g, '');
      if (limpo !== input.value) input.value = limpo;
      atualizarResumo();
    });
    input.addEventListener('blur', function () {
      if (ehPercentual()) { var p = percentual(); input.value = p === undefined ? '' : String(p).replace('.', ',') + '%'; }
      else { var v = descontoReais(0); input.value = v === undefined ? '' : v.toFixed(2).replace('.', ','); }
      atualizarResumo();
    });
    // Enter no desconto = vai para o botao Enviar
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); input.blur(); botao.focus(); }
    });
    label.appendChild(input);

    var resumo = document.createElement('div');
    resumo.id = RESUMO;

    card.insertBefore(label, botao);
    card.insertBefore(resumo, botao);
    atualizarResumo();
  }

  criarCampo();
  new MutationObserver(function () { criarCampo(); atualizarResumo(); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  // O frete e digitado em outro campo: acompanha tambem
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'tv-frete') atualizarResumo(); }, true);
})();
