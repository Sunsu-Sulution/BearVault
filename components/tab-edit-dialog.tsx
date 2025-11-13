"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardTab } from "@/types/dashboard";
import { type Icon } from "@tabler/icons-react";
import {
  IconSettings,
  IconLink,
  IconPalette,
  IconX,
  IconHome,
  IconFolder,
  IconGitBranch,
  IconDatabase,
  IconChartBar,
  IconTable,
  IconFileText,
  IconUsers,
  IconMail,
  IconBell,
  IconSearch,
  IconCalendar,
  IconClock,
  IconStar,
  IconHeart,
  IconBookmark,
  IconTag,
  IconFlag,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// Common icons to show in the picker - organized by category
const COMMON_ICONS: Array<{ name: string; component: Icon }> = [
  // Navigation
  { name: "IconHome", component: IconHome },
  { name: "IconFolder", component: IconFolder },
  { name: "IconGitBranch", component: IconGitBranch },
  { name: "IconLink", component: IconLink },
  // Data & Charts
  { name: "IconDatabase", component: IconDatabase },
  { name: "IconChartBar", component: IconChartBar },
  { name: "IconTable", component: IconTable },
  { name: "IconFileText", component: IconFileText },
  // Communication
  { name: "IconUsers", component: IconUsers },
  { name: "IconMail", component: IconMail },
  { name: "IconBell", component: IconBell },
  { name: "IconSearch", component: IconSearch },
  // Time & Calendar
  { name: "IconCalendar", component: IconCalendar },
  { name: "IconClock", component: IconClock },
  // Actions & Status
  { name: "IconSettings", component: IconSettings },
  { name: "IconStar", component: IconStar },
  { name: "IconHeart", component: IconHeart },
  { name: "IconBookmark", component: IconBookmark },
  { name: "IconTag", component: IconTag },
  { name: "IconFlag", component: IconFlag },
];

interface TabEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: DashboardTab | null;
  onSave: (updates: Partial<DashboardTab>) => void;
}

export function TabEditDialog({
  open,
  onOpenChange,
  tab,
  onSave,
}: TabEditDialogProps) {
  // Initialize state from tab props - use key to reset when tab changes
  const [link, setLink] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<string>("");

  // Update state when dialog opens or tab changes
  useEffect(() => {
    if (open && tab) {
      setLink(tab.link || "");
      setSelectedIcon(tab.icon || "");
    } else {
      setLink("");
      setSelectedIcon("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab?.id, tab?.link, tab?.icon]);

  const handleSave = () => {
    if (!tab) return;
    // Debug: log icon name being saved
    if (process.env.NODE_ENV === "development") {
      console.log("Saving icon:", selectedIcon);
    }
    onSave({
      link: link.trim() || undefined,
      icon: selectedIcon || undefined,
    });
    onOpenChange(false);
  };

  const SelectedIconComponent = useMemo(() => {
    if (!selectedIcon) return null;
    const iconData = COMMON_ICONS.find((icon) => icon.name === selectedIcon);
    return iconData ? iconData.component : null;
  }, [selectedIcon]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-2xl">
        <DialogHeader className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10">
              <IconSettings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">
                แก้ไขแท็บ
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                ตั้งค่า Link และ Icon สำหรับแท็บ{" "}
                <span className="font-medium text-foreground">
                  &quot;{tab?.name}&quot;
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Link Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconLink className="h-4 w-4 text-muted-foreground" />
              <label htmlFor="link" className="text-sm font-semibold">
                External Link
              </label>
              <span className="text-xs text-muted-foreground">(ไม่บังคับ)</span>
            </div>
            <Input
              id="link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com"
              type="url"
              className="h-10 transition-all focus:ring-2 focus:ring-purple-500/20"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              หากระบุ Link เมื่อคลิกแท็บจะเปิดหน้าใหม่ตาม Link นี้ในแท็บใหม่
            </p>
          </div>

          {/* Icon Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <IconPalette className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-semibold">Icon</label>
              <span className="text-xs text-muted-foreground">(ไม่บังคับ)</span>
            </div>

            {/* Selected Icon Preview */}
            {SelectedIconComponent && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background border shadow-sm">
                  <SelectedIconComponent className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedIcon}</p>
                  <p className="text-xs text-muted-foreground">Icon ที่เลือก</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedIcon("")}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Icon Grid */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                เลือก Icon:
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[280px] overflow-y-auto p-1 rounded-lg border bg-muted/20">
                {/* None option */}
                <button
                  type="button"
                  onClick={() => setSelectedIcon("")}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 transition-all hover:border-primary/50 hover:bg-accent",
                    !selectedIcon
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-transparent hover:border-primary/30",
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <IconX className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    ไม่มี
                  </span>
                </button>

                {/* Icon options */}
                {COMMON_ICONS.map((iconData) => {
                  const isSelected = selectedIcon === iconData.name;
                  const IconComp = iconData.component;
                  return (
                    <button
                      key={iconData.name}
                      type="button"
                      onClick={() => {
                        if (process.env.NODE_ENV === "development") {
                          console.log(
                            "Selecting icon:",
                            iconData.name,
                            "Component:",
                            IconComp,
                          );
                        }
                        setSelectedIcon(iconData.name);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 transition-all hover:scale-105 hover:border-primary/50 hover:bg-accent hover:shadow-sm",
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm scale-105"
                          : "border-transparent hover:border-primary/30",
                      )}
                      title={iconData.name}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                          isSelected
                            ? "bg-primary/20 text-primary"
                            : "bg-background text-foreground",
                        )}
                      >
                        <IconComp className="h-4 w-4" />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground truncate w-full text-center">
                        {iconData.name.replace("Icon", "")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              เลือก Icon จาก @tabler/icons-react เพื่อแสดงในแท็บ
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-w-[100px]"
          >
            ยกเลิก
          </Button>
          <Button onClick={handleSave}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
