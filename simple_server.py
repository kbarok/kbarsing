"""kbarok v3 - Simple HTTP server (IPv4 only)"""
import http.server, socketserver, os

PORT = 8899
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        print(f"[HTTP] {args[0]} {args[2]}")

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"[kbarok] Serving at http://127.0.0.1:{PORT}")
    httpd.serve_forever()
