import type { Container } from 'pixi.js'
import type { CanvasTooltip } from '../shared/ui/canvas-tooltip'
import type { createIcon } from '../shared/ui/icons'
import type { createButton, createShareButton } from '../features/toolbar/toolbar-view'
import type { ThemeService } from '../features/theme/theme-service'
import type { ToolbarHost } from './toolbar.types'
import type { LocaleMenu } from './locale-menu.types'
import type { FullscreenControl } from './fullscreen-control.types'

/** Plain data bag standing in for what would otherwise be a toolbar instance's fields. */
export type ToolbarState = {
    host: ToolbarHost
    tooltip: CanvasTooltip
    logo: Container
    undoIcon: ReturnType<typeof createIcon>
    redoIcon: ReturnType<typeof createIcon>
    shareIcon: Container
    shareActiveIndicator: ReturnType<typeof createShareButton>['activeIndicator']
    shareViewerIndicator: ReturnType<typeof createShareButton>['viewerIndicator']
    undoButton: ReturnType<typeof createButton>
    redoButton: ReturnType<typeof createButton>
    helpButton: ReturnType<typeof createButton>
    settingsButton: ReturnType<typeof createButton>
    localeMenu: LocaleMenu
    fullscreen: FullscreenControl | null
    shareButton: ReturnType<typeof createShareButton>['button']
    onDismissOnboarding: () => void
    themeService: ThemeService
}
