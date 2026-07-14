export function createRedoButton(onClick: () => void): { button: HTMLButtonElement; setEnabled: (enabled: boolean) => void } {
    const btn: HTMLButtonElement = document.createElement('button')
    btn.className = 'history-button'
    btn.innerHTML = '&#8631;'
    btn.title = 'Refaire'
    btn.disabled = true
    btn.addEventListener('click', onClick)

    return {
        button: btn,
        setEnabled(enabled: boolean): void { btn.disabled = !enabled },
    }
}
