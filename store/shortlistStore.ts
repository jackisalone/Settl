import { create } from 'zustand'

interface ShortlistState {
  shortlistedIds: Set<string>
  setShortlistedIds: (ids: string[]) => void
  addToShortlist: (id: string) => void
  removeFromShortlist: (id: string) => void
  isShortlisted: (id: string) => boolean
}

export const useShortlistStore = create<ShortlistState>((set, get) => ({
  shortlistedIds: new Set(),

  setShortlistedIds: (ids) =>
    set({ shortlistedIds: new Set(ids) }),

  addToShortlist: (id) =>
    set((state) => ({ shortlistedIds: new Set([...state.shortlistedIds, id]) })),

  removeFromShortlist: (id) =>
    set((state) => {
      const next = new Set(state.shortlistedIds)
      next.delete(id)
      return { shortlistedIds: next }
    }),

  isShortlisted: (id) => get().shortlistedIds.has(id),
}))
