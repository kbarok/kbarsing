# -*- coding: utf-8 -*-
"""
K线会唱歌 Flask 服务器
- 自动处理 UTF-8 编码
- 支持所有静态文件
- V2 音乐生成 API（集成 stock_music_v2 核心）
"""
import os
import sys
from datetime import datetime, timedelta

# 确保 server 目录在 Python 路径中
_SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

from flask import Flask, send_from_directory, send_file, abort, jsonify, request
from flask_cors import CORS

# 获取 server 目录的父目录（即项目根目录）
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False  # JSON 响应不转义中文
CORS(app)  # 允许跨域

# ==================== V2 核心模块导入 ====================
try:
    import numpy
    import scipy
    from scipy.io import wavfile
    _NUMPY_OK = True
except ImportError:
    _NUMPY_OK = False

try:
    from models.music_generator import AdvancedMusicGenerator
    from models.stock_data import StockDataFetcher
    from config.settings import INSTRUMENTS, RHYTHM_STYLES, SYNTH_PRESETS
    _V2_MODULES_OK = True
    _generator = AdvancedMusicGenerator()
    _fetcher = StockDataFetcher()
except Exception as e:
    _V2_MODULES_OK = False
    _generator = None
    _fetcher = None
    print(f"[V2] 模块导入失败: {e}")


# ==================== 静态文件服务 ====================

@app.route('/<path:filename>')
def serve_static(filename):
    """服务所有静态文件，使用绝对路径（流式响应避免FAT32卡死）"""
    try:
        file_path = os.path.join(BASE_DIR, filename)
        if not os.path.isfile(file_path):
            abort(404)
        abs_path = os.path.abspath(file_path)
        # 流式响应，避免 FAT32 读取大文件卡死
        from werkzeug.wsgi import FileWrapper
        from io import FileIO
        file_obj = FileIO(abs_path, 'rb')
        import mimetypes
        mime = mimetypes.guess_type(abs_path)[0] or 'application/octet-stream'
        # 为文本文件添加 UTF-8 编码
        if mime.startswith('text/') or mime in ('application/json', 'application/javascript'):
            mime = mime + '; charset=utf-8'
        from flask import Response
        return Response(FileWrapper(file_obj), mimetype=mime)
    except Exception as e:
        import traceback
        traceback.print_exc()
        abort(500)


@app.route('/favicon.ico')
def favicon():
    """屏蔽 favicon.ico 请求，避免 500 错误"""
    return ('', 204)

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


# ==================== V2 API 端点 ====================

@app.route('/api/v2/config')
def v2_config():
    """返回 V2 全量配置"""
    if not _V2_MODULES_OK:
        return jsonify({'success': False, 'error': 'V2 模块未正确加载'}), 500
    return jsonify({
        'success': True,
        'instruments': list(INSTRUMENTS.keys()),
        'rhythm_styles': list(RHYTHM_STYLES.keys()),
        'synth_presets': SYNTH_PRESETS,
        'speed_range': {'min': 0.5, 'max': 4.0, 'default': 1.0}
    })


@app.route('/api/v2/kline', methods=['POST'])
def v2_kline():
    """返回 K 线数据（用于前端 Canvas 绘制）"""
    if not _V2_MODULES_OK:
        return jsonify({'success': False, 'error': 'V2 模块未正确加载'}), 500

    data = request.get_json() or {}
    stock_code = data.get('code', '600519.sh')
    # 支持自定义日期范围 or 旧版 days 参数
    start_date = data.get('start_date', '')
    end_date = data.get('end_date', '')
    if not start_date or not end_date:
        days = 150  # 5个月
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    success, df, msg = _fetcher.fetch_data(stock_code, start_date, end_date)
    
    if not success:
        return jsonify({'success': False, 'error': msg}), 400

    # 计算技术指标
    import pandas as pd
    
    # MA5, MA10
    df['ma5'] = df['close'].rolling(window=5).mean()
    df['ma10'] = df['close'].rolling(window=10).mean()
    
    # MACD
    exp12 = df['close'].ewm(span=12, adjust=False).mean()
    exp26 = df['close'].ewm(span=26, adjust=False).mean()
    df['macd'] = exp12 - exp26
    df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
    df['macd_hist'] = df['macd'] - df['macd_signal']

    # KDJ
    n = 9
    low_n = df['low'].rolling(window=n).min()
    high_n = df['high'].rolling(window=n).max()
    rsv = (df['close'] - low_n) / (high_n - low_n + 1e-9) * 100
    k = [50.0]
    d = [50.0]
    for i in range(1, len(rsv)):
        rsv_val = rsv.iloc[i] if not pd.isna(rsv.iloc[i]) else 50.0
        k.append(2/3 * k[-1] + 1/3 * rsv_val)
        d.append(2/3 * d[-1] + 1/3 * k[-1])
    j = [3*k[i] - 2*d[i] for i in range(len(k))]
    df['kdj_k'] = k
    df['kdj_d'] = d
    df['kdj_j'] = j

    # NaN → None（JSON 序列化为 null）
    def _clean(series):
        return [None if (isinstance(v, float) and (v != v)) else v for v in series.tolist()]

    kline_data = {
        'dates': pd.to_datetime(df['date'], errors='coerce').dt.strftime('%Y-%m-%d').tolist(),
        'opens': _clean(df['open']),
        'highs': _clean(df['high']),
        'lows': _clean(df['low']),
        'closes': _clean(df['close']),
        'volumes': _clean(df['volume']),
        'ma5': _clean(df['ma5']),
        'ma10': _clean(df['ma10']),
        'macd': _clean(df['macd']),
        'macd_signal': _clean(df['macd_signal']),
        'macd_hist': _clean(df['macd_hist']),
        'kdj_k': _clean(df['kdj_k']),
        'kdj_d': _clean(df['kdj_d']),
        'kdj_j': _clean(df['kdj_j']),
        'code': stock_code,
        'n_points': len(df)
    }

    return jsonify({
        'success': True,
        'kline': kline_data,
        'message': msg
    })


@app.route('/api/v2/generate', methods=['POST'])
def v2_generate():
    """V2 音乐生成（完整7维度）"""
    if not _V2_MODULES_OK or not _NUMPY_OK:
        return jsonify({'success': False, 'error': 'V2 模块未正确加载（numpy/scipy 缺失）'}), 500

    data = request.get_json() or {}
    stock_code = data.get('code', '600519.sh')
    instrument = data.get('instrument', 'Future_Bass_Lead')
    rhythm_style = data.get('rhythm_style', 'KPop_精准鼓组')
    speed = float(data.get('speed', 1.0))
    # 自定义日期范围（可选，默认取最近5个月）
    start_date = data.get('start_date', '')  # e.g. '2024-05-09'
    end_date = data.get('end_date', '')      # e.g. '2024-11-22'

    if not start_date:
        start_date = (datetime.now() - timedelta(days=150)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    # 1. 获取数据
    success, df, msg = _fetcher.fetch_data(stock_code, start_date, end_date)
    if not success:
        return jsonify({'success': False, 'error': msg}), 400

    # 2. 设置生成器参数
    _generator.set_speed(speed)
    _generator.set_instrument(instrument)

    # 3. 生成音频（使用趋势合成，超级合成已移除）
    try:
        audio_file, duration = _generator.save_trendy_synthesis_file(
            df, instrument, rhythm_style
        )

        # 4. 移动到 server/static/audio/ 目录
        import shutil
        import uuid
        static_dir = os.path.join(_SERVER_DIR, 'static', 'audio')
        os.makedirs(static_dir, exist_ok=True)
        safe_inst = instrument.replace('/', '_').replace(' ', '_')
        safe_rhythm = rhythm_style.replace('/', '_').replace(' ', '_')
        filename = f"v2_{uuid.uuid4().hex[:8]}_{safe_inst}_{safe_rhythm}.wav"
        dest = os.path.join(static_dir, filename)
        shutil.copy2(audio_file, dest)

        return jsonify({
            'success': True,
            'audio_url': f'/static/audio/{filename}',
            'duration': duration,
            'instrument': instrument,
            'rhythm_style': rhythm_style,
            'speed': speed,
            'data_points': len(df),
            'data_source': msg
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/v2/test')
def v2_test():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'numpy': _NUMPY_OK,
        'v2_modules': _V2_MODULES_OK,
        'server_dir': _SERVER_DIR,
        'time': datetime.now().isoformat()
    })


# ==================== 下载/转码 API ====================

import subprocess
import tempfile

AUDIO_DIR = os.path.join(_SERVER_DIR, 'static', 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)


@app.route('/download/<filename>')
def download_wav(filename):
    """下载 WAV 文件"""
    return send_from_directory(AUDIO_DIR, filename, as_attachment=True)


@app.route('/api/v2/to_mp3', methods=['POST'])
def convert_to_mp3():
    """将 WAV 转换为 MP3"""
    data = request.get_json() or {}
    audio_url = data.get('audio_url', '')

    if not audio_url:
        return jsonify({'success': False, 'error': '缺少音频 URL'}), 400

    # 解析 WAV 文件路径
    if audio_url.startswith('/static/audio/'):
        wav_filename = audio_url.replace('/static/audio/', '')
        wav_path = os.path.join(AUDIO_DIR, wav_filename)
    else:
        return jsonify({'success': False, 'error': '无效的音频路径'}), 400

    if not os.path.exists(wav_path):
        return jsonify({'success': False, 'error': '音频文件不存在'}), 404

    # 生成 MP3 文件名
    mp3_filename = wav_filename.replace('.wav', '.mp3')
    mp3_path = os.path.join(AUDIO_DIR, mp3_filename)

    # 使用 FFmpeg 转码
    try:
        cmd = ['ffmpeg', '-y', '-i', wav_path, '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            return jsonify({'success': False, 'error': 'FFmpeg 转码失败'}), 500

        mp3_url = f'/static/audio/{mp3_filename}'
        return jsonify({
            'success': True,
            'mp3_url': mp3_url,
            'mp3_size': os.path.getsize(mp3_path)
        })
    except FileNotFoundError:
        return jsonify({'success': False, 'error': 'FFmpeg 未安装'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/v2/to_mp4', methods=['POST'])
def convert_to_mp4():
    """生成 MP4 视频（K线可视化 + 音频）"""
    data = request.get_json() or {}
    audio_url = data.get('audio_url', '')
    stock_code = data.get('code', 'demo')

    if not audio_url:
        return jsonify({'success': False, 'error': '缺少音频 URL'}), 400

    # 解析 WAV 文件路径
    if audio_url.startswith('/static/audio/'):
        wav_filename = audio_url.replace('/static/audio/', '')
        wav_path = os.path.join(AUDIO_DIR, wav_filename)
    else:
        return jsonify({'success': False, 'error': '无效的音频路径'}), 400

    if not os.path.exists(wav_path):
        return jsonify({'success': False, 'error': '音频文件不存在'}), 404

    # 生成 MP4 文件名
    mp4_filename = f"kbarok_{stock_code}.mp4"
    mp4_path = os.path.join(AUDIO_DIR, mp4_filename)

    # 方案1：纯音频 MP4（使用简单视频流）
    # 方案2：使用图片作为背景 + 音频
    try:
        # 创建黑色背景图片
        bg_image = os.path.join(AUDIO_DIR, 'bg.png')
        if not os.path.exists(bg_image):
            # 用 Python PIL 生成黑色背景
            try:
                from PIL import Image
                img = Image.new('RGB', (1280, 720), color=(10, 10, 20))
                # 添加标题文字
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(img)
                try:
                    font = ImageFont.truetype("arial.ttf", 60)
                except:
                    font = ImageFont.load_default()
                draw.text((640, 360), f"🎵 {stock_code}", fill=(255, 255, 255), anchor="mm", font=font)
                img.save(bg_image)
            except ImportError:
                # 如果没有 PIL，创建空文件占位
                open(bg_image, 'w').close()

        # 使用 FFmpeg 生成 MP4：黑色背景 + 音频
        cmd = [
            'ffmpeg', '-y',
            '-loop', '1', '-i', bg_image,
            '-i', wav_path,
            '-c:v', 'libx264', '-tune', 'stillimage',
            '-c:a', 'aac', '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            mp4_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            # 如果失败，尝试纯音频方案
            cmd = [
                'ffmpeg', '-y',
                '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:d=60',
                '-i', wav_path,
                '-c:v', 'libx264', '-c:a', 'aac',
                '-shortest',
                mp4_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if result.returncode != 0:
            return jsonify({'success': False, 'error': f'FFmpeg 生成失败: {result.stderr[:200]}'}), 500

        mp4_url = f'/static/audio/{mp4_filename}'
        return jsonify({
            'success': True,
            'mp4_url': mp4_url,
            'mp4_size': os.path.getsize(mp4_path)
        })
    except FileNotFoundError:
        return jsonify({'success': False, 'error': 'FFmpeg 未安装'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print(f"K线会唱歌 服务器启动")
    print(f"静态文件目录: {BASE_DIR}")
    print(f"V2 模块: {'已加载' if _V2_MODULES_OK else '未加载'}")
    print(f"NumPy/SciPy: {'已加载' if _NUMPY_OK else '未加载'}")
    print(f"访问地址: http://127.0.0.1:5566")
    print(f"局域网访问: http://0.0.0.0:5566")
    app.run(host='0.0.0.0', port=5566, debug=False, threaded=True, use_reloader=False)
