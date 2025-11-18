export type TabGroup = {
  id: string;
  name: string;
  order: number;
  parentId?: string; // ID of parent group for nested folders. If undefined, group is at root level
};

export type DashboardTab = {
  id: string; // slug
  name: string;
  createdAt: string;
  isPublic?: boolean; // Whether this tab can be accessed via public link
  groupId?: string; // ID of the group this tab belongs to. If undefined, tab is in "Uncategorized"
  link?: string; // External link URL - if set, clicking tab opens this link in new tab
  icon?: string; // Icon name from @tabler/icons-react (e.g., "IconHome", "IconDatabase")
};

export type DashboardTabsState = {
  tabs: DashboardTab[];
  groups?: TabGroup[]; // Optional: array of groups. If not provided, tabs without groupId are shown as "Uncategorized"
};

export type MysqlConnection = {
  host: string;
  port?: number;
  user: string;
  password: string;
  database?: string;
};


