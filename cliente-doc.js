/*
 * CPF / CNPJ do cliente na tela de vendas.
 *
 * Arquivo independente, como o frete.js. O webhook de entidades traz cnpjcpf.
 *   - na lista de busca do cliente aparece "· CPF 000.000.000-00" ou "· CNPJ 00.000.000/0000-00"
 *     (o bundle chama window.tvDocCliente(cliente, separador))
 *   - a busca do cliente tambem acha pelo CPF/CNPJ, com ou sem pontuacao
 *   - depois de escolher o cliente aparece uma etiqueta CPF ou CNPJ embaixo do campo
 */
(function () {
  'use strict';

  var ID = 'tv-doc-cliente';

  var css = document.createElement('style');
  css.textContent = [
    '#' + ID + '{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:3px 10px;border-radius:999px;',
    '  font:600 12px/1.4 Inter,Roboto,Segoe UI,sans-serif;width:fit-content}',
    '#' + ID + ' b{font-size:11px;letter-spacing:.06em}',
    '#' + ID + '.tv-cpf{background:#e3f2e6;color:#1b5e20}',
    '#' + ID + '.tv-cnpj{background:#dbe8ff;color:#0b3d91}',
    '#' + ID + '.tv-sem{background:#fff3cd;color:#7a5a00}'
  ].join('\n');
  document.head.appendChild(css);

  function info(cliente) {
    var bruto = String((cliente && cliente.cnpjcpf) || '').trim();
    var d = bruto.replace(/\D/g, '');
    if (d.length === 11) return { tipo: 'CPF', num: d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') };
    if (d.length === 14) return { tipo: 'CNPJ', num: d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') };
    return bruto ? { tipo: 'DOC', num: bruto } : null;
  }

  window.tvDocCliente = function (cliente, sep) {
    var i = info(cliente);
    return i ? (sep || ' ') + (i.tipo === 'DOC' ? i.num : i.tipo + ' ' + i.num) : '';
  };

  function campoCliente() {
    var labels = document.querySelectorAll('app-vendas .form-grid label');
    for (var k = 0; k < labels.length; k++) {
      if (/^\s*Cliente/.test(labels[k].firstChild ? labels[k].firstChild.textContent : '')) return labels[k];
    }
    return null;
  }

  function atualizar() {
    var t = window.tvTela;
    var label = campoCliente();
    if (!t || !label) return;
    var chip = document.getElementById(ID);
    var cli = t.clienteSelecionado;
    if (!cli) { if (chip) chip.remove(); return; }
    var i = info(cli);
    var cls = !i ? 'tv-sem' : i.tipo === 'CPF' ? 'tv-cpf' : i.tipo === 'CNPJ' ? 'tv-cnpj' : 'tv-sem';
    var html = !i ? '<b>SEM CPF/CNPJ</b>'
      : i.tipo === 'DOC' ? '<b>DOC</b><span></span>'
      : '<b>' + i.tipo + '</b><span></span>';
    if (!chip) {
      chip = document.createElement('span');
      chip.id = ID;
      label.appendChild(chip);
    } else if (chip.parentNode !== label) {
      label.appendChild(chip);
    }
    if (chip.dataset.chave !== cls + '|' + (i ? i.num : '')) {
      chip.dataset.chave = cls + '|' + (i ? i.num : '');
      chip.className = cls;
      chip.innerHTML = html;
      var sp = chip.querySelector('span');
      if (sp) sp.textContent = i.num;   // texto do banco entra como texto, nunca como HTML
    }
  }

  new MutationObserver(atualizar).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('input', function () { setTimeout(atualizar, 0); }, true);
})();
