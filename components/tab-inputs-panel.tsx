"use client";

import React from "react";
import { TabInput, TabInputType } from "@/types/tab-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Hash,
  Keyboard,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";

const typeLabels: Record<TabInputType, string> = {
  text: "ข้อความ",
  number: "ตัวเลข",
  date: "วันที่",
};

const typeIcons: Record<TabInputType, React.ReactNode> = {
  text: <Keyboard className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
};

const renderValueInput = (
  input: TabInput,
  isLocked: boolean,
  canEditValue: boolean,
  inputClassName: string | undefined,
  onChange: (value: string) => void,
) => {
  const commonProps = {
    value: input.value ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange(event.target.value),
    disabled: isLocked && !canEditValue,
    placeholder: input.placeholder,
    className: inputClassName,
  };

  switch (input.type) {
    case "number":
      return <Input type="number" {...commonProps} />;
    case "date":
      return <Input type="date" {...commonProps} />;
    default:
      return <Input type="text" {...commonProps} />;
  }
};

interface TabInputsPanelProps {
  inputs: TabInput[];
  isLocked?: boolean;
  isLoaded?: boolean;
  onAddInput: () => void;
  onUpdateInput: (
    id: string,
    updates: Partial<Omit<TabInput, "id" | "tabId">>,
  ) => void;
  onRemoveInput: (id: string) => void;
  onSetValue: (id: string, value: string) => void;
  onReorderInput?: (fromIndex: number, toIndex: number) => void;
  allowValueEditingWhenLocked?: boolean;
}

export function TabInputsPanel({
  inputs,
  isLocked = false,
  isLoaded = true,
  onAddInput,
  onUpdateInput,
  onRemoveInput,
  onSetValue,
  allowValueEditingWhenLocked = false,
}: TabInputsPanelProps) {
  const canEditStructure = !isLocked;
  const handleTypeSelect = (inputId: string, type: TabInputType) => {
    onUpdateInput(inputId, { type });
  };

  const handleAddInput = () => {
    onAddInput();
  };

  const canEditValue = !isLocked || allowValueEditingWhenLocked;
  const itemWrapperClass = isLocked
    ? "flex flex-col gap-4 rounded-lg border border-border/60 p-4 md:flex-row md:items-start"
    : "grid gap-2 rounded-lg border border-border/60 bg-card/60 p-3 md:grid-cols-[220px,1fr] md:items-center";

  return (
    <Card className="bg-background/70 border-dashed">
      {!isLocked && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" size="sm" onClick={handleAddInput}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มตัวแปร
            </Button>
            <CardTitle className="text-base font-semibold text-foreground">
              ตัวแปรสำหรับแท็บนี้
            </CardTitle>
          </div>
        </CardHeader>
      )}

      <CardContent className="space-y-4">
        {!isLoaded ? (
          <div className="text-sm text-muted-foreground">
            กำลังโหลดตัวแปร...
          </div>
        ) : inputs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/40 p-6 text-center text-sm text-muted-foreground">
            {isLocked
              ? "ไม่มีตัวแปรสำหรับแท็บนี้"
              : "ยังไม่มีตัวแปร เพิ่มเพื่อใช้เป็นเงื่อนไขในกราฟและคิวรี"}
          </div>
        ) : (
          inputs.map((input) => (
            <div key={input.id} className={itemWrapperClass}>
              <div
                className={
                  isLocked
                    ? "flex w-full flex-col gap-3 md:w-64"
                    : "flex flex-col gap-2 md:col-span-1"
                }
              >
                <div className="flex items-center gap-2">
                  {typeIcons[input.type]}
                  {canEditStructure ? (
                    <Input
                      value={input.label}
                      onChange={(event) =>
                        onUpdateInput(input.id, {
                          label: event.target.value,
                        })
                      }
                      placeholder="ชื่อที่แสดง"
                      className="h-9 text-sm"
                    />
                  ) : (
                    <span className="font-medium text-foreground">
                      {input.label}
                    </span>
                  )}
                </div>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">คีย์</span>
                    {canEditStructure ? (
                      <Input
                        value={input.key}
                        onChange={(event) =>
                          onUpdateInput(input.id, { key: event.target.value })
                        }
                        placeholder="ตัวอย่าง: start_date"
                        className="h-9 text-sm"
                      />
                    ) : (
                      <code className="rounded-md bg-muted px-2 py-1 text-xs">
                        {input.key}
                      </code>
                    )}
                  </div>
                )}

                {canEditStructure && (
                  <Input
                    value={input.placeholder ?? ""}
                    onChange={(event) =>
                      onUpdateInput(input.id, {
                        placeholder: event.target.value || undefined,
                      })
                    }
                    placeholder="Placeholder (ไม่บังคับ)"
                    className="h-9 text-sm"
                  />
                )}
              </div>
              <div
                className={
                  isLocked
                    ? "flex w-full flex-1 flex-col gap-3"
                    : "flex w-full flex-col gap-3 md:col-span-1"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center gap-2"
                        disabled={!canEditStructure}
                      >
                        {typeIcons[input.type]}
                        <span>{typeLabels[input.type]}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="z-[500]">
                      {(["text", "number", "date"] as TabInputType[]).map(
                        (type) => (
                          <DropdownMenuItem
                            key={type}
                            onSelect={(event) => {
                              event.preventDefault();
                              handleTypeSelect(input.id, type);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {typeIcons[type]}
                              <span>{typeLabels[type]}</span>
                            </div>
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <code className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {`{{${input.key}}}`}
                  </code>
                  {input.description ? (
                    <span className="text-xs text-muted-foreground">
                      {input.description}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    {renderValueInput(
                      input,
                      isLocked,
                      canEditValue,
                      isLocked ? undefined : "h-9 text-sm",
                      (value) => onSetValue(input.id, value),
                    )}
                    {(input.defaultValue || input.placeholder) && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {input.defaultValue ? (
                          <div>
                            ค่าเริ่มต้น:{" "}
                            <code className="rounded bg-muted px-1 py-0.5">
                              {input.defaultValue}
                            </code>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  {!isLocked && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[500]">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(event) => {
                            event.preventDefault();
                            onRemoveInput(input.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          ลบตัวแปร
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
