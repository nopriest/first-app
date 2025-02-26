import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/tauri'
import { arrayMove } from '@dnd-kit/sortable'

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
  vmx_path: string
  created_at: string
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
  setContainers: (containers: Container[]) => void
  addContainers: (containers: Container[]) => void
  reorderContainers: (activeId: string, overId: string) => void
  originalBiosPath: string | null
  originalVmxPath: string | null
  setOriginalBiosPath: (path: string) => void
  setOriginalVmxPath: (path: string) => void
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

  const saveContainersToFile = async (containers: Container[]) => {
    try {
      // 移除空数组检查，因为我们需要保存所有状态变更
      console.log('Current containers before saving:', containers);
      await invoke('save_container_config', { containers });
      console.log('Container save completed');
      
      const savedData = await invoke<Container[]>('load_container_config');
      console.log('Verified saved containers:', savedData);

      if (JSON.stringify(savedData) !== JSON.stringify(containers)) {
        console.log('Container state mismatch detected, updating state');
        set({ containers: savedData });
      }
    } catch (error) {
      console.error('Failed to save container config:', error);
    }
  };

  const saveSettingsToFile = async (settings: { 
    vmwarePath: string | null,
    originalBiosPath: string | null,
    originalVmxPath: string | null
  }) => {
    try {
      await invoke('save_settings_config', { settings });
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return {
    vmwarePath: null,
    hardwares: [],
    containers: [],
    setVMwarePath: (path) => {
      set({ vmwarePath: path });
      saveSettingsToFile({
        vmwarePath: path,
        originalBiosPath: get().originalBiosPath,
        originalVmxPath: get().originalVmxPath
      });
    },
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
      set((state) => {
        const newContainers = [...state.containers, container];
        saveContainersToFile(newContainers);
        return { containers: newContainers };
      }),
    removeContainer: (id) =>
      set((state) => {
        const newContainers = state.containers.filter((c) => c.id !== id);
        saveContainersToFile(newContainers);
        return { containers: newContainers };
      }),
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
        console.log('Loading data from disk...');
        // 加载硬件配置
        const hardwares = await invoke<Hardware[]>('load_hardware_config');
        console.log('Loaded hardwares:', hardwares);
        
        // 加载容器配置
        const containers = await invoke<Container[]>('load_container_config');
        console.log('Loaded containers:', containers);
        
        // 加载设置
        const settings = await invoke<{
          vmwarePath: string | null,
          originalBiosPath: string | null,
          originalVmxPath: string | null
        }>('load_settings_config');
        
        // 更新状态
        set({ 
          hardwares, 
          containers, 
          vmwarePath: settings.vmwarePath,
          originalBiosPath: settings.originalBiosPath,
          originalVmxPath: settings.originalVmxPath
        });
        console.log('State updated with loaded data');
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    },
    saveToDisk: async () => {
      const { hardwares, containers, vmwarePath, originalBiosPath, originalVmxPath } = get();
      console.log('Saving all data to disk...');
      await Promise.all([
        saveToFile(hardwares),
        saveContainersToFile(containers),
        saveSettingsToFile({
          vmwarePath,
          originalBiosPath,
          originalVmxPath
        })
      ]);
    },
    setContainers: (containers) => {
      set({ containers });
      saveContainersToFile(containers);
    },
    addContainers: (newContainers) =>
      set((state) => {
        const containerMap = new Map(
          state.containers.map(c => [c.id, c])
        );
        
        newContainers.forEach(c => {
          containerMap.set(c.id, c);
        });
        
        const mergedContainers = Array.from(containerMap.values());
        saveContainersToFile(mergedContainers);
        return { containers: mergedContainers };
      }),
    reorderContainers: (activeId: string, overId: string) => {
      set((state) => {
        const oldIndex = state.containers.findIndex((c) => c.id === activeId);
        const newIndex = state.containers.findIndex((c) => c.id === overId);
        
        const newContainers = arrayMove(state.containers, oldIndex, newIndex);
        
        // 立即保存新的顺序到文件
        saveContainersToFile(newContainers);
        
        return { containers: newContainers };
      });
    },
    originalBiosPath: null,
    originalVmxPath: null,
    setOriginalBiosPath: (path) => {
      set({ originalBiosPath: path });
      saveSettingsToFile({
        vmwarePath: get().vmwarePath,
        originalBiosPath: path,
        originalVmxPath: get().originalVmxPath
      });
    },
    setOriginalVmxPath: (path) => {
      set({ originalVmxPath: path });
      saveSettingsToFile({
        vmwarePath: get().vmwarePath,
        originalBiosPath: get().originalBiosPath,
        originalVmxPath: path
      });
    },
  }
}) 