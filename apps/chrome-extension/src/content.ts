import { EventName, portImpl } from './common/message'

const COMMENT_BUTTON_CLASS = '.docx-comment__first-comment-btn'
const HELP_BLOCK_CLASS = '.help-block'

let disposables: (() => void)[] = []

const dispose = (): void => {
  disposables.forEach(disposable => {
    disposable()
  })

  disposables = []
}

interface Button {
  element: HTMLElement
}

const initButtons = (): void => {
  const root = document.body

  const isReady = () => {
    // Comment button may not be displayed
    for (const selector of [HELP_BLOCK_CLASS]) {
      if (!root.querySelector(selector)) {
        return false
      }
    }
    return true
  }

  const render = () => {
    const style = document.createElement('style')
    style.innerHTML = `
  [data-CDC-button-type] {
    position: fixed;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid var(--line-border-card);
    border-radius: 50%;
    background-color: var(--bg-body);
    box-shadow: var(--shadow-s4-down);
    cursor: pointer;
    text-align: center;
    color: var(--text-title);
    z-index: 3;
  }

  [data-CDC-button-type]:hover {
    color: var(--colorful-blue);
  }
  `

    const operates = [
      {
        type: 'view',
        innerHtml: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" 
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
        class="octicon octicon-view" fill="currentColor">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        `,
        action: () => {
          chrome.runtime
            .sendMessage({ flag: 'view_docx_as_markdown' })
            .catch(console.error)
        },
      },
    ]

    const buttons = operates.map<Button>(({ type, innerHtml, action }) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-CDC-button-type', type)
      btn.innerHTML = innerHtml

      btn.style.width = '36px'
      btn.style.height = '36px'

      btn.addEventListener('click', action)

      return {
        element: btn,
      }
    })

    const getOriginalBtnPos = (buttons: Button[]) => {
      const helpBlock: HTMLDivElement | null =
        root.querySelector(HELP_BLOCK_CLASS)
      if (!helpBlock) {
        return
      }

      const windowWidth = window.innerWidth
      const windowHeight = window.innerHeight

      const helpBlockRect = helpBlock.getBoundingClientRect()

      const commentButton: HTMLDivElement | null =
        root.querySelector(COMMENT_BUTTON_CLASS)

      const defaultGap = 14
      const defaultBtnHeight = 36

      // Comment button may not be displayed
      if (!commentButton) {
        const startBottom = windowHeight - helpBlockRect.bottom
        const right = windowWidth - helpBlockRect.right

        return buttons.map((_, index) => ({
          right,
          bottom: startBottom + (index + 1) * (defaultGap + defaultBtnHeight),
        }))
      }

      const commentButtonRect = commentButton.getBoundingClientRect()

      if (commentButtonRect.right === helpBlockRect.right) {
        const btnHeight = commentButtonRect.height
        const gap =
          Math.abs(helpBlockRect.bottom - commentButtonRect.bottom) - btnHeight
        const initialBottom = Math.max(
          windowHeight - commentButtonRect.bottom,
          windowHeight - helpBlockRect.bottom,
        )

        return buttons.map((_, index) => ({
          right: windowWidth - commentButtonRect.right,
          bottom: initialBottom + (index + 1) * (gap + btnHeight),
        }))
      } else if (commentButtonRect.bottom === helpBlockRect.bottom) {
        const bottom =
          windowHeight -
          commentButtonRect.bottom +
          defaultGap +
          defaultBtnHeight
        const right =
          windowWidth - Math.max(commentButtonRect.right, helpBlockRect.right)

        return buttons.map(() => ({ right, bottom }))
      }

      return
    }

    const layout = (buttons: Button[]) => {
      const pos = getOriginalBtnPos(buttons)
      if (!pos) return

      buttons.forEach((button, index) => {
        button.element.style.right = pos[index].right.toFixed() + 'px'
        button.element.style.bottom = pos[index].bottom.toFixed() + 'px'
      })
    }

    // When the width of the docx's visible content is too narrow, the position of the comment button changes.
    const autoLayoutObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          layout(buttons)
        }
      }
    })
    const autoLayout = () => {
      const commentButton = root.querySelector(COMMENT_BUTTON_CLASS)
      if (!commentButton) {
        return
      }

      autoLayoutObserver.observe(commentButton, {
        attributes: true,
        attributeFilter: ['class'],
      })
    }

    layout(buttons)
    autoLayout()

    root.appendChild(style)
    buttons.forEach(button => {
      root.appendChild(button.element)
    })

    const unmount = () => {
      autoLayoutObserver.disconnect()

      buttons.forEach(button => {
        if (root.contains(button.element)) {
          root.removeChild(button.element)
        }
      })

      if (root.contains(style)) {
        root.removeChild(style)
      }
    }

    disposables.push(unmount)

    return unmount
  }

  let unmount: (() => void) | null = null
  const init = () => {
    // Rendering may be called multiple times
    if (unmount) {
      unmount()

      unmount = null
    }

    unmount = render()
  }

  const initObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.matches(COMMENT_BUTTON_CLASS) ||
              node.matches(HELP_BLOCK_CLASS)) &&
            isReady()
          ) {
            init()
          }
        }
      }
    }
  })

  if (isReady()) {
    init()
  }

  initObserver.observe(root, {
    childList: true,
    subtree: true,
  })

  disposables.push(() => {
    initObserver.disconnect()
  })
}

function initContent(): void {
  initButtons()
}

window.addEventListener('load', initContent, false)

// For SPA, some page content updates do not trigger page reloads
let lastPathname: string = location.pathname
const urlChangeObserver: MutationObserver = new MutationObserver(() => {
  const pathname = location.pathname

  if (pathname !== lastPathname) {
    lastPathname = pathname

    dispose()

    initContent()
  }
})
urlChangeObserver.observe(document.body, { childList: true })

portImpl.receiver.on(EventName.GetSettings, async keys => {
  return await chrome.storage.sync.get(keys)
})

if (import.meta.env.DEV) {
  portImpl.receiver.on(EventName.Console, data => {
    console.log('MAIN World Console:', ...data)
  })
}
