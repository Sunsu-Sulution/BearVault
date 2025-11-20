"use client";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toast } from "@/components/ui/toast";
import {
  Lock,
  Unlock,
  Share2,
  Globe,
  GlobeLock,
  ChevronDown,
  StickyNote,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useHelperContext } from "./providers/helper-provider";
import { useParams, useRouter } from "next/navigation";
import { ActiveViewers } from "@/components/active-viewers";
import { ChangeHistoryDialog } from "@/components/change-history-dialog";
import { useDashboardTabs } from "@/hooks/use-dashboard-tabs";
import { useNotes } from "@/hooks/use-notes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useMemo, useEffect } from "react";
import { ChatPanel } from "@/components/chat-panel";

export function SiteHeader() {
  const {
    header,
    isLocked,
    setIsLocked,
    userInfo,
    notesVisible,
    setNotesVisible,
    permissions,
  } = useHelperContext()();
  const params = useParams<{ tab?: string }>();
  const router = useRouter();
  const tabId = params.tab as string | undefined;
  const { tabs, reloadTabs } = useDashboardTabs();
  const currentTab = tabs.find((t) => t.id === tabId);
  const isPublic = useMemo(
    () => currentTab?.isPublic || false,
    [currentTab?.isPublic],
  );
  const [isPublicState, setIsPublicState] = useState(isPublic);
  const [toastOpen, setToastOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const isMobile = useIsMobile();

  const { addNote } = useNotes({ tabId });

  // Update header title when tab changes
  useEffect(() => {
    if (currentTab?.name) {
      header.setTitle(currentTab.name);
      document.title = `${currentTab.name} - Dashboard`;
    } else if (tabId) {
      header.setTitle(tabId);
      document.title = `${tabId} - Dashboard`;
    } else {
      header.setTitle("");
      document.title = "Dashboard";
    }
  }, [currentTab?.name, tabId, header.setTitle]);

  // Sync state when tab changes - use derived state approach
  const effectiveIsPublic =
    isPublic !== isPublicState && currentTab ? isPublic : isPublicState;

  const handleShareTab = () => {
    if (!tabId || !effectiveIsPublic) return;

    const origin = window.location.origin;
    const publicTabUrl = `${origin}/public/tab/${tabId}`;

    navigator.clipboard
      .writeText(publicTabUrl)
      .then(() => {
        setToastOpen(true);
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
      });
  };

  const handleSetPublic = async (value: boolean) => {
    if (!tabId || !currentTab || effectiveIsPublic === value) return;

    try {
      // Update tab in database
      const response = await fetch("/api/user-configs/dashboard-tabs");
      if (response.ok) {
        const data = await response.json();
        const updatedTabs = (data.tabs || []).map(
          (tab: { id: string; isPublic?: boolean }) =>
            tab.id === tabId ? { ...tab, isPublic: value } : tab,
        );

        const saveResponse = await fetch("/api/user-configs/dashboard-tabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabs: updatedTabs }),
        });

        if (saveResponse.ok) {
          // Update local state immediately
          setIsPublicState(value);
          // Reload tabs to sync with database
          await reloadTabs();
          // Update state again after reload
          setIsPublicState(value);
        }
      }
    } catch (error) {
      console.error("Failed to update tab public state:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Reload tabs
    await reloadTabs();
    
    // Dispatch reloadNotes event for notes
    if (tabId && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("reloadNotes", { detail: { tabId } })
      );
    }
    
    // Reload the page to refresh all data
    router.refresh();
    
    // Reset animation after a short delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleAddNote = async () => {
    if (!tabId || !userInfo) {
      console.error("Cannot add note: missing tabId or userInfo", {
        tabId,
        userInfo,
      });
      return;
    }
    const userId = userInfo.user_id || userInfo.email || "";
    const userName = userInfo.name || userInfo.en_name || userId;

    try {
      // Wait for DOM to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the main content container to calculate relative position
      const contentContainer = document.querySelector(
        "[data-content-container]",
      ) as HTMLElement;
      let centerX = 200; // Default position
      let centerY = 200;

      if (contentContainer) {
        const containerRect = contentContainer.getBoundingClientRect();

        // Calculate position relative to container, but use viewport center for Y
        // This ensures note appears in the visible area
        // Note: container already starts after sidebar, so we don't need to account for sidebar width
        const viewportCenterX = window.innerWidth / 2;
        const viewportCenterY = window.innerHeight / 2;

        // Convert viewport coordinates to container-relative coordinates
        centerX = Math.max(0, viewportCenterX - containerRect.left - 150);
        centerY = Math.max(0, viewportCenterY - containerRect.top - 100);

        // Ensure note doesn't go outside container bounds
        centerX = Math.min(centerX, containerRect.width - 300);
        centerY = Math.min(centerY, containerRect.height - 200);
      } else {
        // Fallback: use viewport center but adjust for sidebar
        const sidebar = document.querySelector(
          '[data-slot="sidebar-container"]',
        ) as HTMLElement;
        const sidebarWidth = sidebar && sidebar.offsetWidth > 0 ? 256 : 0;
        centerX = Math.max(sidebarWidth, window.innerWidth / 2 - 150);
        centerY = Math.max(0, window.innerHeight / 2 - 100);
      }

      const result = await addNote({
        tabId,
        content: "",
        position: { x: centerX, y: centerY },
        size: { width: 300, height: 200 },
        color: "yellow", // Default color
        createdBy: userId,
        createdByName: userName,
      });

      if (!result) {
        console.error("addNote returned undefined");
      } else {
        // Show notes if they were hidden, so user can see the newly added note
        if (!notesVisible) {
          setNotesVisible(true);
        }
      }
    } catch (error) {
      console.error("Error adding note:", error);
      alert(
        "เกิดข้อผิดพลาดในการเพิ่ม note: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[200] w-full flex h-(--header-height) items-center gap-1 sm:gap-2 border-b bg-background/20 backdrop-blur-md transition-all ease-linear rounded-t-xl">
        <div className="flex w-full items-center gap-1 px-2 sm:px-4 lg:gap-2 lg:px-6 overflow-x-auto">
          <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
            className="mx-1 sm:mx-2 data-[orientation=vertical]:h-4 shrink-0 hidden sm:block"
        />
          <h1 className="text-sm sm:text-base font-medium truncate min-w-0">
            {header.title}
          </h1>
          {tabId && userInfo && !isMobile && (
            <>
              <ActiveViewers
                tabId={tabId}
                currentUserId={userInfo.user_id || userInfo.email}
                currentUserName={userInfo.name || userInfo.en_name || ""}
                currentUserEmail={userInfo.email || ""}
              />
              <ChangeHistoryDialog tabId={tabId} />
            </>
          )}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            {tabId && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={effectiveIsPublic ? "default" : "ghost"}
                      size={isMobile ? "icon" : "sm"}
                      className={isMobile ? "" : "gap-2"}
                    >
                      {effectiveIsPublic ? (
                        <>
                          <Globe className="h-4 w-4" />
                          {!isMobile && <span>Public</span>}
                        </>
                      ) : (
                        <>
                          <GlobeLock className="h-4 w-4" />
                          {!isMobile && <span>Private</span>}
                        </>
                      )}
                      {!isMobile && <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[250]">
                    <DropdownMenuItem
                      onClick={() => handleSetPublic(true)}
                      className="gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      <span>Public</span>
                      {effectiveIsPublic && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleSetPublic(false)}
                      className="gap-2"
                    >
                      <GlobeLock className="h-4 w-4" />
                      <span>Private</span>
                      {!effectiveIsPublic && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {effectiveIsPublic && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleShareTab}
                    title="แชร์แท็บ"
                    data-share-tab
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
            {tabId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="รีเฟรช Dashboard"
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            )}
            {tabId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Note"
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[250]">
                  <DropdownMenuItem
                    onClick={handleAddNote}
                    className="gap-2"
                  >
                    <StickyNote className="h-4 w-4" />
                    <span>เพิ่ม Note</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setNotesVisible(!notesVisible)}
                    className="gap-2"
                  >
                    {notesVisible ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        <span>ซ่อน Notes</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        <span>แสดง Notes</span>
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {permissions?.canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsLocked(!isLocked)}
                title={isLocked ? "คลิกเพื่อแก้ไข" : "คลิกเพื่อล็อก"}
              >
                {isLocked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="default"
              size={isMobile ? "icon" : "sm"}
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={isMobile ? "" : "gap-2"}
              title="Ask AI"
            >
              <Sparkles className="h-4 w-4" />
              {!isMobile && <span>Ask AI</span>}
            </Button>
          </div>
      </div>
    </header>
      <ChatPanel
        open={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        tabId={tabId}
      />
      <Toast
        message="คัดลอกลิงก์แล้ว"
        open={toastOpen}
        onClose={() => setToastOpen(false)}
      />
    </>
  );
}
