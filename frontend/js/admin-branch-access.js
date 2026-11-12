// Branch-scoped booking access: summary text and the superadmin editor dialog.
// The server enforces the scope; this file is only the staff-facing UI.

(function () {
  'use strict';

  function branchNames(branchIds, branches) {
    const ids = new Set((branchIds || []).map(Number));

    return (branches || [])
      .filter((branch) => ids.has(Number(branch.id)))
      .map((branch) => branch.name);
  }

  // An empty list means the account may see every branch.
  function describe(branchIds, branches) {
    if (!branchIds || !branchIds.length) {
      return 'All branches';
    }

    const names = branchNames(branchIds, branches);

    return names.length ? names.join(', ') : 'Selected branches';
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
  }

  /**
   * Ask the superadmin which branches an account may see.
   * Resolves to the chosen branch IDs ([] for every branch), or null
   * when cancelled.
   */
  function openEditor({ user, branches }) {
    return new Promise((resolve) => {
      const selected = new Set((user.branch_ids || []).map(Number));
      const dialog = createElement('dialog', 'branch-access-dialog');
      const form = createElement('form', 'branch-access-dialog__form');

      form.method = 'dialog';

      form.append(
        createElement('p', 'branch-access-dialog__eyebrow', 'Booking access'),
        createElement(
          'h3',
          'branch-access-dialog__title',
          user.email || user.username || 'Administrator'
        ),
        createElement(
          'p',
          'branch-access-dialog__hint',
          'Tick the branches whose appointments this account can see and update. ' +
            'Leave every box empty to allow all branches.'
        )
      );

      const list = createElement('div', 'branch-access-dialog__list');

      (branches || []).forEach((branch) => {
        const label = createElement('label', 'branch-access-dialog__option');
        const checkbox = document.createElement('input');

        checkbox.type = 'checkbox';
        checkbox.value = String(Number(branch.id));
        checkbox.checked = selected.has(Number(branch.id));

        label.append(checkbox, createElement('span', '', branch.name));
        list.append(label);
      });

      if (!list.children.length) {
        list.append(
          createElement('p', 'branch-access-dialog__hint', 'Branches could not be loaded.')
        );
      }

      const actions = createElement('div', 'branch-access-dialog__actions');
      const cancelButton = createElement('button', 'btn-small', 'Cancel');
      const saveButton = createElement('button', 'btn-small branch-access-dialog__save', 'Save access');

      cancelButton.type = 'button';
      saveButton.type = 'submit';
      saveButton.value = 'save';
      saveButton.disabled = !branches || !branches.length;

      actions.append(cancelButton, saveButton);
      form.append(list, actions);
      dialog.append(form);
      document.body.append(dialog);

      cancelButton.addEventListener('click', () => dialog.close('cancel'));

      dialog.addEventListener('close', () => {
        const saved = dialog.returnValue === 'save';
        const branchIds = Array.from(
          list.querySelectorAll('input[type="checkbox"]:checked'),
          (checkbox) => Number(checkbox.value)
        );

        dialog.remove();
        resolve(saved ? branchIds : null);
      });

      dialog.showModal();
    });
  }

  window.KPBranchAccess = {
    describe,
    openEditor,
  };
})();
