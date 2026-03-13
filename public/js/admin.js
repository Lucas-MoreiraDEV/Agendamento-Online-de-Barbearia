// admin.js - Scripts compartilhados para o painel admin da HOUSE
// Mobile-first, limpo e reutilizável

// Toggle da Sidebar (abre/fecha drawer em mobile)
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (!sidebar || !overlay) return;

  sidebar.classList.toggle('open');
  overlay.classList.toggle('visible');

  // Acessibilidade: foco no sidebar quando abrir
  if (sidebar.classList.contains('open')) {
    sidebar.focus();
  }
}

// Função genérica para abrir modal
function abrirModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('active');

  // Foco no primeiro input ou botão do modal (acessibilidade)
  const firstInput = modal.querySelector('input, select, button');
  if (firstInput) firstInput.focus();
}

// Função genérica para fechar modal
function fecharModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.remove('active');
}

// Fechar modal ao clicar fora do conteúdo
document.addEventListener('click', function (event) {
  const modals = document.querySelectorAll('.modal-overlay.active');
  modals.forEach(modal => {
    if (event.target === modal) {
      fecharModal(modal.id);
    }
  });
});

// Fechar modal com tecla ESC
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
      fecharModal(activeModal.id);
    }
  }
});

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function () {
  // Evento para botão hamburger (se existir na página)
  const hamburger = document.querySelector('.hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', toggleSidebar);
  }

  // Evento para botão "+ Novo Agendamento" (se existir na página admin)
  const btnNovoAgendamento = document.querySelector('.btn-primary');
  if (btnNovoAgendamento && btnNovoAgendamento.textContent.includes('Novo Agendamento')) {
    btnNovoAgendamento.addEventListener('click', () => abrirModal('modal-novo-agendamento'));
  }

  // Evento para botão "+ Novo Barbeiro" (se existir na página barbeiros)
  const btnNovoBarbeiro = document.querySelector('[onclick*="modal-novo-barbeiro"]');
  if (btnNovoBarbeiro) {
    btnNovoBarbeiro.addEventListener('click', () => abrirModal('modal-novo-barbeiro'));
  }

  // Evento para botão "+ Novo Serviço" (se existir na página servicos)
  const btnNovoServico = document.querySelector('[onclick*="modal-novo-servico"]');
  if (btnNovoServico) {
    btnNovoServico.addEventListener('click', () => abrirModal('modal-novo-servico'));
  }

  // Fechar modais ao clicar no botão × (já está no onclick inline, mas reforçando)
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => fecharModal(btn.closest('.modal-overlay').id));
  });
});
