"use client";
import { type Icon } from "@tabler/icons-react";
import {
  IconX,
  IconPencil,
  IconCopy,
  IconPlus,
  IconFolder,
  IconChevronDown,
  IconChevronRight,
  IconLink,
} from "@tabler/icons-react";
import { useState } from "react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useHelperContext } from "./providers/helper-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardTab, TabGroup } from "@/types/dashboard";
import { resolveIcon } from "@/lib/icon-resolver";
import { TabEditDialog } from "@/components/tab-edit-dialog";
import { IconSettings } from "@tabler/icons-react";

interface NavDocumentsWithGroupsProps {
  tabs: DashboardTab[];
  groups: TabGroup[];
  icon: Icon;
  onDelete?: (id: string, url: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onUpdateTab?: (id: string, updates: Partial<DashboardTab>) => void;
  onReorder?: (fromIndex: number, toIndex: number, groupId?: string) => void;
  onMoveTabToGroup?: (tabId: string, targetGroupId: string | null) => void;
  onAddGroup?: (name: string, parentId?: string) => void;
  onRemoveGroup?: (groupId: string) => void;
  onRenameGroup?: (groupId: string, name: string) => void;
  onReorderGroups?: (
    fromIndex: number,
    toIndex: number,
    parentId?: string,
  ) => void;
  onMoveGroupToParent?: (
    groupId: string,
    targetParentId: string | null,
  ) => void;
}

export function NavDocumentsWithGroups({
  tabs,
  groups,
  icon: TabIcon,
  onDelete,
  onRename,
  onDuplicate,
  onUpdateTab,
  onReorder,
  onMoveTabToGroup,
  onAddGroup,
  onRemoveGroup,
  onRenameGroup,
  onReorderGroups,
  onMoveGroupToParent,
}: NavDocumentsWithGroupsProps) {
  const { router, isLocked } = useHelperContext()();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  // Build nested group structure
  const buildGroupTree = (parentId?: string): TabGroup[] => {
    return groups
      .filter((g) => (g.parentId || undefined) === (parentId || undefined))
      .sort((a, b) => a.order - b.order);
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const isGroupCollapsed = (groupId: string) => collapsedGroups.has(groupId);

  // Get tabs for each group
  const tabsByGroup = groups.reduce((acc, group) => {
    acc[group.id] = tabs.filter((t) => t.groupId === group.id);
    return acc;
  }, {} as Record<string, DashboardTab[]>);

  // Get uncategorized tabs
  const uncategorizedTabs = tabs.filter((t) => !t.groupId);

  // Get root level groups
  const rootGroups = buildGroupTree();

  const handleEditStart = (id: string, name: string) => {
    if (isLocked) return;
    setEditingId(id);
    setEditName(name);
  };

  const handleEditSave = (id: string) => {
    if (editName.trim() && onRename) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleGroupEditStart = (groupId: string, name: string) => {
    if (isLocked) return;
    setEditingGroupId(groupId);
    setEditGroupName(name);
  };

  const handleGroupEditSave = (groupId: string) => {
    if (editGroupName.trim() && onRenameGroup) {
      onRenameGroup(groupId, editGroupName.trim());
    }
    setEditingGroupId(null);
    setEditGroupName("");
  };

  const handleGroupEditCancel = () => {
    setEditingGroupId(null);
    setEditGroupName("");
  };

  const handleAddGroup = (parentId?: string) => {
    if (isLocked || !onAddGroup) return;
    const name = prompt("ชื่อกลุ่มใหม่");
    if (name && name.trim()) {
      onAddGroup(name.trim(), parentId);
    }
  };

  const renderTabItem = (
    tab: DashboardTab,
    index: number,
    groupId?: string,
  ) => {
    const isEditing = editingId === tab.id;
    const isDragging = draggedTabId === tab.id;
    const url = tab.link || `/dashboard/${tab.id}`;
    const isLink = !!tab.link;
    const TabIconComponent = resolveIcon(tab.icon, TabIcon);

    // Debug: log icon resolution
    if (process.env.NODE_ENV === "development" && tab.icon) {
      console.log(
        `Tab "${tab.name}" icon:`,
        tab.icon,
        "Resolved to:",
        TabIconComponent,
      );
    }

    return (
      <SidebarMenuItem key={tab.id}>
        <SidebarMenuButton asChild>
          <div
            className={`flex items-center justify-between w-full group ${
              isDragging ? "opacity-50" : ""
            }`}
            draggable={!!onReorder && !isEditing && !isLocked}
            onDragStart={(e) => {
              if (isLocked) return;
              if (onReorder && tab.id) {
                setDraggedTabId(tab.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", tab.id);
                e.dataTransfer.setData("application/group", groupId || "");
                if (e.currentTarget instanceof HTMLElement) {
                  e.currentTarget.style.opacity = "0.5";
                }
              }
            }}
            onDragEnd={(e) => {
              if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = "1";
              }
              setDraggedTabId(null);
              setDragOverGroupId(null);
            }}
            onDragOver={(e) => {
              if (!onReorder || isEditing || isLocked) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              if (!onReorder || isEditing || isLocked) return;
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              const sourceGroupId = e.dataTransfer.getData("application/group");

              // If moving between groups, use moveTabToGroup
              if (sourceGroupId !== (groupId || "")) {
                if (onMoveTabToGroup) {
                  onMoveTabToGroup(draggedId, groupId || null);
                }
              } else {
                // Reorder within same group
                const groupTabs = groupId
                  ? tabsByGroup[groupId] || []
                  : uncategorizedTabs;
                const draggedItemIndex = groupTabs.findIndex(
                  (t) => t.id === draggedId,
                );

                if (draggedItemIndex !== -1 && draggedItemIndex !== index) {
                  onReorder(draggedItemIndex, index, groupId);
                }
              }
              setDraggedTabId(null);
              setDragOverGroupId(null);
            }}
          >
            <div
              className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
              onClick={() => {
                if (!isEditing) {
                  if (isLink) {
                    window.open(url, "_blank", "noopener,noreferrer");
                  } else {
                    router.push(url);
                  }
                }
              }}
            >
              <TabIconComponent className="shrink-0" />
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleEditSave(tab.id);
                    } else if (e.key === "Escape") {
                      handleEditCancel();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-6 text-sm"
                  autoFocus
                />
              ) : (
                <>
                  <span className="truncate">{tab.name}</span>
                  {isLink && (
                    <IconLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </>
              )}
            </div>
            {!isEditing &&
              (onDelete || onRename || onDuplicate || onUpdateTab) &&
              tab.id &&
              !isLocked && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-40 transition-opacity">
                  {onUpdateTab && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTabId(tab.id);
                      }}
                      title="แก้ไข Link และ Icon"
                    >
                      <IconSettings className="h-3 w-3" />
                    </Button>
                  )}
                  {onDuplicate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(tab.id);
                      }}
                      title="Duplicate"
                    >
                      <IconCopy className="h-3 w-3" />
                    </Button>
                  )}
                  {onRename && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStart(tab.id, tab.name);
                      }}
                    >
                      <IconPencil className="h-3 w-3" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive cursor-pointer opacity-60 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`คุณต้องการลบ "${tab.name}" หรือไม่?`)) {
                          onDelete(tab.id, url);
                        }
                      }}
                    >
                      <IconX className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            {isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSave(tab.id);
                  }}
                >
                  ✓
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditCancel();
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const editingTab = tabs.find((t) => t.id === editingTabId);

  const handleUpdateTab = (updates: Partial<DashboardTab>) => {
    if (editingTabId && onUpdateTab) {
      onUpdateTab(editingTabId, updates);
    }
  };

  const renderGroup = (
    group: TabGroup,
    groupIndex: number,
    parentId?: string,
  ) => {
    const groupTabs = tabsByGroup[group.id] || [];
    const isGroupEditing = editingGroupId === group.id;
    const childGroups = buildGroupTree(group.id);
    const sameLevelGroups = buildGroupTree(parentId);

    return (
      <SidebarGroup
        key={group.id}
        className="group-data-[collapsible=icon]:hidden p-0.5!"
      >
        <div
          className="flex items-center justify-between px-2 py-0.5"
          draggable={!!onReorderGroups && !isGroupEditing && !isLocked}
          onDragStart={(e) => {
            if (isLocked) return;
            if (onReorderGroups) {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("application/group-id", group.id);
              e.dataTransfer.setData(
                "application/group-parent",
                parentId || "",
              );
              if (e.currentTarget instanceof HTMLElement) {
                e.currentTarget.style.opacity = "0.5";
              }
            }
          }}
          onDragEnd={(e) => {
            if (e.currentTarget instanceof HTMLElement) {
              e.currentTarget.style.opacity = "1";
            }
          }}
          onDragOver={(e) => {
            if (!onReorderGroups || isGroupEditing || isLocked) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            if (!onReorderGroups || isGroupEditing || isLocked) return;
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("application/group-id");
            const draggedParentId = e.dataTransfer.getData(
              "application/group-parent",
            );

            // If same parent level, reorder
            if (draggedParentId === (parentId || "")) {
              const draggedIndex = sameLevelGroups.findIndex(
                (g) => g.id === draggedId,
              );
              if (draggedIndex !== -1 && draggedIndex !== groupIndex) {
                onReorderGroups?.(draggedIndex, groupIndex, parentId);
              }
            } else if (onMoveGroupToParent) {
              // Move to different parent (or make it a subfolder)
              onMoveGroupToParent(draggedId, group.id);
            }
          }}
        >
          {isGroupEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleGroupEditSave(group.id);
                  } else if (e.key === "Escape") {
                    handleGroupEditCancel();
                  }
                }}
                className="h-6 text-sm flex-1"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleGroupEditSave(group.id)}
              >
                ✓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleGroupEditCancel}
              >
                ✕
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(group.id);
                  }}
                >
                  {isGroupCollapsed(group.id) ? (
                    <IconChevronRight className="h-4 w-4" />
                  ) : (
                    <IconChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <SidebarGroupLabel
                  className="flex items-center gap-1 flex-1 cursor-pointer"
                  onClick={() => toggleGroup(group.id)}
                >
                  <IconFolder className="h-4 w-4" />
                  {group.name}
                </SidebarGroupLabel>
              </div>
              {!isLocked && (onRenameGroup || onRemoveGroup || onAddGroup) && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-40 transition-opacity">
                  {onAddGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddGroup(group.id);
                      }}
                      title="เพิ่ม Sub Folder"
                    >
                      <IconPlus className="h-3 w-3" />
                    </Button>
                  )}
                  {onRenameGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGroupEditStart(group.id, group.name);
                      }}
                    >
                      <IconPencil className="h-3 w-3" />
                    </Button>
                  )}
                  {onRemoveGroup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive opacity-60 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(`คุณต้องการลบกลุ่ม "${group.name}" หรือไม่?`)
                        ) {
                          onRemoveGroup(group.id);
                        }
                      }}
                    >
                      <IconX className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {!isGroupCollapsed(group.id) && (
          <SidebarMenu>
            {/* Render child groups recursively */}
            {childGroups.map((childGroup, childIndex) =>
              renderGroup(childGroup, childIndex, group.id),
            )}
            {/* Render tabs in this group */}
            {groupTabs.map((tab, tabIndex) =>
              renderTabItem(tab, tabIndex, group.id),
            )}
            {/* Drop zone for moving tabs to this group */}
            {!isLocked && onMoveTabToGroup && (
              <div
                className={`px-2 py-1 border-2 border-dashed rounded transition-colors ${
                  dragOverGroupId === group.id
                    ? "border-primary bg-primary/10"
                    : "border-transparent"
                }`}
                onDragOver={(e) => {
                  if (draggedTabId && draggedTabId !== group.id) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverGroupId(group.id);
                  }
                }}
                onDragLeave={() => {
                  setDragOverGroupId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId && onMoveTabToGroup) {
                    onMoveTabToGroup(draggedId, group.id);
                  }
                  setDraggedTabId(null);
                  setDragOverGroupId(null);
                }}
              >
                <span className="text-xs text-muted-foreground">
                  วางแท็บที่นี่
                </span>
              </div>
            )}
            {/* Drop zone for moving groups into this group (make it a subfolder) */}
            {!isLocked && onMoveGroupToParent && (
              <div
                className={`px-2 py-1 border-2 border-dashed rounded transition-colors border-transparent`}
                onDragOver={(e) => {
                  const draggedId = e.dataTransfer.getData(
                    "application/group-id",
                  );
                  if (draggedId && draggedId !== group.id) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData(
                    "application/group-id",
                  );
                  if (
                    draggedId &&
                    draggedId !== group.id &&
                    onMoveGroupToParent
                  ) {
                    onMoveGroupToParent(draggedId, group.id);
                  }
                }}
              >
                <span className="text-xs text-muted-foreground">
                  วางกลุ่มที่นี่เพื่อสร้าง Sub Folder
                </span>
              </div>
            )}
          </SidebarMenu>
        )}
      </SidebarGroup>
    );
  };

  return (
    <>
      <TabEditDialog
        open={!!editingTabId}
        onOpenChange={(open) => {
          if (!open) setEditingTabId(null);
        }}
        tab={editingTab || null}
        onSave={handleUpdateTab}
      />
      {/* Render Groups Recursively */}
      {rootGroups.map((group, groupIndex) =>
        renderGroup(group, groupIndex, undefined),
      )}

      {/* Uncategorized tabs */}
      {uncategorizedTabs.length > 0 && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden p-0.5!">
          <SidebarGroupLabel>Uncategorized</SidebarGroupLabel>
          <SidebarMenu>
            {uncategorizedTabs.map((tab, index) => renderTabItem(tab, index))}
            {/* Drop zone for moving tabs to uncategorized */}
            {!isLocked && onMoveTabToGroup && (
              <div
                className={`px-2 py-1 border-2 border-dashed rounded transition-colors ${
                  dragOverGroupId === null
                    ? "border-primary bg-primary/10"
                    : "border-transparent"
                }`}
                onDragOver={(e) => {
                  if (draggedTabId) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverGroupId(null);
                  }
                }}
                onDragLeave={() => {
                  setDragOverGroupId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId && onMoveTabToGroup) {
                    onMoveTabToGroup(draggedId, null);
                  }
                  setDraggedTabId(null);
                  setDragOverGroupId(null);
                }}
              >
                <span className="text-xs text-muted-foreground">
                  วางแท็บที่นี่
                </span>
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {/* Add Group Button */}
      {!isLocked && onAddGroup && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden p-0.5!">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => handleAddGroup()}
          >
            <IconPlus className="h-4 w-4 mr-2" />
            เพิ่มกลุ่ม
          </Button>
        </SidebarGroup>
      )}
    </>
  );
}
