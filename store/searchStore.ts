import { create } from 'zustand'

export type RoomType = 'single' | 'double' | 'triple'

export const FILTER_AMENITIES = [
  'WiFi',
  'Food',
  'AC',
  'Attached Bath',
  'Laundry',
  'Parking',
] as const

export type FilterAmenity = (typeof FILTER_AMENITIES)[number]

interface SearchState {
  query: string
  minRent: string        // string so TextInput stays controlled
  maxRent: string
  roomTypes: RoomType[]
  amenities: FilterAmenity[]
  city: string

  setQuery: (q: string) => void
  setMinRent: (v: string) => void
  setMaxRent: (v: string) => void
  toggleRoomType: (rt: RoomType) => void
  toggleAmenity: (a: FilterAmenity) => void
  setCity: (c: string) => void
  resetFilters: () => void

  // Derived
  hasActiveFilters: () => boolean
}

const DEFAULT: Pick<SearchState, 'minRent' | 'maxRent' | 'roomTypes' | 'amenities' | 'city'> = {
  minRent: '',
  maxRent: '',
  roomTypes: [],
  amenities: [],
  city: 'All',
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  ...DEFAULT,

  setQuery: (query) => set({ query }),
  setMinRent: (minRent) => set({ minRent }),
  setMaxRent: (maxRent) => set({ maxRent }),
  setCity: (city) => set({ city }),

  toggleRoomType: (rt) =>
    set((state) => ({
      roomTypes: state.roomTypes.includes(rt)
        ? state.roomTypes.filter((r) => r !== rt)
        : [...state.roomTypes, rt],
    })),

  toggleAmenity: (a) =>
    set((state) => ({
      amenities: state.amenities.includes(a)
        ? state.amenities.filter((x) => x !== a)
        : [...state.amenities, a],
    })),

  resetFilters: () => set({ ...DEFAULT }),

  hasActiveFilters: () => {
    const { minRent, maxRent, roomTypes, amenities, city } = get()
    return !!(
      minRent ||
      maxRent ||
      roomTypes.length > 0 ||
      amenities.length > 0 ||
      city !== 'All'
    )
  },
}))
