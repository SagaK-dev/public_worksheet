(() => {
  const controls = document.querySelector('[data-filter-controls]');
  const search = document.querySelector('#material-search');
  const cards = Array.from(document.querySelectorAll('[data-material]'));
  const buttons = Array.from(document.querySelectorAll('[data-filter-all], [data-filter-category]'));
  const count = document.querySelector('.result-count');
  const noResults = document.querySelector('.no-results');
  if (!controls || !search || !count || buttons.length === 0) return;

  controls.hidden = false;
  // null means "all"; a real category may be named "all".
  let category = null;
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ja').trim();
  const update = () => {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const matchesCategory = category === null || card.dataset.category === category;
      const haystack = normalize(card.dataset.search || '');
      const matches = matchesCategory && words.every((word) => haystack.includes(word));
      card.hidden = !matches;
      if (matches) visible++;
    }
    if (noResults) noResults.hidden = visible !== 0;
    count.textContent = `${visible}件の資料`;
  };
  for (const button of buttons) {
    button.addEventListener('click', () => {
      category = button.hasAttribute('data-filter-all') ? null : button.dataset.filterCategory;
      for (const item of buttons) {
        const selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      }
      update();
    });
  }
  search.addEventListener('input', update);
})();
