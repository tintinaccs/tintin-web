// Only this controller is executable in the visual preview.
document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending');
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
document.getElementById('preview-refresh').addEventListener('click', () => location.reload());
const steps = document.querySelectorAll('.ck-panel');
if (steps.length) {
  document.getElementById('preview-step-label').hidden = false;
  const select = document.getElementById('preview-step');
  select.value = new URL(location.href).searchParams.get('step') || '0';
  const showStep = () => {
    const index = Math.max(0, Math.min(steps.length - 1, Number(select.value) || 0));
    steps.forEach((panel, i) => panel.classList.toggle('active', i === index));
    document.querySelectorAll('.ck-step').forEach((step, i) => step.classList.toggle('active', i === index));
    const url = new URL(location.href);
    url.searchParams.set('step', String(index));
    history.replaceState(null, '', url);
  };
  select.addEventListener('change', showStep);
  document.querySelectorAll('.ck-step').forEach((step, index) => step.addEventListener('click', () => {select.value = String(index); showStep();}));
  showStep();
}
