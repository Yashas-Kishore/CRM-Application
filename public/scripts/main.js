function redirectTo(page) {
    window.location.href = `/${page}`;
}

// Add tab switching functionality if needed
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.slds-tabs_scoped__item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.slds-tabs_scoped__content').forEach(content => {
                content.classList.toggle('slds-show', content.id === target);
                content.classList.toggle('slds-hide', content.id !== target);
            });
            tabs.forEach(t => t.classList.toggle('slds-is-active', t === tab));
        });
    });
});
