import type { Remix } from '@remix-run/dom'
import { dom } from '@remix-run/events'

export default function Counter (this: Remix.Handle) {
  let count = 0
  return () => (
    <div
      css={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        '& button': { padding: '8px', cursor: 'pointer', background: '#ccc' }
      }}
    >
      <button
        on={dom.click(() => {
          count--
          this.render()
        })}
      >
        -
      </button>
      <span>{count}</span>
      <button
        on={dom.click(() => {
          count++
          this.render()
        })}
      >
        +
      </button>
    </div>
  )
}
