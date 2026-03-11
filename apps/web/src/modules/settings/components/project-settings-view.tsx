"use client"

import { RotateCcwIcon, SaveIcon, XIcon } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ProjectSettingsViewProps = {
  projectId: string
  mode?: "page" | "modal"
  onClose?: () => void
}

type SettingsDraft = {
  defaultExecutor: string
  defaultModel: string
  maxConcurrentTasks: string
  logRetentionDays: string
  eventRetentionDays: string
}

const INITIAL_DRAFT: SettingsDraft = {
  defaultExecutor: "codex",
  defaultModel: "gpt-5-codex",
  maxConcurrentTasks: "1",
  logRetentionDays: "30",
  eventRetentionDays: "14",
}

function SettingsField(props: {
  label: string
  description: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  type?: React.ComponentProps<typeof Input>["type"]
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{props.label}</span>
      <span className="text-muted-foreground text-xs">{props.description}</span>
      <Input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        type={props.type}
      />
    </label>
  )
}

export function ProjectSettingsView({
  projectId,
  mode = "page",
  onClose,
}: ProjectSettingsViewProps) {
  const [draft, setDraft] = useState<SettingsDraft>(INITIAL_DRAFT)

  const hasChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(INITIAL_DRAFT),
    [draft],
  )

  const shellClassName =
    mode === "modal"
      ? "bg-background flex h-full min-h-0 flex-col"
      : "bg-background flex min-h-full flex-col"

  return (
    <div className={shellClassName}>
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">Project Settings</h1>
            <span className="text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[11px]">
              {projectId}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            当前先完善设置界面交互。真实读写接口后续再接入。
          </p>
        </div>

        {onClose ? (
          <Button type="button" variant="outline" size="icon" onClick={onClose}>
            <XIcon className="size-4" />
            <span className="sr-only">Close settings</span>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid min-h-full gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="grid content-start gap-4">
            <Card className="p-4">
              <p className="text-sm font-semibold">Settings Scope</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                这组设置用于定义 project 级别的默认执行策略和事件留存策略。
              </p>

              <Separator className="my-4" />

              <dl className="grid gap-3 text-sm">
                <div className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Default Executor</dt>
                  <dd className="font-medium">{draft.defaultExecutor || "-"}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Default Model</dt>
                  <dd className="font-medium">{draft.defaultModel || "-"}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Concurrency</dt>
                  <dd className="font-medium">{draft.maxConcurrentTasks || "-"}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Log Retention</dt>
                  <dd className="font-medium">
                    {draft.logRetentionDays ? `${draft.logRetentionDays} days` : "Disabled"}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground text-xs">Event Retention</dt>
                  <dd className="font-medium">
                    {draft.eventRetentionDays
                      ? `${draft.eventRetentionDays} days`
                      : "Disabled"}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold">Implementation Note</p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                这里先交付 modal 交互和设置编排方式，后续可以直接把表单字段接到
                project settings API，而不需要再改页面结构。
              </p>
            </Card>
          </aside>

          <Card className="min-h-0 p-4">
            <Tabs defaultValue="general" className="flex h-full min-h-0 flex-col gap-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="execution">Execution</TabsTrigger>
                <TabsTrigger value="retention">Retention</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-0 flex-1 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SettingsField
                    label="Default Executor"
                    description="新任务默认使用的执行器。当前先按 codex 设计。"
                    value={draft.defaultExecutor}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, defaultExecutor: value }))
                    }
                    placeholder="codex"
                  />
                  <SettingsField
                    label="Default Model"
                    description="新任务默认模型。后续可以和 executor 绑定。"
                    value={draft.defaultModel}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, defaultModel: value }))
                    }
                    placeholder="gpt-5-codex"
                  />
                </div>
              </TabsContent>

              <TabsContent value="execution" className="mt-0 flex-1 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SettingsField
                    label="Max Concurrent Tasks"
                    description="限制当前 project 同时并发执行的任务数量。"
                    value={draft.maxConcurrentTasks}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, maxConcurrentTasks: value }))
                    }
                    type="number"
                    placeholder="1"
                  />
                </div>

                <div className="bg-muted/30 rounded-lg border p-4">
                  <p className="text-sm font-medium">Behavior Preview</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    当并发上限为 <span className="font-medium">{draft.maxConcurrentTasks}</span>{" "}
                    时，新的 task 请求会根据调度策略进入队列。这个区域后续可以接入更细的运行策略配置。
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="retention" className="mt-0 flex-1 space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SettingsField
                    label="Log Retention Days"
                    description="stdout / stderr 聚合内容保留天数，空值表示不限制。"
                    value={draft.logRetentionDays}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, logRetentionDays: value }))
                    }
                    type="number"
                    placeholder="30"
                  />
                  <SettingsField
                    label="Event Retention Days"
                    description="agent event 留存天数，空值表示不限制。"
                    value={draft.eventRetentionDays}
                    onChange={(value) =>
                      setDraft((current) => ({ ...current, eventRetentionDays: value }))
                    }
                    type="number"
                    placeholder="14"
                  />
                </div>

                <div className="bg-muted/30 rounded-lg border p-4">
                  <p className="text-sm font-medium">Retention Strategy</p>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    当前的数据模型已经切到 event-first。后续真正接接口时，这里的配置可以直接映射到
                    `logRetentionDays` 和 `eventRetentionDays`。
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between border-t px-5 py-3">
        <p className="text-muted-foreground text-xs">
          {hasChanges ? "你已经修改了本地草稿，尚未持久化到后端。" : "当前为默认草稿配置。"}
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft(INITIAL_DRAFT)}
            disabled={!hasChanges}
          >
            <RotateCcwIcon className="size-4" />
            Reset
          </Button>

          {onClose ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : null}

          <Button type="button" disabled>
            <SaveIcon className="size-4" />
            Save API Pending
          </Button>
        </div>
      </div>
    </div>
  )
}
