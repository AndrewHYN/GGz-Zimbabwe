document.addEventListener('DOMContentLoaded', () => {
    const tabTriggers = document.querySelectorAll('.tab-trigger');
    const tabPanels = document.querySelectorAll('.tournament-tab-panel');

    tabTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = trigger.getAttribute('data-tab');

            // Hide all panels
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
            });

            // Deselect all triggers
            tabTriggers.forEach(t => {
                t.setAttribute('aria-selected', 'false');
            });

            // Show selected panel
            const selectedPanel = document.getElementById(tabName);
            if (selectedPanel) {
                selectedPanel.classList.add('active');
                trigger.setAttribute('aria-selected', 'true');
            }
        });
    });
});