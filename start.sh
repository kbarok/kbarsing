#!/bin/bash
# K线会唱歌 - 生产环境启动脚本
# 用法: ./start.sh [port]

PORT=${1:-5566}
HOST=${2:-0.0.0.0}

cd "$(dirname "$0")"

echo "================================"
echo "  K线会唱歌 生产服务器"
echo "================================"
echo ""

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3"
    exit 1
fi

# 检查虚拟环境
if [ -d "venv" ]; then
    echo "激活虚拟环境..."
    source venv/bin/activate
fi

# 安装依赖
echo "检查依赖..."
pip install -q -r requirements.txt

# 检查FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "警告: 未找到 FFmpeg，MP4生成功能将不可用"
    echo "安装: sudo apt-get install ffmpeg"
fi

echo ""
echo "启动服务器..."
echo "访问地址: http://localhost:$PORT"
echo ""

# 使用waitress (Windows/Linux兼容)
python3 -c "
from waitress import serve
import sys
sys.path.insert(0, '.')
from app import app
serve(app, host='$HOST', port=$PORT, threads=4)
" 2>&1 | tee -a logs/server.log
