//! 命令模块共享辅助函数

use crate::utils;
use serde_json::Value;
use std::time::Duration;
use tauri::AppHandle;
use tokio::time::timeout;

#[cfg(target_os = "windows")]
use super::CREATE_NO_WINDOW;

/// 默认 HTTP 请求超时时间（5 分钟）
const HTTP_TIMEOUT: Duration = Duration::from_secs(300);

/// yt-dlp 进程超时时间（10 分钟）
const YTDLP_TIMEOUT: Duration = Duration::from_secs(600);

/// 向参数列表追加 Cookie 和代理相关参数
pub fn append_cookie_proxy_args(
    args: &mut Vec<String>,
    cookie_file: Option<&str>,
    cookie_browser: Option<&str>,
    proxy: Option<&str>,
) {
    if let Some(cf) = cookie_file {
        if !cf.is_empty() {
            args.push("--cookies".to_string());
            args.push(cf.to_string());
        }
    }
    if let Some(browser) = cookie_browser {
        if !browser.is_empty() {
            args.push("--cookies-from-browser".to_string());
            args.push(browser.to_string());
        }
    }
    if let Some(p) = proxy {
        if !p.is_empty() {
            args.push("--proxy".to_string());
            args.push(p.to_string());
        }
    }
}

/// 构建带可选代理和超时的 HTTP 客户端
pub fn build_http_client(proxy: Option<&str>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder().timeout(HTTP_TIMEOUT);
    if let Some(p) = proxy {
        if !p.is_empty() {
            let reqwest_proxy =
                reqwest::Proxy::all(p).map_err(|e| format!("err_proxy_config:{}", e))?;
            builder = builder.proxy(reqwest_proxy);
        }
    }
    builder
        .build()
        .map_err(|e| format!("err_create_http_client:{}", e))
}

/// 运行 yt-dlp -J 并解析 JSON 输出（用于获取视频信息、封面列表、字幕列表等）
pub async fn run_ytdlp_json(
    app: &AppHandle,
    url: &str,
    extra_args: &[&str],
    cookie_file: Option<&str>,
    cookie_browser: Option<&str>,
    proxy: Option<&str>,
) -> Result<Value, String> {
    let ytdlp_path = utils::get_ytdlp_path(app)?;
    if !ytdlp_path.exists() {
        return Err("err_ytdlp_not_installed".to_string());
    }

    let mut args = vec![
        "-J".to_string(),
        "--ignore-config".to_string(),
        "--color".to_string(),
        "never".to_string(),
    ];
    
    // 检测是否为播放列表 URL，添加 --flat-playlist 以快速解析播放列表
    // 避免逐个获取每个视频的格式信息（这会导致极其缓慢的解析）
    if is_likely_playlist_url(url) && !extra_args.iter().any(|arg| arg.contains("--no-playlist")) {
        if !extra_args
            .iter()
            .any(|arg| arg.contains("--flat-playlist") || arg.contains("--extract-flat"))
        {
            args.push("--flat-playlist".to_string());
        }
    }
    
    for a in extra_args {
        args.push(a.to_string());
    }
    args.extend(utils::build_js_runtime_args(app));
    args.extend(utils::build_plugin_args(app));
    append_cookie_proxy_args(&mut args, cookie_file, cookie_browser, proxy);
    args.push(url.to_string());

    let mut cmd = tokio::process::Command::new(&ytdlp_path);
    cmd.args(&args)
        .env("PYTHONUTF8", "1")
        .env("PYTHONIOENCODING", "utf-8");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut output = match timeout(YTDLP_TIMEOUT, cmd.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => return Err(format!("err_run_ytdlp:{}", e)),
        Err(_) => return Err("err_ytdlp_timeout: 获取视频信息超时（可能是网络问题或播放列表过大）".to_string()),
    };

    let mut stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let mut stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    // 如果 yt-dlp 报错不支持 --flat-playlist / --extract-flat，则重试一次（兼容旧版本或 youtube-dl）
    if (stderr.contains("no such option") || stderr.contains("unknown option"))
        && args.iter().any(|a| a.contains("--flat-playlist") || a.contains("--extract-flat"))
    {
        let no_flat_args: Vec<String> = args
            .into_iter()
            .filter(|a| !a.contains("--flat-playlist") && !a.contains("--extract-flat"))
            .collect();

        let mut cmd = tokio::process::Command::new(&ytdlp_path);
        cmd.args(&no_flat_args)
            .env("PYTHONUTF8", "1")
            .env("PYTHONIOENCODING", "utf-8");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        output = match timeout(YTDLP_TIMEOUT, cmd.output()).await {
            Ok(Ok(output)) => output,
            Ok(Err(e)) => return Err(format!("err_run_ytdlp:{}", e)),
            Err(_) => return Err("err_ytdlp_timeout: 获取视频信息超时（可能是网络问题或播放列表过大）".to_string()),
        };

        stdout = String::from_utf8_lossy(&output.stdout).into_owned();
        stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    }

    // 优先从 stdout 解析 JSON（yt-dlp 可能在 stderr 输出警告但仍成功）
    if let Some(json_str) = stdout
        .lines()
        .find(|line| line.trim_start().starts_with('{'))
    {
        return serde_json::from_str(json_str)
            .map_err(|e| format!("err_parse_video_info:{}", e));
    }

    // 未找到 JSON，从 stderr 提取 ERROR 行作为错误信息
    Err(extract_ytdlp_error(&stderr))
}

/// 从 yt-dlp stderr 输出中提取错误信息
pub fn extract_ytdlp_error(stderr: &str) -> String {
    let error_lines: Vec<&str> = stderr.lines().filter(|l| l.contains("ERROR:")).collect();
    if error_lines.is_empty() {
        stderr.trim().to_string()
    } else {
        error_lines.join("\n")
    }
}

/// 检测 URL 是否可能是播放列表
fn is_likely_playlist_url(url: &str) -> bool {
    let url_lower = url.to_lowercase();
    url_lower.contains("playlist?list=") 
        || url_lower.contains("playlist/")
        || url_lower.contains("channel/")
        || url_lower.contains("c/")
        || url_lower.contains("@") // YouTube 频道
        || url_lower.contains("/channel/")
        || url_lower.contains("/user/")
        || url_lower.contains("list=")
        || url_lower.contains("album/")
        || url_lower.contains("albums/")
}

/// 验证文件路径安全性（防止路径遍历攻击）
/// 确保解析后的路径位于 base_dir 之下
pub fn validate_path_within(base_dir: &std::path::Path, relative_path: &str) -> Result<std::path::PathBuf, String> {
    let target = base_dir.join(relative_path);
    // 标准化路径，消除 .. 等相对路径组件
    let canonical_base = base_dir
        .canonicalize()
        .map_err(|e| format!("err_resolve_path:{}", e))?;
    // 对于可能不存在的路径，检查其父目录
    let target_for_check = if target.exists() {
        target
            .canonicalize()
            .map_err(|e| format!("err_resolve_path:{}", e))?
    } else {
        // 如果目标不存在，检查其父目录是否在基础目录内
        let parent = target.parent().ok_or("err_invalid_path")?;
        if !parent.exists() {
            // 如果父目录也不存在，至少检查路径组件中没有 ..
            if relative_path.contains("..") {
                return Err("err_path_traversal".to_string());
            }
            return Ok(base_dir.join(relative_path));
        }
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("err_resolve_path:{}", e))?;
        if !canonical_parent.starts_with(&canonical_base) {
            return Err("err_path_traversal".to_string());
        }
        return Ok(base_dir.join(relative_path));
    };
    if !target_for_check.starts_with(&canonical_base) {
        return Err("err_path_traversal".to_string());
    }
    Ok(target_for_check)
}
