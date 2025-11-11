"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TabInput, TabInputType } from "@/types/tab-input";

interface UseTabInputsOptions {
  tabId?: string;
}

const sanitizeKey = (key: string) => {
  return key
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 50);
};

const DEFAULT_LABEL = "ตัวแปรใหม่";

export function useTabInputs(options: UseTabInputsOptions) {
  const tabId = options.tabId;
  const [inputs, setInputs] = useState<TabInput[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadInputs = useCallback(async () => {
    if (typeof window === "undefined" || !tabId) {
      setInputs([]);
      setIsLoaded(true);
      return;
    }

    try {
      const response = await fetch(
        `/api/user-configs/tab-inputs?tabId=${encodeURIComponent(tabId)}`,
      );
      if (response.ok) {
        const data = (await response.json()) as {
          tabId: string;
          inputs?: TabInput[];
        };
        setInputs(
          Array.isArray(data.inputs)
            ? data.inputs.map((input, index) => ({
                ...input,
                order: input.order ?? index,
              }))
            : [],
        );
      } else {
        setInputs([]);
      }
    } catch (error) {
      console.error("Error loading tab inputs:", error);
      setInputs([]);
    } finally {
      setIsLoaded(true);
    }
  }, [tabId]);

  useEffect(() => {
    setIsLoaded(false);
    setInputs([]);
    if (!tabId) {
      setIsLoaded(true);
      return;
    }
    loadInputs();
  }, [loadInputs, tabId]);

  const saveInputs = useCallback(
    async (nextInputs: TabInput[]) => {
      setInputs(nextInputs);
      if (typeof window === "undefined" || !tabId) {
        return;
      }
      try {
        await fetch("/api/user-configs/tab-inputs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tabId,
            inputs: nextInputs,
          }),
        });
      } catch (error) {
        console.error("Error saving tab inputs:", error);
      }
    },
    [tabId],
  );

  const ensureUniqueKey = useCallback(
    (desiredKey: string, excludeId?: string) => {
      let candidate = sanitizeKey(desiredKey);
      if (!candidate) {
        candidate = "input";
      }
      const existingKeys = new Set(
        inputs
          .filter((input) => input.id !== excludeId)
          .map((input) => input.key),
      );
      let suffix = 1;
      let uniqueKey = candidate;
      while (existingKeys.has(uniqueKey)) {
        uniqueKey = `${candidate}_${suffix++}`;
      }
      return uniqueKey;
    },
    [inputs],
  );

  const addInput = useCallback(
    (payload?: Partial<Omit<TabInput, "id" | "tabId">>) => {
      if (!tabId) return null;
      const now = new Date().toISOString();
      const nextKey = ensureUniqueKey(
        payload?.key || `input_${inputs.length + 1}`,
      );
      const newInput: TabInput = {
        id: `tab_input_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 9)}`,
        tabId,
        key: nextKey,
        label: payload?.label || DEFAULT_LABEL,
        type: payload?.type || "text",
        value: payload?.value ?? payload?.defaultValue ?? "",
        defaultValue: payload?.defaultValue ?? "",
        placeholder: payload?.placeholder,
        description: payload?.description,
        options: payload?.options,
        order: inputs.length,
        createdAt: now,
        updatedAt: now,
      };
      const nextInputs = [...inputs, newInput];
      void saveInputs(nextInputs);
      return newInput.id;
    },
    [ensureUniqueKey, inputs, saveInputs, tabId],
  );

  const updateInput = useCallback(
    (id: string, updates: Partial<Omit<TabInput, "id" | "tabId">>) => {
      const nextInputs = inputs.map((input) => {
        if (input.id !== id) return input;
        const nextKey =
          updates.key && updates.key !== input.key
            ? ensureUniqueKey(updates.key, id)
            : input.key;
        const nextInput: TabInput = {
          ...input,
          ...updates,
          key: nextKey,
          updatedAt: new Date().toISOString(),
        };
        return nextInput;
      });
      void saveInputs(nextInputs);
    },
    [ensureUniqueKey, inputs, saveInputs],
  );

  const removeInput = useCallback(
    (id: string) => {
      const nextInputs = inputs
        .filter((input) => input.id !== id)
        .map((input, index) => ({ ...input, order: index }));
      void saveInputs(nextInputs);
    },
    [inputs, saveInputs],
  );

  const setInputValue = useCallback(
    (id: string, value: string) => {
      const nextInputs = inputs.map((input) =>
        input.id === id
          ? {
              ...input,
              value,
              updatedAt: new Date().toISOString(),
            }
          : input,
      );
      void saveInputs(nextInputs);
    },
    [inputs, saveInputs],
  );

  const reorderInputs = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const nextInputs = [...inputs];
      const [moved] = nextInputs.splice(fromIndex, 1);
      nextInputs.splice(toIndex, 0, moved);
      const normalized = nextInputs.map((input, index) => ({
        ...input,
        order: index,
      }));
      void saveInputs(normalized);
    },
    [inputs, saveInputs],
  );

  const sortedInputs = useMemo(() => {
    return [...inputs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [inputs]);

  return {
    tabId,
    inputs: sortedInputs,
    isLoaded,
    addInput,
    updateInput,
    removeInput,
    reorderInputs,
    setInputValue,
    refresh: loadInputs,
    saveInputs,
  };
}

