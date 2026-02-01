import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LocationState {
  selectedLocationId: string | 'all' | null;
  setSelectedLocationId: (locationId: string | 'all' | null) => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      selectedLocationId: 'all',
      setSelectedLocationId: (locationId) => set({ selectedLocationId: locationId }),
    }),
    {
      name: 'location-storage',
    }
  )
);
