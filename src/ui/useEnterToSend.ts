import { useRef, type KeyboardEvent } from 'react'

/**
 * Enter sends, Shift+Enter keeps the newline.
 *
 * The composition half is the part that matters here. Everything typed into
 * these composers goes through an IME, and the Enter that commits a pinyin
 * candidate is a real Enter keydown — without a guard, choosing a character
 * would post the half-formed text you are still picking characters for.
 * `isComposing` is the standard signal, but Safari has fired that keydown with
 * the flag already cleared, so the ref tracks the composition window itself and
 * covers the case the flag misses.
 */
export function useEnterToSend(send: () => void) {
  const composing = useRef(false)

  return {
    onCompositionStart: () => {
      composing.current = true
    },
    onCompositionEnd: () => {
      composing.current = false
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return
      if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
      event.preventDefault()
      send()
    },
  }
}
