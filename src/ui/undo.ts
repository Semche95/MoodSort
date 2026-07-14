export function createUndoButton(onClick: () => void): { button: HTMLButtonElement; setEnabled: (enabled: boolean) => void } {
    const btn: HTMLButtonElement = document.createElement('button')
    btn.className = 'history-button'
    btn.innerHTML = '&#8630;'
    btn.title = 'Annuler'
    btn.disabled = true
    btn.addEventListener('click', onClick)

    return {
        button: btn,
        setEnabled(enabled: boolean): void { btn.disabled = !enabled },
    }
}
