/*
 * Preferencias do cliente (cadastro de entidade no Uniplus).
 *
 * Arquivo independente, como o frete.js. O webhook de entidades traz
 * idcondicaopagamento, idtipodocumentofinanceiro e informacaopdv. Ao escolher
 * o cliente (o bundle chama window.tvClienteSelecionado) ou trocar o tipo de documento:
 *   - condicao de pagamento e tipo de documento financeiro vao para os do cadastro
 *     do cliente; o que o cliente nao tiver (ou estiver inativo) segue o padrao
 *     do tipo de documento (PADROES abaixo)
 *   - a "Informacoes para PDV / Vendas" aparece em destaque ate trocar o cliente
 * Ao abrir uma DAV (editar-dav.js) so a mensagem aparece: condicao e financeiro
 * ficam como estavam gravados na DAV.
 */
(function () {
  'use strict';

  // Padrao por tipo de documento quando o cliente nao tem preferencia no cadastro
  // condicao = codigo da condicao de pagamento; financeiro = codigo do tipo de documento financeiro
  var PADROES = {
    2: { condicao: '1', financeiro: 102 }, // Orcamento: A Vista / Dinheiro (como o Pedido de Venda)
    4: { condicao: '1', financeiro: 102 }, // Pedido de Venda: A Vista / Dinheiro
    6: { condicao: '1', financeiro: 1 },   // Pedido de Faturamento: A Vista / Boleto
    7: { condicao: '1', financeiro: 1 }    // Orcamento de Faturamento: A Vista / Boleto (como o Pedido de Faturamento)
  };
  var ID = 'tv-pdv';
  var ultimoTipo = null;
  var ultimoCliente = null;

  var css = document.createElement('style');
  css.textContent = [
    '#' + ID + '{display:flex;gap:12px;align-items:flex-start;margin:0 0 14px;padding:12px 16px;border-radius:8px;',
    '  background:#fdd05a;color:#1c2551;border:2px solid #1c2551;box-shadow:0 2px 8px rgba(28,37,81,.18);',
    '  font:600 16px/1.45 Inter,Roboto,Segoe UI,sans-serif;white-space:pre-line;animation:tvPdv .5s ease-out 2}',
    '#' + ID + ' b{display:block;font-size:11px;letter-spacing:.08em;margin-bottom:2px}',
    '#' + ID + ' .tv-pdv-icone{font-size:22px;line-height:1}',
    '@keyframes tvPdv{0%{transform:scale(1)}50%{transform:scale(1.015)}100%{transform:scale(1)}}'
  ].join('\n');
  document.head.appendChild(css);

  function porId(lista, id) {
    var c = String(id == null ? '' : id).trim();
    if (!c) return null;
    return (lista || []).filter(function (x) { return String(x.id).trim() === c; })[0] || null;
  }

  function tipoAtual(t) { return Number(String(t.tipoDocumento || '').split(' - ')[0]); }

  // Cadastro do cliente primeiro; o que faltar segue o padrao do tipo de documento
  function aplicar() {
    var t = window.tvTela;
    if (!t) return;
    var cli = t.clienteSelecionado;
    var padrao = PADROES[tipoAtual(t)] || PADROES[4];
    var cond = cli && porId(t.condicoesPagamento, cli.idcondicaopagamento);
    t.condicaoPagamento = cond ? String(cond.codigo) : padrao.condicao;
    var fin = cli && porId(t.tiposDocumentoFinanceiro, cli.idtipodocumentofinanceiro);
    t.tipoDocumentoFinanceiro = fin ? Number(fin.codigo) : padrao.financeiro;
    t.cdr.markForCheck();
  }

  window.tvClienteSelecionado = function (cliente) {
    var t = window.tvTela;
    if (!t || !cliente) return;
    ultimoCliente = cliente;
    ultimoTipo = t.tipoDocumento;
    aplicar();
    atualizar();
  };

  // DAV aberta pelo F6: guarda o estado sem reaplicar (vale o que esta gravado na DAV)
  window.tvSincronizarPreferencias = function () {
    var t = window.tvTela;
    if (!t) return;
    ultimoCliente = t.clienteSelecionado;
    ultimoTipo = t.tipoDocumento;
  };

  // Troca de tipo de documento pelo usuario: reaplica (cliente com preferencia continua com a dele)
  function conferirTipo() {
    var t = window.tvTela;
    if (!t || t.carregandoCadastros) return;
    if (ultimoTipo === null) { ultimoTipo = t.tipoDocumento; return; }
    if (t.tipoDocumento !== ultimoTipo) {
      ultimoTipo = t.tipoDocumento;
      if (t.clienteSelecionado === ultimoCliente) aplicar();
    }
  }

  // A mensagem segue o cliente selecionado (some quando o campo cliente e apagado/trocado)
  function atualizar() {
    conferirTipo();
    var t = window.tvTela;
    var msg = t && t.clienteSelecionado ? String(t.clienteSelecionado.informacaopdv || '').trim() : '';
    var box = document.getElementById(ID);
    if (!msg) { if (box) box.remove(); return; }
    var card = document.querySelector('app-vendas .form-card');
    if (!card) return;
    if (!box) {
      box = document.createElement('div');
      box.id = ID;
      box.setAttribute('role', 'alert');
      box.innerHTML = '<span class="tv-pdv-icone">&#9888;</span><div><b>INFORMAÇÕES DO CLIENTE</b><span class="tv-pdv-texto"></span></div>';
      var grid = card.querySelector('.form-grid');
      card.insertBefore(box, grid || card.firstChild);
    }
    var span = box.querySelector('.tv-pdv-texto');
    if (span.textContent !== msg) span.textContent = msg;
  }

  new MutationObserver(atualizar).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('input', function () { setTimeout(atualizar, 0); }, true);
})();
