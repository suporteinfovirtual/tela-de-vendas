/*
 * Campo "Valor do frete" da tela de vendas.
 *
 * Arquivo independente, como o atalhos.js: o campo e criado aqui, ao lado de
 * "Tipo de documento financeiro". O bundle do Angular (main-*.js) so le o valor
 * por window.tvValorFrete() ao montar a DAV e chama window.tvLimparFrete()
 * depois de gravar o pedido.
 *
 *   vazio      -> valorFrete nao vai na DAV
 *   "12,50"    -> valorFrete: 12.5
 *   "1.234,56" -> valorFrete: 1234.56
 */
(function () {
  'use strict';

  var ID = 'tv-frete';

  // Converte o texto digitado em numero; vazio ou invalido = undefined (nao envia)
  function lerFrete() {
    var el = document.getElementById(ID);
    var txt = String(el ? el.value : '').trim().replace(/\s|R\$/g, '');
    if (!txt) return undefined;
    if (txt.indexOf(',') >= 0) txt = txt.replace(/\./g, '').replace(',', '.');
    var n = Number(txt);
    if (!isFinite(n) || n < 0) return undefined;
    return Math.round(n * 100) / 100;
  }

  window.tvValorFrete = lerFrete;
  window.tvLimparFrete = function () {
    var el = document.getElementById(ID);
    if (el) el.value = '';
  };

  // Copia o atributo de estilo do Angular (_ngcontent-...) para o elemento novo
  function copiarEscopo(de, para) {
    if (!de) return;
    Array.prototype.forEach.call(de.attributes, function (a) {
      if (a.name.indexOf('_ngcontent') === 0) para.setAttribute(a.name, '');
    });
  }

  function criarCampo() {
    if (document.getElementById(ID)) return;
    var labels = document.querySelectorAll('.form-card .form-grid label, label');
    var ref = null;
    for (var i = 0; i < labels.length; i++) {
      if (/^\s*Tipo de documento financeiro/.test(labels[i].textContent)) { ref = labels[i]; break; }
    }
    if (!ref) return;

    var label = document.createElement('label');
    copiarEscopo(ref, label);
    label.appendChild(document.createTextNode('Valor do frete'));

    var input = document.createElement('input');
    input.id = ID;
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.placeholder = '0,00 (opcional)';
    copiarEscopo(ref.querySelector('select, input') || document.querySelector('.form-grid input'), input);
    // Aceita so numeros, virgula e ponto
    input.addEventListener('input', function () {
      var limpo = input.value.replace(/[^\d.,]/g, '');
      if (limpo !== input.value) input.value = limpo;
    });
    // Ao sair do campo, mostra no formato 12,50
    input.addEventListener('blur', function () {
      var n = lerFrete();
      input.value = n === undefined ? '' : n.toFixed(2).replace('.', ',');
    });
    label.appendChild(input);

    ref.parentNode.insertBefore(label, ref.nextSibling);
  }

  // O Angular desenha a tela depois do carregamento: espera o campo de referencia aparecer
  criarCampo();
  new MutationObserver(criarCampo).observe(document.documentElement, { childList: true, subtree: true });
})();
