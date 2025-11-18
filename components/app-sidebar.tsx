/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import {
  IconGitBranch,
  IconPlus,
  IconDatabase,
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";

import { NavDocuments } from "@/components/nav-documents";
import { NavDocumentsWithGroups } from "@/components/nav-documents-with-groups";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useHelperContext } from "@/components/providers/helper-provider";
import { useDashboardTabs } from "@/hooks/use-dashboard-tabs";
import { Button } from "@/components/ui/button";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { isLocked, userInfo } = useHelperContext()();
  const { 
    tabs, 
    groups,
    addTab, 
    removeTab, 
    renameTab, 
    updateTab,
    reorderTabs, 
    duplicateTab,
    moveTabToGroup,
    addGroup,
    removeGroup,
    renameGroup,
    reorderGroups,
    moveGroupToParent,
  } = useDashboardTabs({
      userId: userInfo?.user_id || userInfo?.email || "",
      userName: userInfo?.name || userInfo?.en_name || "",
      userEmail: userInfo?.email || "",
    });
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const handleAddTab = async () => {
    const name = prompt("ชื่อแท็บใหม่");
    if (!name) return;
    const slug = addTab(name);
    window.location.href = `/dashboard/${slug}`;
  };

  const handleDeleteTab = (id: string, url: string) => {
    if (isLocked) return;
    const currentPath = window.location.pathname;
    const remainingTabs = tabs.filter((t) => t.id !== id);

    if (currentPath === url) {
      removeTab(id);
      if (remainingTabs.length > 0) {
        window.location.href = `/dashboard/${remainingTabs[0].id}`;
      } else {
        window.location.href = "/dashboard";
      }
    } else {
      removeTab(id);
    }
  };

  const handleDuplicateTab = async (id: string) => {
    if (isLocked) return;
    const name = prompt("ตั้งชื่อแท็บที่คัดลอก", "Copy of tab");
    const newTabId = await duplicateTab(id, name || undefined);
    if (newTabId) {
      window.location.href = `/dashboard/${newTabId}`;
    }
  };

  const handleRenameTab = (id: string, name: string) => {
    if (isLocked) return;
    renameTab(id, name);
  };

  const handleUpdateTab = (id: string, updates: Partial<import("@/types/dashboard").DashboardTab>) => {
    if (isLocked) return;
    updateTab(id, updates);
  };

  const handleExportAll = async () => {
    try {
      const response = await fetch("/api/user-configs/export");
      if (!response.ok) {
        throw new Error("Failed to export");
      }

      const exportData = await response.json();

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-export-${
        new Date().toISOString().split("T")[0]
      }.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting:", error);
      alert("เกิดข้อผิดพลาดในการ export");
    }
  };

  const handleImportAll = () => {
    fileRef.current?.click();
  };

  const handleImportChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text) as {
        tabs?: unknown;
        connections?: unknown;
        chartConfigs?: Record<string, unknown>;
      };

      if (
        !confirm(
          "การ import จะ override ข้อมูลทั้งหมด (tabs, connections, chart configs) คุณต้องการดำเนินการต่อหรือไม่?",
        )
      ) {
        e.currentTarget.value = "";
        return;
      }

      const response = await fetch("/api/user-configs/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(importData),
      });

      if (!response.ok) {
        throw new Error("Failed to import");
      }

      window.location.reload();
    } catch (error) {
      console.error("Error importing:", error);
      alert("เกิดข้อผิดพลาดในการ import");
    }

    e.currentTarget.value = "";
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <div>
                <img src="/logo.png" alt="logo icon" className="h-8" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {!isLocked && (
          <>
            <div className="mt-5"></div>
            <Button
              variant="outline"
              size="sm"
              style={{ marginLeft: 15, marginRight: 15 }}
              onClick={handleAddTab}
            >
              <IconPlus className="mr-2" /> Create New Tab
            </Button>
          </>
        )}
        {(tabs.length > 0 || groups.length > 0) && (
          <NavDocumentsWithGroups
            tabs={tabs}
            groups={groups}
            icon={IconGitBranch}
            onDelete={handleDeleteTab}
            onRename={handleRenameTab}
            onDuplicate={handleDuplicateTab}
            onUpdateTab={handleUpdateTab}
            onReorder={reorderTabs}
            onMoveTabToGroup={moveTabToGroup}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
            onRenameGroup={renameGroup}
            onReorderGroups={reorderGroups}
            onMoveGroupToParent={moveGroupToParent}
          />
        )}
        <NavDocuments
          label="Connections"
          items={[
            {
              name: "Manage Connections",
              url: "/dashboard/db-connection",
              icon: IconDatabase,
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full gap-2">
            <NavUser />
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              className="flex-1"
            >
              <IconDownload className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportAll}
              className="flex-1"
            >
              <IconUpload className="mr-2 h-4 w-4" /> Import
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
