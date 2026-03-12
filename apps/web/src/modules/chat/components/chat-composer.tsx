"use client"

import { SendHorizonalIcon } from "lucide-react"
import { useRef, type CompositionEvent, type KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ChatComposerProps = {
  canSubmit: boolean
  inputDisabled: boolean
  isSubmitting: boolean
  helperText: string
  placeholder: string
  value: string
  errorMessage: string | null
  onChange: (value: string) => void
  onSubmit: () => void
}

export function ChatComposer(props: ChatComposerProps) {
  const isComposingRef = useRef(false)

  function handleCompositionStart() {
    isComposingRef.current = true
  }

  function handleCompositionEnd(_event: CompositionEvent<HTMLTextAreaElement>) {
    isComposingRef.current = false
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as KeyboardEvent<HTMLTextAreaElement>["nativeEvent"] & {
      isComposing?: boolean
      keyCode?: number
    }
    const isImeConfirming =
      isComposingRef.current ||
      nativeEvent.isComposing === true ||
      nativeEvent.keyCode === 229

    if (event.key === "Enter" && !event.shiftKey) {
      if (isImeConfirming) {
        return
      }

      event.preventDefault()
      if (props.canSubmit && !props.isSubmitting) {
        props.onSubmit()
      }
    }
  }

  return (
    <div className="grid gap-2 border-t pt-3">
      <Textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder}
        disabled={props.inputDisabled || props.isSubmitting}
      />

      {props.errorMessage ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
          {props.errorMessage}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-[11px]">{props.helperText}</p>
        <Button
          type="button"
          size="sm"
          onClick={props.onSubmit}
          disabled={!props.canSubmit || props.isSubmitting}
        >
          <SendHorizonalIcon className="size-4" />
          {props.isSubmitting ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  )
}
