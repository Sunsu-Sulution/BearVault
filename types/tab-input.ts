export type TabInputType = "text" | "number" | "date";

export interface TabInputOption {
  label: string;
  value: string;
}

export interface TabInput {
  id: string;
  tabId: string;
  key: string;
  label: string;
  type: TabInputType;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
  options?: TabInputOption[];
  order?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TabInputsState {
  tabId: string;
  inputs: TabInput[];
}

