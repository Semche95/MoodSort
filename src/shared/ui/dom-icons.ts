import calendar from 'lucide-static/icons/calendar.svg?raw'
import check from 'lucide-static/icons/check.svg?raw'
import copy from 'lucide-static/icons/copy.svg?raw'
import layers from 'lucide-static/icons/layers.svg?raw'
import link from 'lucide-static/icons/link.svg?raw'
import lock from 'lucide-static/icons/lock.svg?raw'
import mail from 'lucide-static/icons/mail.svg?raw'
import monitor from 'lucide-static/icons/monitor.svg?raw'
import moon from 'lucide-static/icons/moon.svg?raw'
import move from 'lucide-static/icons/move.svg?raw'
import rectangleVertical from 'lucide-static/icons/rectangle-vertical.svg?raw'
import refreshCw from 'lucide-static/icons/refresh-cw.svg?raw'
import rotateCcw from 'lucide-static/icons/rotate-ccw.svg?raw'
import save from 'lucide-static/icons/save.svg?raw'
import scale from 'lucide-static/icons/scale.svg?raw'
import screenShare from 'lucide-static/icons/screen-share.svg?raw'
import server from 'lucide-static/icons/server.svg?raw'
import shieldCheck from 'lucide-static/icons/shield-check.svg?raw'
import square from 'lucide-static/icons/square.svg?raw'
import sun from 'lucide-static/icons/sun.svg?raw'
import timerOff from 'lucide-static/icons/timer-off.svg?raw'
import triangleAlert from 'lucide-static/icons/triangle-alert.svg?raw'
import undo from 'lucide-static/icons/undo-2.svg?raw'
import user from 'lucide-static/icons/user.svg?raw'
import x from 'lucide-static/icons/x.svg?raw'

const DOM_ICON_SOURCES = {
    calendar,
    check,
    copy,
    layers,
    link,
    lock,
    mail,
    monitor,
    moon,
    move,
    'rectangle-vertical': rectangleVertical,
    'refresh-cw': refreshCw,
    'rotate-ccw': rotateCcw,
    save,
    scale,
    'screen-share': screenShare,
    server,
    'shield-check': shieldCheck,
    square,
    sun,
    'timer-off': timerOff,
    'triangle-alert': triangleAlert,
    'undo-2': undo,
    user,
    x,
}

/** Inline Lucide SVG markup for DOM modals, stripped of its license comment and inter-tag whitespace so it adds nothing to the host's `textContent`. */
export function domIcon(name: keyof typeof DOM_ICON_SOURCES): string {
    return DOM_ICON_SOURCES[name]
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s+/g, ' ')
        .replace('<svg ', '<svg aria-hidden="true" ')
        .trim()
}
