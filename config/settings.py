"""
配置文件 - 集中管理所有常量和配置
【潮流终极版】合成1~合成8 全潮流音色 + 多风格鼓点节奏库
"""

# ==================== 字体配置 ====================
FONT_CONFIG = {
    'family': '微软雅黑',
    'fallback': ['Arial', 'Tahoma', 'DejaVu Sans'],
}

def get_font(size=10, weight='normal'):
    import tkinter as tk
    try:
        return (FONT_CONFIG['family'], size, weight)
    except:
        return (FONT_CONFIG['fallback'][0], size, weight)

# ==================== 音乐参数 ====================
MUSIC_CONFIG = {
    'sample_rate': 48000,
    'base_interval': 0.5,
    'pitch_range': 36,
    'velocity_min': 35,
    'velocity_max': 115,
    'default_speed': 1.0,
    'min_speed': 0.5,
    'max_speed': 5.0,
    'master_quality': 'high',
    'stereo_width': 0.9,
    'dynamic_range': 'open',
}

# ==================== UI 参数 ====================
UI_CONFIG = {
    'window_width': 900,
    'window_height': 1200,
    'chart_dpi': 100,
    'font_family': '微软雅黑',
    'font_size_title': 18,
    'font_size_normal': 10,
    'font_size_small': 8,
}

# ==================== 颜色配置 ====================
COLORS = {
    'bg': '#2c3e50',
    'fg': '#ecf0f1',
    'up': '#e74c3c',
    'down': '#2ecc71',
    'volume_up': '#e67e22',
    'volume_down': '#3498db',
    'ma5': '#f1c40f',
    'ma10': '#1abc9c',
    'macd': '#e74c3c',
    'macd_signal': '#3498db',
    'title_bg': '#1a2c3e',
    'title_fg': '#f39c12',
    'button_primary': '#3498db',
    'button_success': '#2ecc71',
    'button_warning': '#f1c40f',
    'button_danger': '#e74c3c',
    'button_info': '#1abc9c',
    'chart_bg': '#1e2a36',
    'chart_grid': '#34495e',
}

# ==================== 🔥 合成1 ~ 合成8（直接对应界面选择） ====================
SYNTH_PRESETS = {
    "合成1_Future_Bass": "Future_Bass_Lead",
    "合成2_KPop_Lead": "KPop_Synth_Lead",
    "合成3_Synthwave_复古": "Synthwave_Juno",
    "合成4_Amapiano_非洲底鼓": "Amapiano_Log_Drum",
    "合成5_DnB_电子贝斯": "DnB_Bass",
    "合成6_史诗垫音": "Retro_Pad",
    "合成7_KPop双低音": "KPop_Double_Bass",
    "合成8_空灵人声垫": "KPop_Vocal_Pad",
}

# ==================== 🔥 超级节奏库（解决节奏单一！） ====================
RHYTHM_STYLES = {
    # 基础4拍
    "标准4拍": {
        "kick_pattern": [1,0,0,0, 1,0,0,0],
        "snare_pattern": [0,0,1,0, 0,0,1,0],
        "hihat_pattern": [0,1,0,1, 0,1,0,1],
        "perc_pattern": [0,0,0,0, 0,0,0,0],
    },
    # K-POP 精准节奏
    "KPop_精准鼓组": {
        "kick_pattern": [1,0,0,1, 1,0,0,1],
        "snare_pattern": [0,0,1,0, 0,0,1,1],
        "hihat_pattern": [0,1,1,1, 0,1,1,1],
        "perc_pattern": [0,1,0,1, 1,0,1,0],
    },
    # Amapiano 非洲律动
    "Amapiano_非洲节奏": {
        "kick_pattern": [1,0,1,0, 0,1,0,1],
        "snare_pattern": [0,0,1,0, 0,1,0,0],
        "hihat_pattern": [1,1,1,1, 1,1,1,1],
        "perc_pattern": [1,0,1,0, 1,0,1,0],
    },
    # Synthwave 复古迪斯科
    "Synthwave_复古迪斯科": {
        "kick_pattern": [1,0,0,0, 1,0,1,0],
        "snare_pattern": [0,0,1,0, 0,0,1,0],
        "hihat_pattern": [0,1,1,1, 0,1,1,1],
        "perc_pattern": [0,0,1,0, 0,0,1,0],
    },
    # Drum & Bass 快节奏碎拍
    "DnB_快节奏碎拍": {
        "kick_pattern": [1,0,0,1, 0,1,0,1],
        "snare_pattern": [0,0,1,0, 1,0,0,1],
        "hihat_pattern": [1,1,1,1, 1,1,1,1],
        "perc_pattern": [1,1,1,1, 1,1,1,1],
    },
    # Afrobeats 世界风
    "Afrobeats_世界风": {
        "kick_pattern": [1,0,1,0, 1,0,0,1],
        "snare_pattern": [0,0,1,0, 0,1,0,0],
        "hihat_pattern": [1,1,0,1, 1,1,0,1],
        "perc_pattern": [1,0,1,1, 1,0,1,1],
    },
    # 极简留白节奏（2025主流）
    "极简留白_缓拍": {
        "kick_pattern": [1,0,0,0, 0,0,1,0],
        "snare_pattern": [0,0,0,0, 0,0,1,0],
        "hihat_pattern": [0,1,0,1, 0,0,0,1],
        "perc_pattern": [0,0,0,0, 0,1,0,0],
    },
    # 史诗电影感
    "史诗电影_慢板": {
        "kick_pattern": [1,0,0,0, 0,0,0,0],
        "snare_pattern": [0,0,0,0, 1,0,0,0],
        "hihat_pattern": [0,0,1,0, 0,0,1,0],
        "perc_pattern": [0,0,0,0, 0,0,0,0],
    },
}

# ==================== 🔥 完整潮流乐器库 ====================
INSTRUMENTS = {
    # === Future Bass 湿音色 ===
    "Future_Bass_Lead": {
        "waveform": "saw",
        "harmonics": [1,2,3,4,5],
        "adsr": {"attack":0.03, "decay":0.2, "sustain":0.85, "release":0.7},
        "filter": {"type":"lowpass", "cutoff":3600, "resonance":0.6},
        "chorus": 1.0, "reverb":1.0, "delay":0.4,
        "pan":0.0, "stereo":0.9,
    },
    "Future_Bass_Pad": {
        "waveform": "sine",
        "harmonics": [1,1.5,2,3],
        "adsr": {"attack":0.4, "decay":0.4, "sustain":0.9, "release":1.2},
        "filter": {"type":"lowpass", "cutoff":1600, "resonance":0.4},
        "chorus":1.0, "reverb":1.0, "delay":0.2,
        "pan":0.0, "stereo":1.0,
    },

    # === Amapiano ===
    "Amapiano_Log_Drum": {
        "waveform": "sine",
        "harmonics": [1,0.5,0.25],
        "adsr": {"attack":0.002, "decay":0.35, "sustain":0.5, "release":0.6},
        "filter": {"type":"lowpass", "cutoff":220, "resonance":0.8},
        "sub_bass":1.4, "reverb":0.3,
        "pan":-0.6, "octave_shift":-2,
    },
    "Afro_Conga": {
        "waveform": "triangle",
        "harmonics": [1,2],
        "adsr": {"attack":0.001, "decay":0.06, "sustain":0.2, "release":0.08},
        "filter": {"type":"bandpass", "cutoff":800, "resonance":0.5},
        "pan":0.4,
    },

    # === DnB ===
    "DnB_Bass": {
        "waveform": "saw",
        "harmonics": [1,2,3,4,5],
        "adsr": {"attack":0.002, "decay":0.08, "sustain":0.8, "release":0.12},
        "filter": {"type":"lowpass", "cutoff":900, "resonance":0.7},
        "distortion":0.25, "stereo":0.7,
        "pan":-0.3, "octave_shift":-1,
    },

    # === Synthwave ===
    "Synthwave_Juno": {
        "waveform": "saw",
        "harmonics": [1,2,3],
        "adsr": {"attack":0.08, "decay":0.25, "sustain":0.75, "release":0.4},
        "filter": {"type":"lowpass", "cutoff":2400, "resonance":0.5},
        "chorus":1.0, "stereo":0.8,
        "pan":0.0,
    },
    "Synthwave_Lead": {
        "waveform": "square",
        "harmonics": [1,2,3,4],
        "adsr": {"attack":0.02, "decay":0.15, "sustain":0.8, "release":0.3},
        "filter": {"type":"lowpass", "cutoff":3800, "resonance":0.6},
        "chorus":0.8, "delay":0.3,
        "pan":0.0, "stereo":0.85,
    },
    "Retro_Pad": {
        "waveform": "sine",
        "harmonics": [1,1.25,1.5,2],
        "adsr": {"attack":0.5, "decay":0.4, "sustain":0.9, "release":1.4},
        "filter": {"type":"lowpass", "cutoff":1400, "resonance":0.3},
        "chorus":1.0, "reverb":1.0,
        "pan":0.0, "stereo":1.0,
    },

    # === K-POP ===
    "KPop_Double_Bass": {
        "waveform": "saw",
        "harmonics": [1,0.5,2,3],
        "adsr": {"attack":0.003, "decay":0.07, "sustain":0.92, "release":0.15},
        "filter": {"type":"lowpass", "cutoff":750, "resonance":0.7},
        "sub_bass":1.3, "distortion":0.15,
        "pan":-0.4, "octave_shift":-1,
    },
    "KPop_Synth_Lead": {
        "waveform": "square",
        "harmonics": [1,2,3,5],
        "adsr": {"attack":0.01, "decay":0.12, "sustain":0.85, "release":0.25},
        "filter": {"type":"lowpass", "cutoff":4200, "resonance":0.6},
        "chorus":0.6, "reverb":0.6,
        "pan":0.0, "stereo":0.9,
    },
    "KPop_Vocal_Pad": {
        "waveform": "sine",
        "harmonics": [1,1.5],
        "adsr": {"attack":0.25, "decay":0.25, "sustain":0.9, "release":0.9},
        "filter": {"type":"lowpass", "cutoff":1100, "resonance":0.3},
        "chorus":1.0, "reverb":1.0,
        "pan":0.0, "stereo":1.0,
    },

    # === 传统保留 ===
    "钢琴": {"waveform":"sine","harmonics":[1],"adsr":{"attack":0.01,"decay":0.1,"sustain":0.7,"release":0.2},"pan":0.0},
    "小提琴":{"waveform":"saw","harmonics":[1,2,3],"adsr":{"attack":0.05,"decay":0.1,"sustain":0.8,"release":0.3},"pan":-0.2},
    "电吉他":{"waveform":"square","harmonics":[1,3],"adsr":{"attack":0.005,"decay":0.1,"sustain":0.6,"release":0.15},"pan":0.2},
    "古筝":{"waveform":"triangle","harmonics":[1,3,5],"adsr":{"attack":0.01,"decay":0.3,"sustain":0.4,"release":0.4},"reverb":{"room_size":0.4},"pan":0.0},
    "二胡":{"waveform":"saw","harmonics":[1,2,3],"adsr":{"attack":0.02,"decay":0.15,"sustain":0.8,"release":0.3},"vibrato":{"rate":5,"depth":0.02},"pan":-0.1},
}

# ==================== 音色映射 ====================
TIMBRE_MAPPINGS = {
    "bright": {
        "filter_cutoff_mult": 1.45,
        "resonance_mult": 1.2,
        "harmonic_gain": [1.0, 0.7, 0.5, 0.35, 0.2],
        "reverb_mult": 1.2, "chorus_mult": 1.2, "stereo_mult": 1.15,
    },
    "dark": {
        "filter_cutoff_mult": 0.65,
        "resonance_mult": 0.85,
        "harmonic_gain": [1.0, 0.45, 0.25, 0.15],
        "reverb_mult": 0.8, "chorus_mult": 0.7, "stereo_mult": 0.8,
    },
    "normal": {
        "filter_cutoff_mult": 1.0,
        "resonance_mult": 1.0,
        "harmonic_gain": [1.0, 0.55, 0.35, 0.2],
        "reverb_mult": 1.0, "chorus_mult": 1.0, "stereo_mult": 1.0,
    }
}

# ==================== 动态 ====================
DYNAMIC_MAPPINGS = {
    "pp": {"velocity_mult": 0.35, "harmonic_mult": 0.65},
    "p":  {"velocity_mult": 0.55, "harmonic_mult": 0.80},
    "mp": {"velocity_mult": 0.70, "harmonic_mult": 0.90},
    "mf": {"velocity_mult": 0.85, "harmonic_mult": 1.00},
    "f":  {"velocity_mult": 0.95, "harmonic_mult": 1.10},
    "ff": {"velocity_mult": 1.00, "harmonic_mult": 1.15},
}

# ==================== 数据 ====================
DATA_CONFIG = {
    'default_days': 60,
    'max_data_points': 500,
    'min_data_points': 10,
    'cache_size': 10,
}

# ==================== 股票 ====================
STOCK_NAMES = {
    "贵州茅台": "sh.600519",
    "五粮液": "sz.000858",
    "宁德时代": "sz.300750",
    "东方财富": "sz.300050",
    "中国平安": "sh.601318",
    "招商银行": "sh.600036",
    "比亚迪": "sz.002590",
    "上证指数": "sh.000001",
    "深证成指": "sz.399001",
    "沪深300": "sh.000300",
    "创业板指": "sz.399006",
    "科创50": "sh.000688",
}

# ==================== 日志 ====================
LOG_CONFIG = {
    'level': 'INFO',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    'file': 'stock_music.log',
}

# ==================== 版本 ====================
VERSION = {
    'major': 3,
    'minor': 1,
    'patch': 0,
    'name': 'Stock Music v3.1｜潮流音色+多风格节奏完整版',
}

# ==================== 映射策略 ====================
MAPPING_STRATEGIES = {
    'price_to_pitch': {
        'min_pitch': 45,
        'max_pitch': 88,
        'scale': 'pentatonic',
    },
    'volume_to_velocity': {
        'min_velocity': 35,
        'max_velocity': 115,
    },
    'volatility_to_duration': {
        'min_duration': 0.2,
        'max_duration': 1.2,
    },
    'pctchg_to_timbre': {
        'positive_timbre': 'bright',
        'negative_timbre': 'dark',
    },
    'macd_to_harmony': {
        'positive_harmony': 'major',
        'negative_harmony': 'minor',
    },
}