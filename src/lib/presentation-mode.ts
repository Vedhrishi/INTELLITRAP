import { create } from "zustand";
import { persist } from "zustand/middleware";

type PresentationModeState = {
  presentationMode: boolean;
  toggle: () => void;
  set: (value: boolean) => void;
};

export const usePresentationMode = create<PresentationModeState>()(
  persist(
    (set) => ({
      presentationMode: false,
      toggle: () => set((state) => ({ presentationMode: !state.presentationMode })),
      set: (value) => set({ presentationMode: value }),
    }),
    { name: "it_presentation_mode" },
  ),
);
