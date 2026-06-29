(function () {
  var modal = document.getElementById('cert-modal');
  if (!modal) return;

  var bd  = document.getElementById('cert-modal-bd');
  var img = document.getElementById('cert-modal-img');
  var btn = document.getElementById('cert-modal-x');

  function openModal(src, alt) {
    img.src = src;
    img.alt = alt || 'Certificate';
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    btn.focus();
  }

  function closeModal() {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(function () { img.src = ''; img.alt = ''; }, 350);
  }

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-cert-image]');
    if (trigger) {
      e.preventDefault();
      openModal(trigger.getAttribute('data-cert-image'), trigger.getAttribute('data-cert-alt'));
    }
  });

  btn.addEventListener('click', closeModal);
  bd.addEventListener('click', closeModal);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });
}());
