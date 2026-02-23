import type { Extension } from "@codemirror/state"
import { css } from "@codemirror/lang-css"
import { go } from "@codemirror/lang-go"
import { html } from "@codemirror/lang-html"
import { java } from "@codemirror/lang-java"
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { python } from "@codemirror/lang-python"
import { rust } from "@codemirror/lang-rust"
import { yaml } from "@codemirror/lang-yaml"

export function getCodeMirrorLanguageExtension(
  language: string | null
): Extension | null {
  if (!language) {
    return null
  }

  if (language === "tsx") {
    return javascript({
      typescript: true,
      jsx: true,
    })
  }

  if (language === "ts") {
    return javascript({
      typescript: true,
      jsx: false,
    })
  }

  if (language === "jsx") {
    return javascript({
      typescript: false,
      jsx: true,
    })
  }

  if (language === "js") {
    return javascript({
      typescript: false,
      jsx: false,
    })
  }

  if (language === "json") {
    return json()
  }

  if (language === "markdown" || language === "md") {
    return markdown()
  }

  if (language === "html") {
    return html()
  }

  if (language === "css") {
    return css()
  }

  if (language === "yaml") {
    return yaml()
  }

  if (language === "python") {
    return python()
  }

  if (language === "go") {
    return go()
  }

  if (language === "rust") {
    return rust()
  }

  if (language === "java") {
    return java()
  }

  return null
}
