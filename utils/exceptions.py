"""
异常处理模块 - 自定义异常类
"""

class StockMusicException(Exception):
    """基础异常类"""
    def __init__(self, message, error_code=None, details=None):
        self.message = message
        self.error_code = error_code or 'UNKNOWN_ERROR'
        self.details = details or {}
        super().__init__(self.message)
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'error': self.error_code,
            'message': self.message,
            'details': self.details
        }

class DataFetchError(StockMusicException):
    """数据获取错误"""
    def __init__(self, message, details=None):
        super().__init__(message, 'DATA_FETCH_ERROR', details)

class DataValidationError(StockMusicException):
    """数据验证错误"""
    def __init__(self, message, details=None):
        super().__init__(message, 'DATA_VALIDATION_ERROR', details)

class MusicGenerationError(StockMusicException):
    """音乐生成错误"""
    def __init__(self, message, details=None):
        super().__init__(message, 'MUSIC_GENERATION_ERROR', details)

class AudioPlaybackError(StockMusicException):
    """音频播放错误"""
    def __init__(self, message, details=None):
        super().__init__(message, 'AUDIO_PLAYBACK_ERROR', details)

class ConfigError(StockMusicException):
    """配置错误"""
    def __init__(self, message, details=None):
        super().__init__(message, 'CONFIG_ERROR', details)

class NetworkError(StockMusicException):
    """网络错误"""
    def __init__(self, message, details=None):
        super().__init__(message, 'NETWORK_ERROR', details)

class ResourceError(StockMusicException):
    """资源错误（内存、文件等）"""
    def __init__(self, message, details=None):
        super().__init__(message, 'RESOURCE_ERROR', details)
