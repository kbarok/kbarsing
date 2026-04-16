"""
股票数据获取模块 - 改进的错误处理和缓存（优化完整版）
"""

import pandas as pd
import numpy as np
import functools
import os
import sys
import time
from datetime import datetime, timedelta

# 确保 server 目录在路径中（用于 Flask 环境）
_server_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _server_dir not in sys.path:
    sys.path.insert(0, _server_dir)

# 第三方库统一检测
try:
    import baostock as bs
    BAOSTOCK_AVAILABLE = True
except ImportError:
    BAOSTOCK_AVAILABLE = False
    bs = None

try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:
    YFINANCE_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from utils.logger import get_logger
from utils.exceptions import DataFetchError, DataValidationError, NetworkError
from config.settings import STOCK_NAMES, DATA_CONFIG

logger = get_logger(__name__)


class StockDataFetcher:
    """股票数据获取器 - 支持缓存、过期、多市场、自动降级"""

    # 全局常量
    REQUEST_TIMEOUT = 15
    CACHE_EXPIRE_MINUTES = 15
    BAOSTOCK_LOGIN_TTL = 300  # 5分钟内复用登录状态

    def __init__(self):
        self.logged_in = False
        self.last_login_time = None

        # 缓存结构：{ key: { "data": df, "expire_at": datetime } }
        self._cache = {}
        self._cache_size = DATA_CONFIG['cache_size']

        logger.info("股票数据获取器初始化完成（优化版）")

    # -------------------------------------------------------------------------
    # 登录管理（避免频繁 login/logout）
    # -------------------------------------------------------------------------
    def login(self):
        if not BAOSTOCK_AVAILABLE:
            return False

        # 5分钟内已登录，直接复用
        now = datetime.now()
        if self.logged_in and self.last_login_time:
            if (now - self.last_login_time).total_seconds() < self.BAOSTOCK_LOGIN_TTL:
                return True

        try:
            lg = bs.login()
            if lg.error_code == '0':
                self.logged_in = True
                self.last_login_time = now
                logger.info("baostock 登录成功")
                return True
            else:
                logger.error(f"baostock 登录失败: {lg.error_msg}")
                return False
        except Exception as e:
            logger.error(f"baostock 登录异常: {e}")
            raise NetworkError(f"无法连接 baostock: {str(e)}")

    def force_logout(self):
        """仅在程序退出时调用"""
        if self.logged_in:
            try:
                bs.logout()
                self.logged_in = False
                logger.info("baostock 已登出")
            except Exception as e:
                logger.warning(f"登出异常: {e}")

    # -------------------------------------------------------------------------
    # 代码格式化 & 市场识别
    # -------------------------------------------------------------------------
    def format_code(self, user_input):
        user_input = user_input.strip()
        if user_input in STOCK_NAMES:
            return STOCK_NAMES[user_input]
        if user_input.lower().startswith(('sh.', 'sz.')):
            return user_input.lower()
        if user_input.lower().endswith(('.sh', '.sz')):
            return user_input.lower()
        if user_input.isdigit() and len(user_input) == 6:
            if user_input.startswith(('60', '68')):
                return f"sh.{user_input}"
            elif user_input.startswith(('00', '30', '31')):
                return f"sz.{user_input}"
            else:
                return f"sh.{user_input}"
        for name, code in STOCK_NAMES.items():
            if user_input in name:
                return code
        return None

    def detect_market(self, user_input):
        code = user_input.strip().lower()
        crypto_tickers = {'btc', 'eth', 'sol', 'xrp', 'bnb', 'ada', 'doge', 'dot', 'avax', 'matic', 'link', 'uni', 'atom', 'ltc', 'xlm', 'algo'}
        if code.startswith(('us.', 'us-')):
            return 'us'
        if code.startswith('hk.'):
            return 'hk'
        if code.startswith('forex.'):
            return 'forex'
        if code.startswith('crypto.') or '-usdt' in code or '-usdc' in code:
            return 'crypto'
        base = code.split('.')[-1].split('-')[0].upper()
        if base in crypto_tickers:
            return 'crypto'
        if code.startswith('idx.'):
            return 'us'
        if code.isdigit() and len(code) == 6:
            return 'a'
        if code.endswith(('.sh', '.sz')):
            return 'a'
        if code in STOCK_NAMES:
            return 'a'
        # 自动识别：纯字母代码视为美股（如 AAPL, TSLA）
        if code.isalpha() and len(code) <= 5:
            return 'us'
        # 自动识别：5位数字视为港股（如 00700）
        if code.isdigit() and len(code) == 5:
            return 'hk'
        return None

    # -------------------------------------------------------------------------
    # 日期 & 数据校验
    # -------------------------------------------------------------------------
    def _validate_date(self, date_str):
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
            return True
        except ValueError:
            return False

    def _validate_date_range(self, start_date, end_date):
        if not self._validate_date(start_date):
            raise DataValidationError(f"起始日期格式错误: {start_date}")
        if not self._validate_date(end_date):
            raise DataValidationError(f"结束日期格式错误: {end_date}")
        if start_date > end_date:
            raise DataValidationError("起始日期不能晚于结束日期")

    # -------------------------------------------------------------------------
    # 缓存（带过期）
    # -------------------------------------------------------------------------
    def _get_cache_key(self, code, start_date, end_date):
        return f"{code}_{start_date}_{end_date}"

    def _get_from_cache(self, code, start_date, end_date):
        key = self._get_cache_key(code, start_date, end_date)
        now = datetime.now()
        if key not in self._cache:
            return None
        entry = self._cache[key]
        if entry['expire_at'] < now:
            del self._cache[key]
            logger.info(f"缓存已过期: {key}")
            return None
        logger.info(f"从缓存读取: {key}")
        return entry['data']

    def _save_to_cache(self, code, start_date, end_date, df):
        key = self._get_cache_key(code, start_date, end_date)
        if len(self._cache) >= self._cache_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
            logger.info(f"缓存已满，删除最旧条目: {oldest_key}")
        self._cache[key] = {
            "data": df.copy(),
            "expire_at": datetime.now() + timedelta(minutes=self.CACHE_EXPIRE_MINUTES)
        }
        logger.info(f"已存入缓存: {key}")

    # -------------------------------------------------------------------------
    # 技术指标（统一清洗 nan/inf）
    # -------------------------------------------------------------------------
    def _calculate_indicators(self, df):
        try:
            df = df.copy()
            close = df['close']

            df['ma5'] = close.rolling(5).mean()
            df['ma10'] = close.rolling(10).mean()
            df['ma20'] = close.rolling(20).mean()

            exp1 = close.ewm(span=12, adjust=False).mean()
            exp2 = close.ewm(span=26, adjust=False).mean()
            df['macd'] = exp1 - exp2
            df['macd_signal'] = df['macd'].ewm(span=9, adjust=False).mean()
            df['macd_hist'] = df['macd'] - df['macd_signal']

            df['volatility'] = (df['high'] - df['low']) / close

            df['rsi'] = self._calculate_rsi(close)
            df['bb_upper'], df['bb_lower'] = self._calculate_bollinger_bands(close)

            # 关键：清洗无穷大与空值
            df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
            return df
        except Exception as e:
            logger.error(f"指标计算失败: {e}")
            raise DataValidationError(f"技术指标计算失败: {str(e)}")

    def _calculate_rsi(self, prices, period=14):
        prices = np.array(prices)
        deltas = np.diff(prices)
        if len(deltas) < period:
            return np.zeros_like(prices)
        seed = deltas[:period + 1]
        up = seed[seed >= 0].sum() / period
        down = -seed[seed < 0].sum() / period
        rs = up / down if down != 0 else 0.0
        rsi = np.zeros_like(prices)
        rsi[:period] = 100. - 100. / (1. + rs)
        for i in range(period, len(prices)):
            delta = deltas[i - 1]
            upval = delta if delta > 0 else 0.
            downval = -delta if delta < 0 else 0.
            up = (up * (period - 1) + upval) / period
            down = (down * (period - 1) + downval) / period
            rs = up / down if down != 0 else 0.0
            rsi[i] = 100. - 100. / (1. + rs)
        return rsi

    def _calculate_bollinger_bands(self, prices, period=20, num_std=2):
        sma = pd.Series(prices).rolling(window=period).mean().values
        std = pd.Series(prices).rolling(window=period).std().values
        upper = sma + std * num_std
        lower = sma - std * num_std
        return upper, lower

    # -------------------------------------------------------------------------
    # 多市场数据源
    # -------------------------------------------------------------------------
    def _fetch_yahoo_finance(self, ticker, start_date, end_date):
        if not YFINANCE_AVAILABLE:
            raise NetworkError("yfinance 未安装，无法获取美股/港股")
        raw = ticker.strip().lower()
        if raw.startswith('us.'):
            yticker = raw[3:].upper()
        elif raw.startswith('hk.'):
            yticker = f"{raw[3:]}.HK"
        elif raw.startswith('idx.'):
            idx_map = {'spx': '^SPX', 'ndx': '^NDX', 'dji': '^DJI', 'vix': '^VIX', 'rut': '^RUT'}
            yticker = idx_map.get(raw[4:], raw[4:])
        else:
            yticker = ticker.upper()

        logger.info(f"[Yahoo] {yticker} {start_date} ~ {end_date}")
        df = None
        last_err = None
        for attempt in range(3):
            try:
                t = yf.Ticker(yticker)
                df = t.history(start=start_date, end=end_date, auto_adjust=True, timeout=self.REQUEST_TIMEOUT)
                if df.empty or len(df) < 3:
                    raise DataFetchError("数据过少或已退市")
                break
            except Exception as e:
                last_err = str(e)
                if attempt < 2:
                    time.sleep((attempt + 1) * 3)
        if df is None:
            raise NetworkError(f"Yahoo 多次失败: {last_err}")

        df = df.reset_index()
        df.columns = [c.lower() for c in df.columns]
        if 'datetime' in df.columns:
            df.rename(columns={'datetime': 'date'}, inplace=True)
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df['pctChg'] = df['close'].pct_change().fillna(0) * 100
        df = self._calculate_indicators(df)
        return df, f"Yahoo {yticker}"

    def _fetch_alpha_vantage(self, ticker, start_date, end_date):
        if not REQUESTS_AVAILABLE:
            raise NetworkError("requests 未安装")
        raw = ticker.strip().lower()
        avticker = raw[3:].upper() if raw.startswith(('us.', 'hk.')) else ticker.upper()
        url = "https://www.alphavantage.co/query"
        params = {
            'function': 'TIME_SERIES_DAILY',
            'symbol': avticker,
            'outputsize': 'full',
            'datatype': 'json'
        }
        resp = requests.get(url, params=params, timeout=self.REQUEST_TIMEOUT)
        data = resp.json()
        if 'Time Series (Daily)' not in data:
            err = data.get('Note', data.get('Information', '无数据'))
            raise NetworkError(f"AlphaVantage 限制: {err}")
        ts = data['Time Series (Daily)']
        records = []
        for d, v in sorted(ts.items()):
            if start_date <= d <= end_date:
                records.append({
                    'date': d,
                    'open': float(v['1. open']),
                    'high': float(v['2. high']),
                    'low': float(v['3. low']),
                    'close': float(v['4. close']),
                    'volume': int(v['5. volume'])
                })
        if not records:
            raise DataFetchError("日期范围内无数据")
        df = pd.DataFrame(records)
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df['pctChg'] = df['close'].pct_change().fillna(0) * 100
        df = self._calculate_indicators(df)
        return df, f"AlphaVantage {avticker}"

    def _fetch_forex(self, pair, start_date, end_date):
        if not REQUESTS_AVAILABLE:
            raise NetworkError("requests 未安装")
        raw = pair.strip().upper()
        if raw.startswith('FOREX.'):
            raw = raw[6:]
        if len(raw) == 6:
            base, quote = raw[:3], raw[3:]
        elif len(raw) >= 7 and raw[3] in '/_':
            base, quote = raw[:3], raw[4:]
        else:
            raise DataValidationError("外汇格式应为 EURUSD / EUR/USD")
        url = f"https://api.frankfurter.app/{start_date}..{end_date}?from={base}&to={quote}"
        resp = requests.get(url, timeout=self.REQUEST_TIMEOUT)
        data = resp.json()
        if 'rates' not in data:
            raise DataFetchError("外汇API无数据")
        records = []
        for d, rate in sorted(data['rates'].items()):
            c = rate[quote]
            records.append({'date': d, 'open': c, 'high': c, 'low': c, 'close': c, 'volume': 0})
        df = pd.DataFrame(records)
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        df['pctChg'] = df['close'].pct_change().fillna(0) * 100
        df = self._calculate_indicators(df)
        return df, f"Forex {base}/{quote}"

    def _fetch_crypto(self, symbol, start_date, end_date):
        if not REQUESTS_AVAILABLE:
            raise NetworkError("requests 未安装")
        raw = symbol.strip().lower()
        sym = raw.replace('crypto.', '').split('-')[0]
        id_map = {'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'xrp': 'ripple', 'bnb': 'binancecoin',
                  'ada': 'cardano', 'doge': 'dogecoin', 'dot': 'polkadot'}
        cg_id = id_map.get(sym, sym)
        t1 = int(time.mktime(datetime.strptime(start_date, '%Y-%m-%d').timetuple()))
        t2 = int(time.mktime(datetime.strptime(end_date, '%Y-%m-%d').timetuple()))
        url = f"https://api.coingecko.com/api/v3/coins/{cg_id}/market_chart/range?vs_currency=usd&from={t1}&to={t2}"
        resp = requests.get(url, timeout=self.REQUEST_TIMEOUT)
        if resp.status_code == 429:
            raise NetworkError("CoinGecko 请求超限")
        data = resp.json()
        prices = data.get('prices', [])
        if not prices:
            raise DataFetchError("无加密货币数据")
        records = []
        for ts_ms, p in prices:
            d = datetime.fromtimestamp(ts_ms / 1000).strftime('%Y-%m-%d')
            records.append({'date': d, 'close': p})
        df = pd.DataFrame(records)
        df = df.drop_duplicates('date').sort_values('date')
        df['open'] = df['high'] = df['low'] = df['close']
        df['volume'] = 0
        df['pctChg'] = df['close'].pct_change().fillna(0) * 100
        df = self._calculate_indicators(df)
        return df, f"Crypto {cg_id.upper()}"

    # -------------------------------------------------------------------------
    # A股
    # -------------------------------------------------------------------------
    def _fetch_a_share(self, code, start_date, end_date):
        if not BAOSTOCK_AVAILABLE:
            return self.generate_builtin_data(60), "模拟数据（baostock不可用）"
        self.login()
        rs = bs.query_history_k_data_plus(
            code,
            "date,open,high,low,close,volume,amount,pctChg",
            start_date=start_date, end_date=end_date,
            frequency="d", adjustflag="3"
        )
        if rs.error_code != '0':
            return self.generate_builtin_data(60), f"模拟数据（{rs.error_msg}）"
        data = rs.get_data()
        if data.empty:
            return self.generate_builtin_data(60), "模拟数据（无返回）"
        df = data.copy()
        df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
        for col in ['open', 'high', 'low', 'close', 'volume', 'amount', 'pctChg']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        df = self._calculate_indicators(df)
        return df, f"A股 {code}"

    # -------------------------------------------------------------------------
    # 统一入口
    # -------------------------------------------------------------------------
    def fetch_data(self, user_input, start_date, end_date):
        try:
            self._validate_date_range(start_date, end_date)
            market = self.detect_market(user_input)
            logger.info(f"输入={user_input}  识别市场={market}")

            # 缓存优先
            cache_code = self.format_code(user_input) if market == 'a' else user_input
            cached = self._get_from_cache(cache_code, start_date, end_date)
            if cached is not None:
                return True, cached.copy(), "缓存读取成功"

            # 市场路由
            if market == 'a':
                df, msg = self._fetch_a_share(cache_code, start_date, end_date)
            elif market in ('us', 'hk'):
                try:
                    df, msg = self._fetch_yahoo_finance(user_input, start_date, end_date)
                except NetworkError as e:
                    if 'limit' in str(e).lower() or '429' in str(e):
                        df, msg = self._fetch_alpha_vantage(user_input, start_date, end_date)
                    else:
                        raise
            elif market == 'forex':
                df, msg = self._fetch_forex(user_input, start_date, end_date)
            elif market == 'crypto':
                df, msg = self._fetch_crypto(user_input, start_date, end_date)
            else:
                raise DataValidationError(
                    f"不支持的标的：{user_input}\n支持：A股、us.AAPL、hk.00700、forex.EURUSD、crypto.btc"
                )

            self._save_to_cache(cache_code, start_date, end_date, df)
            return True, df.copy(), msg

        except (DataValidationError, NetworkError, DataFetchError) as e:
            logger.error(f"{type(e).__name__}: {e}")
            return False, None, str(e)
        except Exception as e:
            logger.error(f"未知错误: {e}", exc_info=True)
            return False, None, f"获取失败: {str(e)}"

    # -------------------------------------------------------------------------
    # 模拟数据
    # -------------------------------------------------------------------------
    def generate_builtin_data(self, days=60):
        dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
        t = np.linspace(0, 4 * np.pi, days)
        base = 3000 + 200 * np.sin(t) + np.cumsum(np.random.randn(days) * 5)
        close = base
        open_ = close * (1 + np.random.randn(days) * 0.005)
        high = np.maximum(open_, close) * (1 + np.abs(np.random.randn(days) * 0.01))
        low = np.minimum(open_, close) * (1 - np.abs(np.random.randn(days) * 0.01))
        vol = 1e8 + np.random.randn(days) * 2e7
        pct = np.diff(close, prepend=close[0]) / close * 100
        df = pd.DataFrame({
            'date': dates.strftime('%Y-%m-%d'),
            'open': open_, 'high': high, 'low': low, 'close': close,
            'volume': vol, 'pctChg': pct
        })
