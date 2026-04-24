#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电子阅读器 - 本地服务器
启动后请在浏览器中访问: http://localhost:8080
"""

import http.server
import socketserver
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {args[0]}")

def main():
    os.chdir(DIRECTORY)
    
    print("=" * 50)
    print("📚 电子阅读器")
    print("=" * 50)
    print(f"服务器目录: {DIRECTORY}")
    print(f"监听端口: {PORT}")
    print()
    print("请在浏览器中访问以下地址:")
    print(f"  http://localhost:{PORT}")
    print(f"  http://127.0.0.1:{PORT}")
    print()
    print("按 Ctrl+C 停止服务器")
    print("=" * 50)
    print()
    
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n")
        print("=" * 50)
        print("服务器已停止")
        print("=" * 50)
        sys.exit(0)
    except OSError as e:
        if "address already in use" in str(e).lower():
            print(f"错误: 端口 {PORT} 已被占用")
            print("请尝试关闭其他占用该端口的程序，或修改脚本中的端口号")
        else:
            print(f"错误: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
