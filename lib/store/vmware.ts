import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/tauri'
import { debounce } from '@/lib/utils/debounce'
import { listen } from '@tauri-apps/api/event'

interface Hardware {
  id: string
  name: string
  bios_path: string
  vmx_path: string
  created_at: string
}

interface Container {
  id: string
  name: string
  vmxPath: string
  hardwareId: string | null
}

interface VMwareStore {
  vmwarePath: string | null
  hardwares: Hardware[]
  containers: Container[]
  setVMwarePath: (path: string) => void
  addHardware: (hardware: Hardware) => void
  removeHardware: (id: string) => void
  addContainer: (container: Container) => void
  removeContainer: (id: string) => void
  updateContainer: (id: string, updates: Partial<Container>) => void
  setHardwares: (hardwares: Hardware[]) => void
  addHardwares: (hardwares: Hardware[]) => void
  loadFromDisk: () => Promise<void>
  saveToDisk: () => Promise<void>
}

export const useVMwareStore = create<VMwareStore>()((set, get) => {
  const saveToFile = async (hardwares: Hardware[]) => {
    try {
      // 不允许保存空数组
      if (hardwares.length === 0) {
        console.log('Attempt to save empty hardware list, skipping...');
        return;
      }

      console.log('Current state before saving:', hardwares);
      await invoke('save_hardware_config', { hardwares });
      console.log('Save completed, verifying saved data...');
      
      // 验证保存的数据
      const savedData = await invoke<Hardware[]>('load_hardware_config');
      console.log('Verified saved data:', savedData);

      // 确保状态与保存的数据一致
      if (JSON.stringify(savedData) !== JSON.stringify(hardwares)) {
        console.log('State mismatch detected, updating state with saved data');
        set({ hardwares: savedData });
      }
    } catch (error) {
      console.error('Failed to save hardware config:', error);
    }
  };

  return {
    vmwarePath: null,
    hardwares: [],
    containers: [],
    setVMwarePath: (path) => set({ vmwarePath: path }),
    addHardware: (hardware) =>
      set((state) => {
        const newHardwares = [...state.hardwares, hardware];
        console.log('Adding hardware, new state will be:', newHardwares);
        
        // 立即保存并等待完成
        saveToFile(newHardwares);
        return { hardwares: newHardwares };
      }),
    removeHardware: (id) =>
      set((state) => {
        const newHardwares = state.hardwares.filter((h) => h.id !== id);
        console.log('Removing hardware, new state will be:', newHardwares);
        
        // 立即保存并等待完成
        saveToFile(newHardwares);
        return { hardwares: newHardwares };
      }),
    addContainer: (container) =>
      set((state) => ({ containers: [...state.containers, container] })),
    removeContainer: (id) =>
      set((state) => ({
        containers: state.containers.filter((c) => c.id !== id),
      })),
    updateContainer: (id, updates) =>
      set((state) => ({
        containers: state.containers.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),
    setHardwares: (hardwares) => {
      console.log('Setting hardwares:', hardwares);
      set({ hardwares });
      // 确保异步保存完成
      (async () => {
        await saveToFile(hardwares);
      })();
    },
    addHardwares: (newHardwares) =>
      set((state) => {
        // 使用 Map 来合并和去重
        const hardwareMap = new Map(
          state.hardwares.map(h => [h.id, h])
        );
        
        // 添加新的硬件
        newHardwares.forEach(h => {
          hardwareMap.set(h.id, h);
        });
        
        const mergedHardwares = Array.from(hardwareMap.values());
        console.log('Merging hardwares, new state will be:', mergedHardwares);

        // 立即保存并等待完成
        saveToFile(mergedHardwares);
        return { hardwares: mergedHardwares };
      }),
    loadFromDisk: async () => {
      try {
        console.log('Loading hardwares from disk...');
        const hardwares = await invoke<Hardware[]>('load_hardware_config');
        console.log('Loaded hardwares:', hardwares);
        set({ hardwares });
        console.log('State updated with loaded hardwares');
      } catch (error) {
        console.error('Failed to load hardware config:', error);
      }
    },
    saveToDisk: async () => {
      const { hardwares } = get();
      console.log('Saving to disk, current state:', hardwares);
      await saveToFile(hardwares);
    }
  }
}) 