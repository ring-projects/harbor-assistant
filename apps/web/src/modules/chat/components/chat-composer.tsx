"use client"

import { SendHorizonalIcon } from "lucide-react"
import type { KeyboardEvent } from "react"

import { Button } from "@/components/ui/button"

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
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (props.canSubmit && !props.isSubmitting) {
        props.onSubmit()
      }
    }
  }

  return (
    <div className="grid gap-2 border-t pt-3">
      <textarea
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={props.placeholder}
        disabled={props.inputDisabled || props.isSubmitting}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[104px] w-full resize-none rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
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
          {props.isSubmitting ? "发送中..." : "发送"}
        </Button>
      </div>
    </div>
  )
}
