"""
日志管理模块 - 统一的日志处理
"""

import logging
import os
from datetime import datetime
from config.settings import LOG_CONFIG

class LoggerManager:
    """日志管理器 - 单例模式"""
    _instance = None
    _loggers = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self.log_dir = 'logs'
        self._ensure_log_dir()
        self._setup_root_logger()
    
    def _ensure_log_dir(self):
        """确保日志目录存在"""
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
    
    def _setup_root_logger(self):
        """设置根日志记录器"""
        root_logger = logging.getLogger()
        root_logger.setLevel(LOG_CONFIG['level'])
        
        # 文件处理器
        log_file = os.path.join(
            self.log_dir,
            f"stock_music_{datetime.now().strftime('%Y%m%d')}.log"
        )
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(LOG_CONFIG['level'])
        
        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setLevel(LOG_CONFIG['level'])
        
        # 格式化器
        formatter = logging.Formatter(LOG_CONFIG['format'])
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        # 添加处理器
        root_logger.addHandler(file_handler)
        root_logger.addHandler(console_handler)
    
    def get_logger(self, name):
        """获取或创建日志记录器"""
        if name not in self._loggers:
            self._loggers[name] = logging.getLogger(name)
        return self._loggers[name]

# 全局日志管理器实例
_log_manager = LoggerManager()

def get_logger(name):
    """便捷函数：获取日志记录器"""
    return _log_manager.get_logger(name)
