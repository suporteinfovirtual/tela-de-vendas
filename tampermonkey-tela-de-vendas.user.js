// ==UserScript==
// @name         Tela de Vendas (sobreposta) - WebUniPlus
// @namespace    suporteinfovirtual
// @version      1.2
// @description  Abre a tela de vendas sobreposta ao sistema WebUniPlus (item no menu VENDAS > Geral)
// @match        https://virtual-01.webuniplus.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // Endereço da tela de vendas (GitHub Pages)
  const URL_TELA = 'https://suporteinfovirtual.github.io/tela-de-vendas/';

  // Texto do item no menu VENDAS > Geral
  const TEXTO_MENU = 'Tela de vendas';

  // true = mantém também o botão flutuante azul no canto da tela
  const MOSTRAR_BOTAO_FLUTUANTE = false;

  // Atalho para abrir/fechar: Ctrl + Shift + V
  const atalho = (e) => e.ctrlKey && e.shiftKey && e.code === 'KeyV';

  GM_addStyle(`
    #tv-btn {
      position: fixed; right: 10px; bottom: 35px; z-index: 2147483646;
      background: #1f6feb; color: #fff; border: 0; border-radius: 28px;
      padding: 12px 18px; font: 600 14px/1 system-ui, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,.25); cursor: pointer;
    }
    #tv-btn:hover { filter: brightness(1.1); }
    #tv-overlay {
      position: fixed; inset: 0; z-index: 2147483647;
      background: rgba(0,0,0,.45); display: none;
      align-items: center; justify-content: center;
    }
    #tv-overlay.aberto { display: flex; }
    #tv-janela {
      position: relative; width: 100vw; height: 100vh;
      background: transparent; overflow: hidden;
    }
    #tv-janela iframe { width: 100%; height: 100%; border: 0; display: block; background: transparent; color-scheme: normal; }
    #tv-fechar {
      position: absolute; top: 10px; right: 14px; z-index: 1;
      width: 30px; height: 30px; border: 0; border-radius: 50%;
      background: rgba(0,0,0,.55); color: #fff; font-size: 18px; cursor: pointer;
    }
    body.tv-travado { overflow: hidden !important; }
  `);

  // Botão flutuante (opcional)
  const btn = document.createElement('button');
  btn.id = 'tv-btn';
  btn.textContent = '🛒 Vendas';
  btn.title = 'Abrir tela de vendas (Ctrl+Shift+V)';
  if (!MOSTRAR_BOTAO_FLUTUANTE) btn.style.display = 'none';

  // Sobreposição + janela
  const overlay = document.createElement('div');
  overlay.id = 'tv-overlay';
  overlay.innerHTML = `
    <div id="tv-janela">
      <button id="tv-fechar" title="Fechar (Ctrl+Shift+V)">✕</button>
    </div>`;
  const janela = overlay.querySelector('#tv-janela');

  let iframe = null; // carrega só na primeira abertura e depois mantém (não perde o pedido)

  function abrir() {
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.src = URL_TELA;
      iframe.allow = 'clipboard-read; clipboard-write';
      iframe.setAttribute('allowtransparency', 'true');
      janela.appendChild(iframe);
    }
    overlay.classList.add('aberto');
    document.body.classList.add('tv-travado');
    btn.style.display = 'none';
    setTimeout(() => iframe.focus(), 50); // foco na tela para os atalhos F1-F9 funcionarem
  }

  function fechar() {
    overlay.classList.remove('aberto');
    document.body.classList.remove('tv-travado');
    if (MOSTRAR_BOTAO_FLUTUANTE) btn.style.display = '';
  }

  const alternar = () => (overlay.classList.contains('aberto') ? fechar() : abrir());

  btn.addEventListener('click', abrir);
  overlay.querySelector('#tv-fechar').addEventListener('click', fechar);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fechar(); });

  document.addEventListener('keydown', (e) => {
    if (atalho(e)) { e.preventDefault(); alternar(); }
  }, true);

  window.addEventListener('message', (e) => {
    if (e.origin === new URL(URL_TELA).origin && e.data === 'tv-fechar') fechar();
  });

  // ---------- Item no menu VENDAS > Geral ----------
  // O menu é montado pelo Angular só quando aparece, então observamos a página
  // e inserimos o item logo abaixo de "Vendas" (#cabecalhovendacrudcontroller).
  function inserirNoMenu() {
    const ref = document.querySelector('#cabecalhovendacrudcontroller');
    if (!ref || ref.parentElement.querySelector('#tv-menu-item')) return;

    const item = ref.cloneNode(true);          // copia o visual do item "Vendas"
    item.id = 'tv-menu-item';
    item.title = 'Abrir tela de vendas (Ctrl+Shift+V)';

    const caixa = item.querySelector('div') || item;
    caixa.childNodes.forEach((n) => { if (n.nodeType === 3) n.textContent = ''; });
    caixa.append(' ' + TEXTO_MENU);

    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      abrir();
      document.body.click(); // tenta fechar o dropdown do menu
    });

    ref.after(item);
  }

  new MutationObserver(inserirNoMenu).observe(document.body, { childList: true, subtree: true });
  inserirNoMenu();

  document.body.appendChild(btn);
  document.body.appendChild(overlay);
})();
