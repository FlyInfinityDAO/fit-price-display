(function () {
  'use strict';
  const cardSelector = '.privacy-card, .card, .section-card, .audit-section, .warning-card, .faq-item, .wp-content, .dapp-operation-card, .dapp-wallet-hub-card, .wallet-card, .action-card';
  function isOuterCard(element) {
    if (!element.matches(cardSelector)) return false;
    return !element.parentElement?.closest(cardSelector);
  }
  document.addEventListener('pointerdown', function (event) {
    if (event.pointerType !== 'touch') return;
    let node = event.target instanceof Element ? event.target : null;
    let outerCard = null;
    while (node && node !== document.documentElement) {
      if (node.matches(cardSelector)) outerCard = node;
      node = node.parentElement;
    }
    if (!outerCard || !isOuterCard(outerCard)) return;
    document.querySelectorAll(cardSelector + '.is-touch-active').forEach(function (card) {
      card.classList.remove('is-touch-active');
    });
    outerCard.classList.add('is-touch-active');
  }, { passive: true });
})();