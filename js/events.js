/**
 * kbarok v9 - events.js
 * 极简事件总线，用于模块间解耦
 */

const AppEvents = (function() {
    const listeners = {};
    
    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        return () => off(event, callback);
    }
    
    function off(event, callback) {
        if (!listeners[event]) return;
        if (callback) {
            listeners[event] = listeners[event].filter(cb => cb !== callback);
        } else {
            delete listeners[event];
        }
    }
    
    function emit(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`[Events] ${event} 执行错误:`, e);
            }
        });
    }
    
    function once(event, callback) {
        const wrapper = (data) => {
            off(event, wrapper);
            callback(data);
        };
        on(event, wrapper);
    }
    
    function clear() {
        Object.keys(listeners).forEach(key => delete listeners[key]);
    }
    
    return { on, off, emit, once, clear };
})();

window.AppEvents = AppEvents;