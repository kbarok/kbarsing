@echo off
chcp 65001 >nul
title K线会唱歌 - 服务器

cd /d "%~dp0"

echo ========================================
echo   K线会唱歌 生产服务器
echo ========================================
echo.

set PORT=5566
set HOST=0.0.0.0

:: 检查Python
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python
    pause
    exit /b 1
)

:: 安装依赖
echo 检查依赖...
pip install -q -r requirements.txt

:: 检查FFmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo 警告: 未找到 FFmpeg，MP4生成功能将不可用
)

echo.
echo 启动服务器...
echo 访问地址: http://localhost:%PORT%
echo.

:: 启动
python -c "from waitress import serve; import sys; sys.path.insert(0, '.'); from app import app; serve(app, host='%HOST%', port=%PORT%, threads=4)"

pause
