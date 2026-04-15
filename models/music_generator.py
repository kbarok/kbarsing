"""
增强的音乐生成器 - 多维度映射，丰富的音乐表现
支持 808 底鼓、复古合成器、动态音色等高级功能
【优化】超级合成降噪：频段分离、音量控制、动态压缩、空间效果优化
"""

import numpy as np
import pandas as pd
from scipy.io import wavfile
import tempfile
import threading
import os
import sys

# 确保 server 目录在路径中（用于 Flask 环境）
_server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _server_dir not in sys.path:
    sys.path.insert(0, _server_dir)

from utils.logger import get_logger
from utils.exceptions import MusicGenerationError
from config.settings import MUSIC_CONFIG, MAPPING_STRATEGIES
from config.settings import INSTRUMENTS, TIMBRE_MAPPINGS, DYNAMIC_MAPPINGS

logger = get_logger(__name__)


class AdvancedMusicGenerator:
    """高级音乐生成器 - 支持多维度数据映射和高级音色"""
    
    def __init__(self):
        self.speed = MUSIC_CONFIG['default_speed']
        self.instrument = "钢琴"
        self.sample_rate = MUSIC_CONFIG['sample_rate']
        self.mapping_strategy = 'default'
        self._lock = threading.Lock()
        
        # 混音设置
        self.headphone_mode = False  # 耳机模式：增强立体声
        self.speaker_mode = False    # 外放模式：减少超低频
        
        # 【新增】超级合成降噪配置
        self.super_synthesis_config = {
            'freq_bands': {  # 三轨频段分离配置
                'low': {'min': 20, 'max': 500, 'gain': 0.8},    # 低频轨
                'mid': {'min': 500, 'max': 8000, 'gain': 0.9},  # 中频轨
                'high': {'min': 8000, 'max': 20000, 'gain': 0.3} # 高频轨（削减8kHz以上）
            },
            'rhythm_ratio': 0.15,  # 节奏占比降至15%
            'reverb': {           # 可控混响配置
                'amount': 0.15,    # 混响量0.15
                'delay': 0.025,    # 延迟25ms
                'decay': 0.5       # 尾音衰减
            },
            'compression': {      # 多段压缩配置
                'low_threshold': 0.4, 'low_ratio': 2.0,
                'mid_threshold': 0.5, 'mid_ratio': 2.5,
                'high_threshold': 0.3, 'high_ratio': 3.0
            },
            'limiter_gain': 1.2   # 软限制增益
        }
        
        logger.info(f"初始化音乐生成器: {self.instrument}, 速度: {self.speed}x")
    
    def set_speed(self, speed):
        """设置播放速度"""
        with self._lock:
            speed = max(MUSIC_CONFIG['min_speed'], min(MUSIC_CONFIG['max_speed'], speed))
            self.speed = speed
            logger.info(f"设置速度: {speed}x")
    
    def set_instrument(self, instrument):
        """设置乐器"""
        if instrument not in INSTRUMENTS:
            logger.warning(f"未知乐器: {instrument}")
            return False
        with self._lock:
            self.instrument = instrument
            logger.info(f"切换乐器: {instrument}")
        return True
    
    def set_mode(self, mode='normal'):
        """设置听感模式
        - normal: 正常
        - headphone: 耳机模式，增强立体声
        - speaker: 外放模式，减少超低频
        """
        self.headphone_mode = (mode == 'headphone')
        self.speaker_mode = (mode == 'speaker')
        logger.info(f"设置听感模式: {mode}")
    
    def _get_instrument_config(self):
        """获取当前乐器配置"""
        return INSTRUMENTS.get(self.instrument, INSTRUMENTS['钢琴'])
    
    # ==================== 多维度映射函数 ====================
    
    def _map_price_to_pitch(self, prices):
        """价格 → 音高"""
        prices = np.array(prices)
        price_min, price_max = prices.min(), prices.max()
        
        if price_max == price_min:
            return np.full_like(prices, 60, dtype=int)
        
        normalized = (prices - price_min) / (price_max - price_min)
        
        min_pitch = MAPPING_STRATEGIES['price_to_pitch']['min_pitch']
        max_pitch = MAPPING_STRATEGIES['price_to_pitch']['max_pitch']
        pitches = min_pitch + normalized * (max_pitch - min_pitch)
        
        # 应用音阶
        scale = MAPPING_STRATEGIES['price_to_pitch']['scale']
        if scale == 'pentatonic':
            pitches = self._apply_pentatonic_scale(pitches)
        elif scale == 'major':
            pitches = self._apply_major_scale(pitches)
        elif scale == 'minor':
            pitches = self._apply_minor_scale(pitches)
        
        # 808 乐器降低八度
        inst_config = self._get_instrument_config()
        octave_shift = inst_config.get('octave_shift', 0)
        pitches = pitches + octave_shift
        
        return np.round(pitches).astype(int)
    
    def _map_volume_to_velocity(self, volumes):
        """成交量 → 力度"""
        volumes = np.array(volumes)
        vol_min, vol_max = volumes.min(), volumes.max()
        
        if vol_max == vol_min:
            return np.full_like(volumes, 80, dtype=int)
        
        normalized = (volumes - vol_min) / (vol_max - vol_min)
        min_vel = MAPPING_STRATEGIES['volume_to_velocity']['min_velocity']
        max_vel = MAPPING_STRATEGIES['volume_to_velocity']['max_velocity']
        velocities = min_vel + normalized * (max_vel - min_vel)
        
        return np.round(velocities).astype(int)
    
    def _map_volatility_to_duration(self, volatilities):
        """波动率 → 音符长度"""
        volatilities = np.array(volatilities)
        vol_min, vol_max = volatilities.min(), volatilities.max()
        
        if vol_max == vol_min:
            vol_normalized = np.full_like(volatilities, 0.5)
        else:
            vol_normalized = (volatilities - vol_min) / (vol_max - vol_min)
        
        min_dur = MAPPING_STRATEGIES['volatility_to_duration']['min_duration']
        max_dur = MAPPING_STRATEGIES['volatility_to_duration']['max_duration']
        durations = min_dur + (1 - vol_normalized) * (max_dur - min_dur)
        
        return durations / self.speed
    
    def _map_pctchg_to_timbre(self, pctchg):
        """涨跌幅 → 音色"""
        pctchg = np.array(pctchg)
        timbres = np.where(pctchg > 0, 'bright', 'dark')
        return timbres
    
    def _map_macd_to_harmony(self, macd):
        """MACD → 和弦类型"""
        macd = np.array(macd)
        harmonies = np.where(macd > 0, 'major', 'minor')
        return harmonies
    
    def _map_rsi_to_articulation(self, rsi):
        """RSI → 音符连接方式"""
        rsi = np.array(rsi)
        articulations = np.where(rsi > 70, 'staccato', 
                                np.where(rsi < 30, 'legato', 'normal'))
        return articulations
    
    def _map_bollinger_to_dynamics(self, upper, lower, close):
        """布林带 → 动态强度"""
        upper, lower, close = np.array(upper), np.array(lower), np.array(close)
        
        position = (close - lower) / (upper - lower + 1e-10)
        position = np.clip(position, 0, 1)
        
        # 映射到动态标记
        dynamics = []
        for p in position:
            if p < 0.17:
                dynamics.append('pp')
            elif p < 0.33:
                dynamics.append('p')
            elif p < 0.5:
                dynamics.append('mp')
            elif p < 0.67:
                dynamics.append('mf')
            elif p < 0.83:
                dynamics.append('f')
            else:
                dynamics.append('ff')
        
        return dynamics
    
    # ==================== 音阶应用 ====================
    
    def _apply_pentatonic_scale(self, pitches):
        """五声音阶"""
        pentatonic = [0, 2, 4, 7, 9]
        return self._quantize_to_scale(pitches, pentatonic)
    
    def _apply_major_scale(self, pitches):
        """大调音阶"""
        major = [0, 2, 4, 5, 7, 9, 11]
        return self._quantize_to_scale(pitches, major)
    
    def _apply_minor_scale(self, pitches):
        """小调音阶"""
        minor = [0, 2, 3, 5, 7, 8, 10]
        return self._quantize_to_scale(pitches, minor)
    
    def _quantize_to_scale(self, pitches, scale_intervals):
        """量化到指定音阶"""
        quantized = []
        for pitch in pitches:
            octave = int(pitch // 12)
            note_in_octave = pitch % 12
            
            closest_scale_note = min(scale_intervals, 
                                    key=lambda x: abs(x - note_in_octave))
            quantized_pitch = octave * 12 + closest_scale_note
            quantized.append(quantized_pitch)
        
        return np.array(quantized)
    
    # ==================== 波形生成 ====================
    
    def _generate_waveform(self, freq, duration, velocity, timbre='normal', dynamics='mf'):
        """生成单个音符的波形 - 增强版支持潮流音色特性"""
        inst_config = self._get_instrument_config()
        waveform_type = inst_config.get('waveform', 'sine')
        
        # 确保样本数量
        num_samples = max(1, int(self.sample_rate * duration))
        t = np.linspace(0, duration, num_samples, endpoint=False)
        vel = (velocity / 127.0) * 0.5
        
        # 基础波形 + 谐波
        harmonics = inst_config.get('harmonics', [1])
        wave = np.zeros(num_samples)
        
        for i, h in enumerate(harmonics[:5]):  # 最多5个谐波
            harmonic_freq = freq * h
            if waveform_type == "sine":
                wave += np.sin(2 * np.pi * harmonic_freq * t) / (i + 1)
            elif waveform_type == "saw":
                wave += (2 * (harmonic_freq * t - np.floor(0.5 + harmonic_freq * t))) / (i + 1)
            elif waveform_type == "square":
                wave += np.sign(np.sin(2 * np.pi * harmonic_freq * t)) / (i + 1)
            elif waveform_type == "triangle":
                wave += (2 * np.abs(2 * (harmonic_freq * t - np.floor(0.5 + harmonic_freq * t))) - 1) / (i + 1)
            elif waveform_type == "chord":
                wave += np.sin(2 * np.pi * harmonic_freq * t) / (i + 1)
            else:
                wave += np.sin(2 * np.pi * harmonic_freq * t) / (i + 1)
        
        # 归一化
        if len(harmonics) > 1:
            wave = wave / np.sum([1/(i+1) for i in range(len(harmonics))])
        
        # 应用滤波器 (如果配置中有)
        filter_config = inst_config.get('filter')
        if filter_config:
            wave = self._apply_filter(wave, filter_config, timbre)
        
        # 应用失真 (如果配置中有)
        distortion = inst_config.get('distortion', 0)
        if distortion > 0:
            wave = np.tanh(wave * (1 + distortion * 2)) / (1 + distortion)
        
        # ADSR 包络 (从配置读取)
        adsr = inst_config.get('adsr', {'attack': 0.01, 'decay': 0.1, 'sustain': 0.7, 'release': 0.2})
        
        # 计算各阶段样本数
        attack_samples = int(adsr['attack'] * self.sample_rate)
        decay_samples = int(adsr['decay'] * self.sample_rate)
        release_samples = int(adsr['release'] * self.sample_rate)
        sustain_samples = max(0, num_samples - attack_samples - decay_samples - release_samples)
        
        # 构建包络
        envelope = np.zeros(num_samples)
        pos = 0
        
        # Attack
        if attack_samples > 0 and pos < num_samples:
            end = min(pos + attack_samples, num_samples)
            envelope[pos:end] = np.linspace(0, 1, end - pos)
            pos = end
        
        # Decay
        if decay_samples > 0 and pos < num_samples:
            end = min(pos + decay_samples, num_samples)
            envelope[pos:end] = np.linspace(1, adsr['sustain'], end - pos)
            pos = end
        
        # Sustain
        if sustain_samples > 0 and pos < num_samples:
            end = min(pos + sustain_samples, num_samples)
            envelope[pos:end] = adsr['sustain']
            pos = end
        
        # Release
        if release_samples > 0 and pos < num_samples:
            end = min(pos + release_samples, num_samples)
            envelope[pos:end] = np.linspace(adsr['sustain'], 0, end - pos)
        
        wave = wave * envelope * vel
        
        # 立体声定位
        pan = inst_config.get('pan', 0.0)
        
        return wave, pan
    
    def _apply_filter(self, wave, filter_config, timbre='normal'):
        """应用滤波器效果"""
        try:
            from scipy import signal
            
            filter_type = filter_config.get('type', 'lowpass')
            cutoff = filter_config.get('cutoff', 2000)
            resonance = filter_config.get('resonance', 0.5)
            
            # 根据音色调整截止频率
            if timbre == 'bright':
                cutoff *= 1.3
            elif timbre == 'dark':
                cutoff *= 0.7
            
            # 归一化截止频率
            nyquist = self.sample_rate / 2
            normalized_cutoff = min(cutoff / nyquist, 0.99)
            
            if filter_type == 'lowpass':
                b, a = signal.butter(2, normalized_cutoff, btype='low')
            elif filter_type == 'highpass':
                b, a = signal.butter(2, normalized_cutoff, btype='high')
            elif filter_type == 'bandpass':
                low = normalized_cutoff * 0.5
                high = min(normalized_cutoff * 1.5, 0.99)
                b, a = signal.butter(2, [low, high], btype='band')
            else:
                return wave
            
            # 应用滤波器
            filtered = signal.filtfilt(b, a, wave)
            
            # 添加共振峰效果
            if resonance > 0.3:
                filtered = filtered * (1 + resonance * 0.3 * np.sin(2 * np.pi * 500 * np.arange(len(wave)) / self.sample_rate))
            
            return filtered
        
        except Exception as e:
            logger.warning(f"滤波器应用失败: {e}")
            return wave
    
    # ==================== 【新增】频段分离滤波函数 ====================
    def _apply_band_filter(self, audio, band_min, band_max):
        """应用频段滤波（分离低/中/高频）"""
        try:
            from scipy import signal
            nyquist = self.sample_rate / 2
            low = band_min / nyquist
            high = min(band_max / nyquist, 0.99)
            
            # 安全检查
            if low >= high:
                return audio
            
            b, a = signal.butter(2, [low, high], btype='band')
            filtered = signal.filtfilt(b, a, audio)
            return filtered
        except Exception as e:
            logger.warning(f"频段滤波失败: {e}")
            return audio
    
    # ==================== 【新增】多段压缩函数 ====================
    def _apply_multiband_compression(self, audio):
        """多段压缩：低/中/高频分别压缩"""
        try:
            config = self.super_synthesis_config['compression']
            
            # 分离频段
            low_band = self._apply_band_filter(audio, 20, 500)
            mid_band = self._apply_band_filter(audio, 500, 8000)
            high_band = self._apply_band_filter(audio, 8000, 20000)
            
            # 低频压缩
            low_compressed = np.where(
                np.abs(low_band) > config['low_threshold'],
                np.sign(low_band) * (config['low_threshold'] + (np.abs(low_band) - config['low_threshold']) / config['low_ratio']),
                low_band
            )
            
            # 中频压缩
            mid_compressed = np.where(
                np.abs(mid_band) > config['mid_threshold'],
                np.sign(mid_band) * (config['mid_threshold'] + (np.abs(mid_band) - config['mid_threshold']) / config['mid_ratio']),
                mid_band
            )
            
            # 高频压缩
            high_compressed = np.where(
                np.abs(high_band) > config['high_threshold'],
                np.sign(high_band) * (config['high_threshold'] + (np.abs(high_band) - config['high_threshold']) / config['high_ratio']),
                high_band
            )
            
            # 合并频段
            compressed = low_compressed + mid_compressed + high_compressed
            return compressed
        except Exception as e:
            logger.warning(f"多段压缩失败: {e}")
            return audio
    
    # ==================== 技术指标计算 ====================
    
    def _calculate_rsi(self, prices, period=14):
        """计算 RSI"""
        prices = np.array(prices)
        deltas = np.diff(prices)
        seed = deltas[:period + 1]
        up = seed[seed >= 0].sum() / period
        down = -seed[seed < 0].sum() / period
        rs = up / down if down != 0 else 0
        rsi = np.zeros_like(prices)
        rsi[:period] = 100. - 100. / (1. + rs)
        
        for i in range(period, len(prices)):
            delta = deltas[i - 1]
            if delta > 0:
                upval = delta
                downval = 0.
            else:
                upval = 0.
                downval = -delta
            
            up = (up * (period - 1) + upval) / period
            down = (down * (period - 1) + downval) / period
            rs = up / down if down != 0 else 0
            rsi[i] = 100. - 100. / (1. + rs)
        
        return rsi
    
    def _calculate_bollinger_bands(self, prices, period=20, num_std=2):
        """计算布林带"""
        prices = np.array(prices)
        sma = pd.Series(prices).rolling(window=period).mean().values
        std = pd.Series(prices).rolling(window=period).std().values
        upper = sma + (std * num_std)
        lower = sma - (std * num_std)
        return upper, lower
    
    # ==================== 音符生成 ====================
    
    def data_to_notes(self, df, start_time=0):
        """生成音符序列"""
        try:
            notes = []
            
            # 计算映射
            pitches = self._map_price_to_pitch(df['close'])
            velocities = self._map_volume_to_velocity(df['volume'])
            durations = self._map_volatility_to_duration(df['volatility'])
            timbres = self._map_pctchg_to_timbre(df['pctChg'])
            harmonies = self._map_macd_to_harmony(df['macd'])
            
            # RSI 和布林带
            if 'rsi' not in df.columns:
                rsi = self._calculate_rsi(df['close'])
            else:
                rsi = df['rsi'].values
            
            articulations = self._map_rsi_to_articulation(rsi)
            
            if 'bb_upper' not in df.columns:
                bb_upper, bb_lower = self._calculate_bollinger_bands(df['close'])
            else:
                bb_upper, bb_lower = df['bb_upper'].values, df['bb_lower'].values
            
            dynamics_list = self._map_bollinger_to_dynamics(bb_upper, bb_lower, df['close'])
            
            base_interval = 0.5 / self.speed
            start_idx = int(start_time / base_interval) if start_time > 0 else 0
            start_idx = min(start_idx, len(df) - 1)
            
            for i in range(start_idx, len(df)):
                row = df.iloc[i]
                pitch = pitches[i]
                velocity = int(velocities[i])
                duration = durations[i]
                timbre = timbres[i]
                harmony = harmonies[i]
                articulation = articulations[i]
                dynamics = dynamics_list[i]
                pct = row['pctChg'] if pd.notna(row['pctChg']) else 0
                
                # 断奏缩短音符
                if articulation == 'staccato':
                    duration *= 0.5
                # 连奏延长音符
                elif articulation == 'legato':
                    duration *= 1.2
                
                note_time = (i - start_idx) * base_interval
                
                # 主音符
                notes.append({
                    'time': note_time,
                    'duration': duration,
                    'pitch': pitch,
                    'velocity': velocity,
                    'timbre': timbre,
                    'harmony': harmony,
                    'articulation': articulation,
                    'dynamics': dynamics,
                    'pct': pct
                })
                
                # 和弦音（大幅降低触发阈值和音量）
                if pct > 2.5:  # 从1.5提高到2.5
                    notes.append({
                        'time': note_time + 0.05 / self.speed,
                        'duration': duration * 0.5,
                        'pitch': pitch + 4,
                        'velocity': int(velocity * 0.3),  # 从0.5降到0.3
                        'timbre': 'bright',
                        'harmony': 'major',
                        'articulation': 'staccato',
                        'dynamics': dynamics,
                        'pct': pct
                    })
                    notes.append({
                        'time': note_time + 0.1 / self.speed,
                        'duration': duration * 0.5,
                        'pitch': pitch + 7,
                        'velocity': int(velocity * 0.25),  # 从0.4降到0.25
                        'timbre': 'bright',
                        'harmony': 'major',
                        'articulation': 'staccato',
                        'dynamics': dynamics,
                        'pct': pct
                    })
                elif pct < -2.5:  # 从-1.5降到-2.5
                    notes.append({
                        'time': note_time + 0.05 / self.speed,
                        'duration': duration * 0.5,
                        'pitch': pitch - 3,
                        'velocity': int(velocity * 0.3),  # 从0.5降到0.3
                        'timbre': 'dark',
                        'harmony': 'minor',
                        'articulation': 'legato',
                        'dynamics': dynamics,
                        'pct': pct
                    })
            
            logger.info(f"生成 {len(notes)} 个音符")
            return notes
        
        except Exception as e:
            logger.error(f"音符生成失败: {e}")
            raise MusicGenerationError(f"音符生成失败: {str(e)}")
    
    # ==================== 音频生成 ====================
    
    def generate_audio_from(self, df, start_time=0):
        """生成音频"""
        try:
            notes = self.data_to_notes(df, start_time)
            if not notes:
                logger.warning("没有生成任何音符")
                return np.zeros(int(self.sample_rate)), self.sample_rate
            
            total_time = max([n['time'] + n['duration'] for n in notes]) + 0.5
            total_samples = int(total_time * self.sample_rate)
            
            # 单声道音频
            audio = np.zeros(total_samples)
            
            def pitch_to_freq(pitch):
                return 440 * (2 ** ((pitch - 69) / 12))
            
            for note in notes:
                start_sample = int(note['time'] * self.sample_rate)
                if start_sample >= total_samples or start_sample < 0:
                    continue
                
                freq = pitch_to_freq(note['pitch'])
                waveform, _ = self._generate_waveform(
                    freq, 
                    note['duration'], 
                    note['velocity'], 
                    note['timbre'],
                    note['dynamics']
                )
                
                # 正确叠加波形
                end_sample = min(start_sample + len(waveform), total_samples)
                length = end_sample - start_sample
                if length > 0:
                    audio[start_sample:end_sample] += waveform[:length]
            
            # 归一化
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val * 0.8
            
            logger.info(f"生成音频: {total_time:.2f}秒, 样本数: {len(audio)}")
            return audio, self.sample_rate
        
        except Exception as e:
            logger.error(f"音频生成失败: {e}")
            import traceback
            traceback.print_exc()
            raise MusicGenerationError(f"音频生成失败: {str(e)}")
    
    def save_audio_file_from(self, df, start_time=0):
        """保存音频文件"""
        try:
            audio, sr = self.generate_audio_from(df, start_time)
            
            # 确保音频数据正确
            if len(audio.shape) == 1:
                # 单声道，转为立体声
                stereo = np.column_stack((audio, audio))
            else:
                stereo = audio
            
            audio_int = (stereo * 32767).astype(np.int16)
            
            temp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            wavfile.write(temp.name, sr, audio_int)
            temp.close()
            
            notes = self.data_to_notes(df, start_time)
            total_duration = max([n['time'] + n['duration'] for n in notes]) + 1 if notes else 30
            
            logger.info(f"音频文件已保存: {temp.name}, 时长: {total_duration:.1f}秒")
            return temp.name, total_duration
        
        except Exception as e:
            logger.error(f"保存音频文件失败: {e}")
            import traceback
            traceback.print_exc()
            raise MusicGenerationError(f"保存音频文件失败: {str(e)}")
    
    # ==================== 分层合成功能 ====================
    
    def save_layered_synthesis_file(self, df, synthesis_level=1, start_time=0):
        """
        保存分层合成音频文件
        
        参数：
        - df: 股票数据
        - synthesis_level: 合成级别 (1, 2, 3)
          * 1 = 合成1（3种乐器随机混音）
          * 2 = 合成2（4种乐器随机混音）
          * 3 = 合成3（4种乐器随机混音）
        - start_time: 开始时间
        
        返回：
        - (file_path, duration, instruments_used)
        """
        try:
            # 计算乐器数量
            if synthesis_level == 1:
                num_instruments = 3
            elif synthesis_level == 2:
                num_instruments = 4
            elif synthesis_level == 3:
                num_instruments = 4
            else:
                num_instruments = 3
            
            # 获取可用乐器列表
            available_instruments = list(INSTRUMENTS.keys())
            
            # 随机选择乐器
            import random
            random.seed(hash(str(df.iloc[0:5].values)) % (2**32))
            selected_instruments = random.sample(
                available_instruments, 
                min(num_instruments, len(available_instruments))
            )
            
            logger.info(f"合成{synthesis_level}: 使用 {num_instruments} 种乐器 - {selected_instruments}")
            
            # 为每种乐器生成音轨
            audio_tracks = []
            for instrument in selected_instruments:
                original_instrument = self.instrument
                self.set_instrument(instrument)
                
                audio, sr = self.generate_audio_from(df, start_time)
                audio_tracks.append(audio)
                
                self.set_instrument(original_instrument)
            
            # 混音合成
            combined_audio = self._mix_audio_tracks(audio_tracks)
            
            # 转为立体声
            if len(combined_audio.shape) == 1:
                stereo = np.column_stack((combined_audio, combined_audio))
            else:
                stereo = combined_audio
            
            audio_int = (stereo * 32767).astype(np.int16)
            
            temp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            wavfile.write(temp.name, sr, audio_int)
            temp.close()
            
            # 计算时长
            total_duration = len(combined_audio) / sr
            
            logger.info(f"合成{synthesis_level} 文件已保存: {temp.name}, 时长: {total_duration:.1f}秒")
            return temp.name, total_duration, selected_instruments
        
        except Exception as e:
            logger.error(f"保存分层合成文件失败: {e}")
            import traceback
            traceback.print_exc()
            raise MusicGenerationError(f"保存分层合成文件失败: {str(e)}")
    
    def _mix_audio_tracks(self, tracks):
        """
        混音多条音轨
        
        参数：
        - tracks: 音轨列表 (numpy arrays)
        
        返回：
        - 混音后的音频 (numpy array)
        """
        if not tracks:
            return np.zeros(int(self.sample_rate))
        
        # 确保所有音轨长度一致
        max_length = max(len(track) for track in tracks)
        normalized_tracks = []
        
        for track in tracks:
            if len(track) < max_length:
                track = np.pad(track, (0, max_length - len(track)), mode='constant')
            normalized_tracks.append(track)
        
        # 混音（平均）
        combined = np.mean(normalized_tracks, axis=0)
        
        # 归一化防止失真
        max_val = np.max(np.abs(combined))
        if max_val > 1.0:
            combined = combined / max_val * 0.95
        
        logger.info(f"混音完成: {len(tracks)} 条音轨")
        return combined.astype(np.float32)

    # ==================== 🔥 潮流音色合成 (2023-2025趋势) ====================
    
    def save_trendy_synthesis_file(self, df, instrument_name, rhythm_style, start_time=0):
        """
        生成潮流音色合成文件
        
        参数：
        - df: 股票数据
        - instrument_name: 潮流音色名称 (如 "Future_Bass_Lead")
        - rhythm_style: 节奏风格 (如 "KPop_精准鼓组")
        - start_time: 开始时间
        
        返回：
        - (file_path, duration)
        """
        try:
            from config.settings import RHYTHM_STYLES, INSTRUMENTS
            
            logger.info(f"生成潮流音色: {instrument_name}, 节奏: {rhythm_style}")
            
            # 设置主音色
            original_instrument = self.instrument
            if instrument_name in INSTRUMENTS:
                self.set_instrument(instrument_name)
            
            # 生成主音轨
            main_audio, sr = self.generate_audio_from(df, start_time)
            
            # 获取节奏模式
            rhythm = RHYTHM_STYLES.get(rhythm_style, RHYTHM_STYLES["KPop_精准鼓组"])
            
            # 生成节奏层
            drum_audio = self._generate_rhythm_layer(df, rhythm, len(main_audio), sr)
            
            # 混音：主音色 + 节奏层（使用优化后的节奏占比）
            combined = self._mix_with_rhythm(main_audio, drum_audio, mix_ratio=1 - self.super_synthesis_config['rhythm_ratio'])
            
            # 添加空间效果（使用优化后的混响配置）
            inst_config = INSTRUMENTS.get(instrument_name, {})
            if inst_config.get('reverb'):
                combined = self._apply_spatial_effects(combined, inst_config)
            
            # 转为立体声
            if len(combined.shape) == 1:
                stereo = np.column_stack((combined, combined))
            else:
                stereo = combined
            
            audio_int = (stereo * 32767).astype(np.int16)
            
            temp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            wavfile.write(temp.name, sr, audio_int)
            temp.close()
            
            total_duration = len(combined) / sr
            
            # 恢复原始音色
            self.set_instrument(original_instrument)
            
            logger.info(f"潮流音色文件已保存: {temp.name}, 时长: {total_duration:.1f}秒")
            return temp.name, total_duration
        
        except Exception as e:
            logger.error(f"潮流音色生成失败: {e}")
            import traceback
            traceback.print_exc()
            raise MusicGenerationError(f"潮流音色生成失败: {str(e)}")
    
    def _generate_rhythm_layer(self, df, rhythm, total_samples, sr):
        """生成节奏层 - 优化版（降低音量）"""
        try:
            audio = np.zeros(total_samples)
            
            # 节奏参数
            bpm = 128  # 默认BPM
            beat_duration = 60.0 / bpm
            samples_per_beat = int(beat_duration * sr)
            
            # 获取节奏模式
            kick_pattern = rhythm.get('kick_pattern', [1,0,0,0])
            snare_pattern = rhythm.get('snare_pattern', [0,0,1,0])
            hihat_pattern = rhythm.get('hihat_pattern', [0,1,0,1])
            
            # 生成鼓点（降低整体音量）
            for i in range(0, total_samples, samples_per_beat):
                beat_idx = (i // samples_per_beat) % len(kick_pattern)
                
                # Kick (底鼓) - 降低音量
                if kick_pattern[beat_idx] and i < total_samples:
                    kick = self._generate_drum_hit('kick', sr)
                    end = min(i + len(kick), total_samples)
                    audio[i:end] += kick[:end-i] * 0.4  # 从0.6降到0.4
                
                # Snare (军鼓) - 降低音量
                if snare_pattern[beat_idx] and i < total_samples:
                    snare = self._generate_drum_hit('snare', sr)
                    end = min(i + len(snare), total_samples)
                    audio[i:end] += snare[:end-i] * 0.35  # 从0.5降到0.35
                
                # Hi-hat (踩镲) - 大幅降低音量
                if hihat_pattern[beat_idx] and i < total_samples:
                    hihat = self._generate_drum_hit('hihat', sr)
                    end = min(i + len(hihat), total_samples)
                    audio[i:end] += hihat[:end-i] * 0.15  # 从0.25降到0.15
            
            return audio
        
        except Exception as e:
            logger.error(f"节奏层生成失败: {e}")
            return np.zeros(total_samples)
    
    def _generate_drum_hit(self, drum_type, sr):
        """生成单个鼓点 - 优化版（更柔和）"""
        duration = 0.12 if drum_type == 'hihat' else 0.25
        samples = int(duration * sr)
        t = np.linspace(0, duration, samples, endpoint=False)
        
        if drum_type == 'kick':
            # 808风格底鼓（更柔和）
            freq = 55 * np.exp(-t * 12)  # 从60降到55，衰减从15降到12
            wave = np.sin(2 * np.pi * freq * t)
            envelope = np.exp(-t * 6)  # 从8降到6，更柔和
            return wave * envelope * 0.7
        
        elif drum_type == 'snare':
            # 噪声+正弦混合（降低噪声比例）
            noise = np.random.randn(samples) * 0.3  # 从0.5降到0.3
            tone = np.sin(2 * np.pi * 180 * t) * 0.6  # 从200降到180
            envelope = np.exp(-t * 10)  # 从12降到10
            return (noise + tone) * envelope * 0.5
        
        elif drum_type == 'hihat':
            # 高频噪声（大幅降低音量）
            noise = np.random.randn(samples)
            # 高通滤波效果
            filtered = np.diff(noise, prepend=noise[0])
            envelope = np.exp(-t * 30)  # 从25提到30，更短促
            return filtered * envelope * 0.12  # 从0.2降到0.12
        
        return np.zeros(samples)
    
    def _mix_with_rhythm(self, main_audio, drum_audio, mix_ratio=0.85):
        """混合主音色和节奏层（优化：提高主音色占比）"""
        # 确保长度一致
        max_len = max(len(main_audio), len(drum_audio))
        if len(main_audio) < max_len:
            main_audio = np.pad(main_audio, (0, max_len - len(main_audio)))
        if len(drum_audio) < max_len:
            drum_audio = np.pad(drum_audio, (0, max_len - len(drum_audio)))
        
        # 混音（主音色占85%）
        combined = main_audio * mix_ratio + drum_audio * (1 - mix_ratio)
        
        # 归一化
        max_val = np.max(np.abs(combined))
        if max_val > 0:
            combined = combined / max_val * 0.9
        
        return combined
    
    def _apply_spatial_effects(self, audio, inst_config):
        """应用空间效果 (优化：减少混响)"""
        try:
            reverb_config = self.super_synthesis_config['reverb']
            # 可控混响模拟 (延迟叠加+尾音衰减)
            if inst_config.get('reverb'):
                delay_samples = int(reverb_config['delay'] * self.sample_rate)
                
                if len(audio) > delay_samples:
                    reverb_tail = np.zeros_like(audio)
                    reverb_tail[delay_samples:] = audio[:-delay_samples] * reverb_config['amount']
                    # 尾音衰减
                    decay_envelope = np.exp(-np.arange(len(reverb_tail)) / (self.sample_rate * reverb_config['decay']))
                    reverb_tail = reverb_tail * decay_envelope
                    audio = audio + reverb_tail
            
            # 合唱效果（降低强度）
            if inst_config.get('chorus'):
                chorus_amount = 0.08  # 从0.1降到0.08
                delay_samples = int(0.015 * self.sample_rate)  # 从0.02降到0.015
                if len(audio) > delay_samples:
                    chorus_voice = np.zeros_like(audio)
                    chorus_voice[delay_samples:] = audio[:-delay_samples] * chorus_amount
                    audio = audio + chorus_voice
            
            # 归一化
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val * 0.9
            
            return audio
        
        except Exception as e:
            logger.error(f"空间效果应用失败: {e}")
            return audio
    
    # ==================== 🔥 超级合成 (3种音色叠加) - 优化版 ====================
    
    def save_super_synthesis_file(self, df, instrument_list, rhythm_style, start_time=0):
        """
        生成超级合成文件 - 3种音色叠加（优化降噪版）
        
        参数：
        - df: 股票数据
        - instrument_list: 3种音色名称列表
        - rhythm_style: 节奏风格
        - start_time: 开始时间
        
        返回：
        - (file_path, duration)
        """
        try:
            from config.settings import RHYTHM_STYLES, INSTRUMENTS
            
            logger.info(f"生成超级合成(优化版): {instrument_list}, 节奏: {rhythm_style}")
            
            # 保存原始音色
            original_instrument = self.instrument
            
            # 为每种音色生成音轨（按频段分配）
            audio_tracks = []
            track_bands = ['low', 'mid', 'high']  # 三轨对应低/中/高频
            track_info = []
            
            for i, (inst_name, band) in enumerate(zip(instrument_list[:3], track_bands)):
                if inst_name in INSTRUMENTS:
                    self.set_instrument(inst_name)
                    
                    # 生成音轨
                    track_audio, sr = self.generate_audio_from(df, start_time)
                    
                    # 频段分离滤波
                    band_config = self.super_synthesis_config['freq_bands'][band]
                    filtered_track = self._apply_band_filter(track_audio, band_config['min'], band_config['max'])
                    
                    # 按频段调整增益
                    filtered_track = filtered_track * band_config['gain']
                    
                    # 应用音量平衡
                    volume_balance = [0.85, 1.0, 0.85][i % 3]  # 中间稍大
                    filtered_track = filtered_track * volume_balance
                    
                    audio_tracks.append(filtered_track)
                    track_info.append(f"{inst_name}(band={band}, vol={volume_balance})")
                    
                    logger.info(f"超级合成音轨 {i+1}: {inst_name} → {band}频段")
            
            # 恢复原始音色
            self.set_instrument(original_instrument)
            
            # 混音3条音轨（优化算法）
            combined = self._mix_super_tracks(audio_tracks)
            
            # 多段压缩（核心降噪）
            combined = self._apply_multiband_compression(combined)
            
            # 添加节奏层（优化占比15%）
            rhythm = RHYTHM_STYLES.get(rhythm_style, RHYTHM_STYLES["KPop_精准鼓组"])
            drum_audio = self._generate_rhythm_layer(df, rhythm, len(combined), sr)
            
            # 最终混音 (音乐85% + 节奏15%)
            final_mix = self._mix_with_rhythm(combined, drum_audio, mix_ratio=1 - self.super_synthesis_config['rhythm_ratio'])
            
            # 应用母带处理 (强化限幅)
            final_mix = self._apply_mastering(final_mix)
            
            # 转为立体声
            if len(final_mix.shape) == 1:
                stereo = np.column_stack((final_mix, final_mix))
            else:
                stereo = final_mix
            
            audio_int = (stereo * 32767).astype(np.int16)
            
            temp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            wavfile.write(temp.name, sr, audio_int)
            temp.close()
            
            total_duration = len(final_mix) / sr
            
            logger.info(f"超级合成(优化版)文件已保存: {temp.name}, 音轨: {track_info}, 时长: {total_duration:.1f}秒")
            return temp.name, total_duration
        
        except Exception as e:
            logger.error(f"超级合成(优化版)生成失败: {e}")
            import traceback
            traceback.print_exc()
            raise MusicGenerationError(f"超级合成(优化版)生成失败: {str(e)}")
    
    def _mix_super_tracks(self, tracks):
        """混音多条超级合成音轨 - 优化：频段分离+动态保留"""
        if not tracks:
            return np.zeros(int(self.sample_rate))
        
        # 确保所有音轨长度一致
        max_len = max(len(track) for track in tracks)
        normalized_tracks = []
        
        for track in tracks:
            if len(track) < max_len:
                track = np.pad(track, (0, max_len - len(track)))
            normalized_tracks.append(track)
        
        # 混音（均方根混音+软限制，避免相位抵消和过载）
        combined = np.zeros(max_len)
        for track in normalized_tracks:
            combined += track ** 2
        combined = np.sqrt(combined / len(tracks))
        
        # 软限制防止削波（强化限幅）
        limiter_gain = self.super_synthesis_config['limiter_gain']
        combined = np.tanh(combined * limiter_gain) / limiter_gain
        
        # 归一化
        max_val = np.max(np.abs(combined))
        if max_val > 0:
            combined = combined / max_val * 0.95
        
        logger.info(f"超级合成混音完成(优化版): {len(tracks)} 条音轨")
        return combined.astype(np.float32)
    
    def _apply_mastering(self, audio):
        """应用母带处理 (优化：多段压缩+强化限幅)"""
        try:
            # 先应用多段压缩
            audio = self._apply_multiband_compression(audio)
            
            # 轻度压缩
            threshold = 0.5
            ratio = 2.0
            
            # 简单的压缩
            compressed = np.where(
                np.abs(audio) > threshold,
                np.sign(audio) * (threshold + (np.abs(audio) - threshold) / ratio),
                audio
            )
            
            # 强化软限制器 (防止削波)
            limiter_gain = self.super_synthesis_config['limiter_gain']
            limited = np.tanh(compressed * limiter_gain) / limiter_gain
            
            # 最终归一化
            max_val = np.max(np.abs(limited))
            if max_val > 0:
                limited = limited / max_val * 0.95
            
            return limited
        
        except Exception as e:
            logger.warning(f"母带处理失败: {e}")
            return audio

    def generate(self, df, instrument_name, rhythm_style, start_time=0, file_type='trendy'):
        """统一生成入口（web 环境专用，无 pygame 依赖）"""
        logger.info(f"generate() called: instrument={instrument_name}, rhythm={rhythm_style}, type={file_type}")
        if file_type == 'super':
            return self.save_super_synthesis_file(df, instrument_name, rhythm_style, start_time)
        else:
            return self.save_trendy_synthesis_file(df, instrument_name, rhythm_style, start_time)
