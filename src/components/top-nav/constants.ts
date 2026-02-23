import {
  BotIcon,
  CableIcon,
  SparklesIcon,
  SquareCheckBigIcon,
} from "lucide-react"

import type { TopNavItem } from "./types"

export const NAV_ITEMS: TopNavItem[] = [
  {
    key: "review",
    label: "Code Review",
    icon: SquareCheckBigIcon,
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: BotIcon,
  },
  {
    key: "skills",
    label: "Skills",
    icon: SparklesIcon,
  },
  {
    key: "mcp",
    label: "MCP",
    icon: CableIcon,
  },
]
