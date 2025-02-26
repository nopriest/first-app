'use client'

import { useState } from 'react'
import { useVMwareStore } from '@/lib/store/vmware'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { open } from '@tauri-apps/api/dialog'
import { Loader2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/tauri'

export default function SettingsPage() {
  const { 
    originalBiosPath, 
    originalVmxPath, 
    setOriginalBiosPath, 
    setOriginalVmxPath,
    vmwarePath,
    setVMwarePath,
  } = useVMwareStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 自动检测 VMware 安装路径
  const detectVMwarePath = async () => {
    try {
      setLoading(true)
      setError(null)
      const path = await invoke<string>('get_vmware_path')
      await invoke('validate_vmware_path', { path }) // 验证路径有效性
      setVMwarePath(path)
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  const selectFile = async (type: 'bios' | 'vmx' | 'vmware') => {
    try {
      setLoading(true)
      setError(null)
      
      if (type === 'vmware') {
        // 选择 VMware 安装目录
        const selected = await open({
          directory: true,
          multiple: false,
          title: '选择 VMware Workstation 安装目录'
        })
        
        if (selected && typeof selected === 'string') {
          try {
            await invoke('validate_vmware_path', { path: selected })
            setVMwarePath(selected)
          } catch (err) {
            setError('无效的 VMware 安装目录')
          }
        }
      } else {
        // 选择文件
        const selected = await open({
          filters: [{
            name: type === 'bios' ? 'Original BIOS ROM' : 'Original VMX Executable',
            extensions: ['original']  // 只显示 .original 后缀的文件
          }],
          multiple: false,
          title: type === 'bios' ? '选择 BIOS.440.ROM.original 文件' : '选择 vmware-vmx.exe.original 文件'
        })
        
        if (selected && typeof selected === 'string') {
          // 验证文件名
          const fileName = selected.toLowerCase();
          if (type === 'bios' && !fileName.endsWith('bios.440.rom.original')) {
            setError('请选择正确的 BIOS.440.ROM.original 文件');
            return;
          }
          if (type === 'vmx' && !fileName.endsWith('vmware-vmx.exe.original')) {
            setError('请选择正确的 vmware-vmx.exe.original 文件');
            return;
          }

          if (type === 'bios') {
            setOriginalBiosPath(selected)
          } else {
            setOriginalVmxPath(selected)
          }
        }
      }
    } catch (err) {
      setError(err as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">设置</h2>
        <p className="text-muted-foreground">
          配置 VMware 安装路径和原始文件路径。
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label>VMware 安装路径</Label>
          <div className="flex gap-2">
            <Input
              value={vmwarePath || ''}
              readOnly
              placeholder="选择 VMware Workstation 安装目录"
            />
            <Button 
              variant="outline" 
              onClick={() => selectFile('vmware')}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '浏览'}
            </Button>
            <Button
              variant="secondary"
              onClick={detectVMwarePath}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '自动检测'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            选择或自动检测 VMware Workstation 的安装目录，通常在 C:\Program Files (x86)\VMware\VMware Workstation
          </p>
        </div>

        <div className="grid gap-2">
          <Label>原始 BIOS ROM 文件</Label>
          <div className="flex gap-2">
            <Input
              value={originalBiosPath || ''}
              readOnly
              placeholder="选择 BIOS.440.ROM.original 文件"
            />
            <Button 
              variant="outline" 
              onClick={() => selectFile('bios')}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '浏览'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            选择备份的原始 BIOS.440.ROM 文件，该文件将作为创建新硬件配置时的模板。
          </p>
        </div>

        <div className="grid gap-2">
          <Label>原始 VMX 可执行文件</Label>
          <div className="flex gap-2">
            <Input
              value={originalVmxPath || ''}
              readOnly
              placeholder="选择 vmware-vmx.exe.original 文件"
            />
            <Button 
              variant="outline" 
              onClick={() => selectFile('vmx')}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '浏览'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            选择备份的原始 vmware-vmx.exe 文件，该文件将作为创建新硬件配置时的模板。
          </p>
        </div>
      </div>
    </div>
  )
} 