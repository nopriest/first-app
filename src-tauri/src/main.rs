// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono;
use serde::{Deserialize, Serialize};
use serde_json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid;
use winreg::enums::*;
use winreg::RegKey;
use serde_json::Value;
use serde_json::json;

#[derive(Debug, Serialize, Deserialize)]
struct VMXInfo {
    path: String,
    name: String,
    config: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Hardware {
    id: String,
    name: String,
    bios_path: String,
    vmx_path: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Container {
    id: String,
    name: String,
    vmx_path: String,
    created_at: String,
    hardware_id: Option<String>,
}

const CONFIG_FILENAME: &str = "hardware_config.json";
const CONTAINER_CONFIG_FILENAME: &str = "container_config.json";

fn get_config_path() -> PathBuf {
    let mut config_dir = tauri::api::path::config_dir().unwrap_or_default();
    config_dir.push("vmware-manager");
    config_dir.push(CONFIG_FILENAME);
    config_dir
}

fn get_container_config_path() -> PathBuf {
    let mut config_dir = tauri::api::path::config_dir().unwrap_or_default();
    config_dir.push("vmware-manager");
    config_dir.push(CONTAINER_CONFIG_FILENAME);
    config_dir
}

fn get_config_dir() -> Result<PathBuf, String> {
    let mut config_dir = tauri::api::path::config_dir().unwrap_or_default();
    config_dir.push("vmware-manager");
    
    // 确保目录存在
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    Ok(config_dir)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_vmware_path,
            scan_vmx_files,
            scan_hardware_files,
            add_hardware,
            delete_hardware,
            save_hardware_config,
            load_hardware_config,
            add_container,
            save_container_config,
            load_container_config,
            delete_container,
            list_running_vms,
            vm_operation,
            save_settings_config,
            load_settings_config,
            validate_vmware_path,
        ])
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                // 阻止窗口立即关闭
                api.prevent_close();
                
                let window = event.window().clone();
                // 发送保存事件给前端
                window.emit("save-before-close", ()).unwrap();
                
                // 克隆 window 用于闭包
                let window_clone = window.clone();
                // 等待前端回复后再关闭窗口
                window.once("save-completed", move |_| {
                    // 现在可以安全地关闭窗口
                    window_clone.close().unwrap();
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_vmware_path() -> Result<String, String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key = hklm
        .open_subkey("SOFTWARE\\WOW6432Node\\VMware, Inc.\\VMware Workstation")
        .or_else(|_| hklm.open_subkey("SOFTWARE\\VMware, Inc.\\VMware Workstation"))
        .map_err(|e| e.to_string())?;

    let install_path: String = key.get_value("InstallPath").map_err(|e| e.to_string())?;
    
    // 确保路径以反斜杠结尾
    if !install_path.ends_with('\\') {
        return Ok(format!("{}\\", install_path));
    }
    Ok(install_path)
}

#[tauri::command]
async fn scan_vmx_files(path: &str) -> Result<Vec<VMXInfo>, String> {
    let mut vmx_files = Vec::new();

    fn walk_dir(dir: &PathBuf, vmx_files: &mut Vec<VMXInfo>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    walk_dir(&path, vmx_files)?;
                } else if path.extension().and_then(|s| s.to_str()) == Some("vmx") {
                    let path_str = path.to_string_lossy().into_owned();
                    let name = path
                        .file_stem()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    // 读取VMX文件的前几行来获取配置信息
                    let config = fs::read_to_string(&path).ok();

                    vmx_files.push(VMXInfo {
                        path: path_str,
                        name,
                        config,
                    });
                }
            }
        }
        Ok(())
    }

    walk_dir(&PathBuf::from(path), &mut vmx_files).map_err(|e| e.to_string())?;
    Ok(vmx_files)
}

#[tauri::command]
async fn scan_hardware_files(vmware_path: &str) -> Result<Vec<Hardware>, String> {
    let mut hardware_list = Vec::new();

    // 检查BIOS文件夹
    let bios_path = PathBuf::from(vmware_path).join("BIOS.440.ROM");
    // 检查VMX可执行文件 - 修改为 x64 子目录
    let vmx_path = PathBuf::from(vmware_path).join("x64").join("vmware-vmx.exe");

    if bios_path.exists() && vmx_path.exists() {
        hardware_list.push(Hardware {
            id: "default".to_string(),
            name: "默认硬件配置".to_string(),
            bios_path: bios_path.to_string_lossy().into_owned(),
            vmx_path: vmx_path.to_string_lossy().into_owned(),
            created_at: chrono::Local::now().to_rfc3339(),
        });
    }

    Ok(hardware_list)
}

#[tauri::command]
#[allow(non_snake_case)]
async fn add_hardware(name: &str, biosPath: &str, vmxPath: &str) -> Result<Hardware, String> {
    // 验证文件是否存在
    if !PathBuf::from(biosPath).exists() {
        return Err("BIOS文件不存在".to_string());
    }
    if !PathBuf::from(vmxPath).exists() {
        return Err("VMX文件不存在".to_string());
    }

    Ok(Hardware {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        bios_path: biosPath.to_string(),
        vmx_path: vmxPath.to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
async fn delete_hardware(_id: &str) -> Result<(), String> {
    // 这里可以添加额外的验证逻辑
    Ok(())
}

#[tauri::command]
async fn save_hardware_config(hardwares: Vec<Hardware>) -> Result<(), String> {
    // 不允许保存空数组
    if hardwares.is_empty() {
        println!("Attempt to save empty hardware list, ignoring...");
        return Ok(());
    }

    let config_path = get_config_path();
    println!("Saving hardware config to: {:?}", config_path);
    println!("Hardware count to save: {}", hardwares.len());

    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // 保存配置
    let json = serde_json::to_string_pretty(&hardwares).map_err(|e| e.to_string())?;
    println!("Saving config content: {}", json);
    fs::write(&config_path, &json).map_err(|e| e.to_string())?;

    // 验证保存的内容
    let saved_content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let saved_hardwares: Vec<Hardware> =
        serde_json::from_str(&saved_content).map_err(|e| e.to_string())?;
    println!("Verified saved hardware count: {}", saved_hardwares.len());

    Ok(())
}

#[tauri::command]
async fn load_hardware_config() -> Result<Vec<Hardware>, String> {
    let config_path = get_config_path();
    println!("Loading hardware config from: {:?}", config_path);

    if !config_path.exists() {
        println!("Config file does not exist");
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(config_path).map_err(|e| e.to_string())?;
    if content.trim().is_empty() {
        println!("Config file is empty");
        return Ok(Vec::new());
    }

    println!("Loaded config content: {}", content);
    let hardwares = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    Ok(hardwares)
}

#[tauri::command]
async fn add_container(vmx_path: String, name: String) -> Result<Container, String> {
    let container = Container {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        vmx_path,
        created_at: chrono::Local::now().to_rfc3339(),
        hardware_id: None,
    };
    Ok(container)
}

#[tauri::command]
async fn save_container_config(containers: Vec<Container>) -> Result<(), String> {
    let config_path = get_container_config_path();

    // 确保目录存在
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&containers).map_err(|e| e.to_string())?;

    fs::write(&config_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn load_container_config() -> Result<Vec<Container>, String> {
    let config_path = get_container_config_path();
    match fs::read_to_string(&config_path) {
        Ok(content) => serde_json::from_str(&content).map_err(|e| e.to_string()),
        Err(_) => Ok(Vec::new()),
    }
}

#[tauri::command]
async fn delete_container(id: &str) -> Result<(), String> {
    println!("Deleting container with id: {}", id);
    Ok(())
}

#[tauri::command]
async fn list_running_vms() -> Result<Vec<String>, String> {
    let output = Command::new("vmrun")
        .arg("list")
        .output()
        .map_err(|e| e.to_string())?;

    let output_str = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;

    Ok(output_str
        .lines()
        .skip(1) // 跳过标题行
        .map(|s| s.to_string())
        .collect())
}

// 备份和替换 vmware-vmx.exe
async fn replace_vmx_file(vmware_path: &str, custom_vmx_path: &str) -> Result<(), String> {
    println!("VMware path: {}", vmware_path);
    println!("Custom VMX path: {}", custom_vmx_path);

    // 修改为 x64 子目录下的路径
    let vmx_path = PathBuf::from(vmware_path).join("x64").join("vmware-vmx.exe");
    let backup_path = PathBuf::from(vmware_path).join("x64").join("vmware-vmx.exe.backup");

    println!("VMX exe path: {:?}", vmx_path);
    println!("Backup path: {:?}", backup_path);

    // 确保 x64 目录存在
    let x64_dir = PathBuf::from(vmware_path).join("x64");
    if !x64_dir.exists() {
        return Err(format!("x64 directory not found at: {:?}", x64_dir));
    }

    // 验证源文件存在
    if !vmx_path.exists() {
        return Err(format!("VMware-vmx.exe not found at: {:?}", vmx_path));
    }

    // 验证自定义文件存在
    if !Path::new(custom_vmx_path).exists() {
        return Err(format!("Custom VMX file not found at: {}", custom_vmx_path));
    }

    // 如果还没有备份，创建备份
    if !backup_path.exists() {
        println!("Creating backup of vmware-vmx.exe");
        fs::copy(&vmx_path, &backup_path)
            .map_err(|e| format!("Failed to backup vmware-vmx.exe: {} (from {:?} to {:?})", 
                e, vmx_path, backup_path))?;
    }

    // 替换为自定义的 vmx 文件
    println!("Replacing vmware-vmx.exe with custom file");
    fs::copy(custom_vmx_path, &vmx_path)
        .map_err(|e| format!("Failed to replace vmware-vmx.exe: {} (from {} to {:?})", 
            e, custom_vmx_path, vmx_path))?;

    println!("VMX file replacement completed successfully");
    Ok(())
}

// 修改 restore_vmx_file 函数也使用 x64 子目录
async fn restore_vmx_file(vmware_path: &str) -> Result<(), String> {
    println!("Restoring vmware-vmx.exe from backup");
    println!("VMware path: {}", vmware_path);

    // 修改为 x64 子目录下的路径
    let vmx_path = PathBuf::from(vmware_path).join("x64").join("vmware-vmx.exe");
    let backup_path = PathBuf::from(vmware_path).join("x64").join("vmware-vmx.exe.backup");

    println!("VMX exe path: {:?}", vmx_path);
    println!("Backup path: {:?}", backup_path);

    if !backup_path.exists() {
        return Err(format!("Backup file not found at: {:?}", backup_path));
    }

    fs::copy(&backup_path, &vmx_path)
        .map_err(|e| format!("Failed to restore vmware-vmx.exe: {} (from {:?} to {:?})", 
            e, backup_path, vmx_path))?;

    println!("VMX file restoration completed successfully");
    Ok(())
}

// 修改 vm_operation 命令
#[tauri::command]
async fn vm_operation(operation: String, vmx_path: String, hardware_id: Option<String>) -> Result<(), String> {
    // 从配置文件加载 VMware 路径
    let settings = load_settings_config().await?;
    let vmware_path = settings["vmwarePath"]
        .as_str()
        .ok_or("VMware path not configured")?;
    
    // 使用引用来避免移动 hardware_id
    if let Some(ref hardware_id) = hardware_id {
        // 从配置文件加载硬件配置
        let hardwares: Vec<Hardware> = load_hardware_config().await?;
        if let Some(hardware) = hardwares.iter().find(|h| h.id == *hardware_id) {
            // 替换 vmx 文件
            replace_vmx_file(vmware_path, &hardware.vmx_path).await?;
        }
    }

    let mut cmd = Command::new("vmrun");
    match operation.as_str() {
        "start" => {
            cmd.arg("start").arg(&vmx_path).arg("gui");
        }
        "stop" => {
            cmd.arg("stop").arg(&vmx_path).arg("soft");
        }
        "pause" => {
            cmd.arg("pause").arg(&vmx_path);
        }
        "reset" => {
            cmd.arg("reset").arg(&vmx_path).arg("soft");
        }
        _ => return Err("不支持的操作".to_string()),
    }

    cmd.output().map_err(|e| e.to_string())?;

    // 现在可以继续使用 hardware_id，因为之前只是借用而不是移动
    if hardware_id.is_some() {
        restore_vmx_file(vmware_path).await?;
    }

    Ok(())
}

#[tauri::command]
async fn save_settings_config(settings: Value) -> Result<(), String> {
    let config_dir = get_config_dir()?;
    let settings_path = config_dir.join("settings.json");
    
    fs::write(&settings_path, serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn load_settings_config() -> Result<Value, String> {
    let config_dir = get_config_dir()?;
    let settings_path = config_dir.join("settings.json");
    
    if !settings_path.exists() {
        return Ok(json!({
            "vmwarePath": null,
            "originalBiosPath": null,
            "originalVmxPath": null
        }));
    }
    
    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let settings: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    Ok(settings)
}

#[tauri::command]
async fn validate_vmware_path(path: String) -> Result<(), String> {
    let vmrun_path = PathBuf::from(&path).join("vmrun.exe");
    if !vmrun_path.exists() {
        return Err("VMware 安装目录无效：未找到 vmrun.exe".to_string());
    }
    Ok(())
}
