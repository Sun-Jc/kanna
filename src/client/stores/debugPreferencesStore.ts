import { create } from "zustand"

const STORAGE_KEY = "kanna-debug-preferences"

interface DebugPreferencesState {
  showScrollDebugOverlay: boolean
  setShowScrollDebugOverlay: (show: boolean) => void
}

function loadPersistedState(): Partial<Pick<DebugPreferencesState, "showScrollDebugOverlay">> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
}

function persistState(state: Pick<DebugPreferencesState, "showScrollDebugOverlay">) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export const useDebugPreferencesStore = create<DebugPreferencesState>()((set) => ({
  showScrollDebugOverlay: loadPersistedState().showScrollDebugOverlay ?? false,
  setShowScrollDebugOverlay: (show) => {
    set({ showScrollDebugOverlay: show })
    persistState({ showScrollDebugOverlay: show })
  },
}))
