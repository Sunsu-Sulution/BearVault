"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserRole, UserPermission } from "@/types/permission";
import { useHelperContext } from "./providers/helper-provider";
import { IconSettings, IconTrash, IconPlus } from "@tabler/icons-react";

export function PermissionsDialog() {
  const { userInfo, permissions, refreshPermissions } = useHelperContext()();
  const [open, setOpen] = useState(false);
  const [permissionsList, setPermissionsList] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("viewer");

  const fetchPermissions = async () => {
    if (!userInfo?.email) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/user-configs/permissions", {
        headers: {
          "x-user-email": userInfo.email,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPermissionsList(data.permissions || []);
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userInfo?.email]);

  const handleAddPermission = async () => {
    if (!newUserEmail.trim() || !userInfo?.email) return;

    try {
      const response = await fetch("/api/user-configs/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userInfo.email,
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          role: newUserRole,
          userEmail: userInfo.email,
        }),
      });

      if (response.ok) {
        setNewUserEmail("");
        setNewUserRole("viewer");
        await fetchPermissions();
        await refreshPermissions();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add permission");
      }
    } catch (error) {
      console.error("Error adding permission:", error);
      alert("Failed to add permission");
    }
  };

  const handleDeletePermission = async (email: string) => {
    if (
      !confirm(`คุณต้องการลบสิทธิ์ของ ${email} หรือไม่?`) ||
      !userInfo?.email
    ) {
      return;
    }

    try {
      const response = await fetch("/api/user-configs/permissions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userInfo.email,
        },
        body: JSON.stringify({
          email,
          userEmail: userInfo.email,
        }),
      });

      if (response.ok) {
        await fetchPermissions();
        await refreshPermissions();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete permission");
      }
    } catch (error) {
      console.error("Error deleting permission:", error);
      alert("Failed to delete permission");
    }
  };

  const handleUpdateRole = async (email: string, newRole: UserRole) => {
    if (!userInfo?.email) return;

    try {
      const response = await fetch("/api/user-configs/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userInfo.email,
        },
        body: JSON.stringify({
          email,
          role: newRole,
          userEmail: userInfo.email,
        }),
      });

      if (response.ok) {
        await fetchPermissions();
        await refreshPermissions();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update permission");
      }
    } catch (error) {
      console.error("Error updating permission:", error);
      alert("Failed to update permission");
    }
  };

  // Check if user can manage permissions
  if (!permissions?.canManagePermissions) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-2 w-full cursor-pointer">
          <IconSettings className="h-4 w-4 shrink-0" />
          <span className="truncate">จัดการสิทธิ์ผู้ใช้</span>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>จัดการสิทธิ์ผู้ใช้</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add new permission */}
              <div className="p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <IconPlus className="h-4 w-4" />
                  <span className="font-semibold text-sm">เพิ่มผู้ใช้ใหม่</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select
                    value={newUserRole}
                    onValueChange={(value: string) =>
                      setNewUserRole(value as UserRole)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddPermission} size="sm">
                    เพิ่ม
                  </Button>
                </div>
              </div>

              {/* Permissions list */}
              <div className="space-y-2">
                {permissionsList.map((permission) => (
                  <div
                    key={permission.email}
                    className="p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {permission.email}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          สร้างเมื่อ:{" "}
                          {new Date(permission.createdAt).toLocaleString(
                            "th-TH",
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={permission.role}
                          onValueChange={(value: string) =>
                            handleUpdateRole(
                              permission.email,
                              value as UserRole,
                            )
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="super_admin">
                              Super Admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDeletePermission(permission.email)
                          }
                          className="text-destructive hover:text-destructive"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {permissionsList.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    ยังไม่มีผู้ใช้ที่ได้รับสิทธิ์
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
