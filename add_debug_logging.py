#!/usr/bin/env python3
"""
Add diagnostic logging to trace download status update flow.
"""

import re

def add_logging_to_download_store():
    """Add logging to src/stores/download.ts"""
    with open('src/stores/download.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add logging at the beginning of setupListeners
    old_setup = '''  const setupListeners = async () => {
    if (!isTauri) return;
    if (listenersSetup) return;'''
    
    new_setup = '''  const setupListeners = async () => {
    console.log('[DownloadStore] setupListeners called');
    if (!isTauri) {
      console.warn('[DownloadStore] Not running in Tauri environment');
      return;
    }
    if (listenersSetup) {
      console.log('[DownloadStore] Listeners already setup');
      return;
    }'''
    
    content = content.replace(old_setup, new_setup)
    
    # Add logging to progress event handler
    old_progress = '''        await listen<ProgressPayload>("download-progress", (event) => {
          const task = tasks.value.find((t) => t.id === event.payload.id);
          if (task && task.status === "downloading") {
            task.percent = event.payload.percent;
            task.speed = event.payload.speed;
            task.eta = event.payload.eta;
            if (event.payload.downloaded) task.downloaded = event.payload.downloaded;
            if (event.payload.total) task.total = event.payload.total;
          }
          updateTaskbarProgress();
        });'''
    
    new_progress = '''        await listen<ProgressPayload>("download-progress", (event) => {
          console.log('[DownloadStore] Progress event received:', event.payload);
          const task = tasks.value.find((t) => t.id === event.payload.id);
          console.log('[DownloadStore] Task found:', !!task, task ? task.status : 'N/A');
          if (task && task.status === "downloading") {
            console.log('[DownloadStore] Updating task progress');
            task.percent = event.payload.percent;
            task.speed = event.payload.speed;
            task.eta = event.payload.eta;
            if (event.payload.downloaded) task.downloaded = event.payload.downloaded;
            if (event.payload.total) task.total = event.payload.total;
            console.log('[DownloadStore] Task updated:', task.id, task.percent + '%');
          } else {
            console.warn('[DownloadStore] Task not found or not downloading');
          }
          updateTaskbarProgress();
        });'''
    
    content = content.replace(old_progress, new_progress)
    
    # Add logging to complete event handler
    old_complete = '''        await listen<{ id: string; outputFile: string }>("download-complete", (event) => {
          const task = tasks.value.find((t) => t.id === event.payload.id);
          if (task) {
            task.status = "completed";
            task.percent = 100;
            task.speed = "";
            if (event.payload.outputFile) task.outputFile = event.payload.outputFile;
            notify(
              i18n.global.t("downloads.notifyComplete"),
              task.title || i18n.global.t("downloads.notifyCompleteBody"),
            );
          }
          updateTaskbarProgress();
          tryStartNext();
        });'''
    
    new_complete = '''        await listen<{ id: string; outputFile: string }>("download-complete", (event) => {
          console.log('[DownloadStore] Complete event received:', event.payload);
          const task = tasks.value.find((t) => t.id === event.payload.id);
          console.log('[DownloadStore] Task found for completion:', !!task);
          if (task) {
            console.log('[DownloadStore] Setting task to completed');
            task.status = "completed";
            task.percent = 100;
            task.speed = "";
            if (event.payload.outputFile) task.outputFile = event.payload.outputFile;
            notify(
              i18n.global.t("downloads.notifyComplete"),
              task.title || i18n.global.t("downloads.notifyCompleteBody"),
            );
            console.log('[DownloadStore] Task completed:', task.id);
          }
          updateTaskbarProgress();
          tryStartNext();
        });'''
    
    content = content.replace(old_complete, new_complete)
    
    with open('src/stores/download.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Added logging to download store")

def add_logging_to_rust_backend():
    """Add logging to src-tauri/src/commands/download.rs"""
    with open('src-tauri/src/commands/download.rs', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add logging at the start of process_output_line
    old_func_start = '''fn process_output_line(
    app: &AppHandle,
    task_id: &str,
    processes: &Arc<Mutex<HashMap<String, DownloadProcessInfo>>>,
    line: &str,
) {
    // 解析 --progress-template 输出的 JSON 进度
    if let Some(info) = parser::parse_progress_json(line) {'''
    
    new_func_start = '''fn process_output_line(
    app: &AppHandle,
    task_id: &str,
    processes: &Arc<Mutex<HashMap<String, DownloadProcessInfo>>>,
    line: &str,
) {
    println!("[DEBUG] process_output_line for task {}: {}", task_id, line);
    // 解析 --progress-template 输出的 JSON 进度
    if let Some(info) = parser::parse_progress_json(line) {
        println!("[DEBUG] Parsed progress JSON for task {}: {}%", task_id, info.percent);'''
    
    content = content.replace(old_func_start, new_func_start)
    
    # Add logging to download-complete emission
    old_complete = '''        if success || has_output {
            let _ = app.emit(
                "download-complete",
                serde_json::json!({ "id": task_id, "outputFile": output_file }),
            );
        }'''
    
    new_complete = '''        println!("[DEBUG] Download finished for task {}: success={}, has_output={}, output_file={:?}", task_id, success, has_output, output_file);
        if success || has_output {
            println!("[DEBUG] Emitting download-complete event for task {}", task_id);
            let _ = app.emit(
                "download-complete",
                serde_json::json!({ "id": task_id, "outputFile": output_file }),
            );
        }'''
    
    content = content.replace(old_complete, new_complete)
    
    # Add logging to download-error emission
    old_error = '''        } else if !was_cancelled {
            let error_msg = status
                .as_ref()
                .map(|s| format!("err_exit_code:{}", s.code().unwrap_or(-1)))
                .unwrap_or_else(|e| e.to_string());
            let _ = app.emit(
                "download-error",
                serde_json::json!({
                    "id": task_id,
                    "error": error_msg,
                }),
            );
        }'''
    
    new_error = '''        } else if !was_cancelled {
            let error_msg = status
                .as_ref()
                .map(|s| format!("err_exit_code:{}", s.code().unwrap_or(-1)))
                .unwrap_or_else(|e| e.to_string());
            println!("[DEBUG] Emitting download-error event for task {}: {}", task_id, error_msg);
            let _ = app.emit(
                "download-error",
                serde_json::json!({
                    "id": task_id,
                    "error": error_msg,
                }),
            );
        }'''
    
    content = content.replace(old_error, new_error)
    
    with open('src-tauri/src/commands/download.rs', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Added logging to Rust backend")

if __name__ == '__main__':
    add_logging_to_download_store()
    add_logging_to_rust_backend()
    print("\n✓ Diagnostic logging added successfully!")
    print("  - Frontend: src/stores/download.ts")
    print("  - Backend: src-tauri/src/commands/download.rs")
    print("\nTo see logs:")
    print("  - Frontend: Open browser console (DevTools) when running in dev mode")
    print("  - Backend: Check terminal output where 'pnpm tauri dev' is running")
