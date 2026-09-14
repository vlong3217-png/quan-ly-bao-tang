import json
import random
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

PORT = 5000

# Heritage Artifacts Data
ARTIFACTS_DATA = []

USERS_DATA = [
    {"id": 1, "fullName": "Phạm Đức Quang", "username": "admin", "role": "ADMIN", "roleName": "Quản trị viên"},
    {"id": 2, "fullName": "Trần Thị Mai", "username": "banve01", "role": "BANVE", "roleName": "Bán vé & Đón tiếp"},
    {"id": 3, "fullName": "Lê Hoàng Nam", "username": "thukho01", "role": "THUKHO", "roleName": "Kiểm kê & Thủ kho"}
]

class MuseumAPIHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            self.send_json({"status": "OK", "message": "Python REST Backend Server for Museum Management System"})
        elif path == '/api/artifacts':
            self.send_json({"success": True, "count": len(ARTIFACTS_DATA), "data": ARTIFACTS_DATA})
        elif path == '/api/users':
            self.send_json({"success": True, "data": USERS_DATA})
        elif path == '/api/categories/ticket-prices':
            self.send_json({
                "success": True,
                "data": [
                    {"code": "LV-01", "name": "Vé Người Lớn", "price": 40000},
                    {"code": "LV-02", "name": "Vé HSSV", "price": 20000}
                ]
            })
        else:
            # Fallback to static files
            super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get('Content-Length', 0))
        body_data = {}
        if content_length > 0:
            post_body = self.rfile.read(content_length)
            try:
                body_data = json.loads(post_body.decode('utf-8'))
            except:
                pass

        if path == '/api/auth/login':
            username = body_data.get('username', '')
            found = next((u for u in USERS_DATA if u['username'].lower() == username.lower()), None)
            if found:
                self.send_json({
                    "success": True,
                    "message": f"Đăng nhập thành công! Vai trò: {found['roleName']}",
                    "token": f"mock_jwt_token_{found['username']}",
                    "user": found
                })
            else:
                self.send_json({"success": False, "message": "Tài khoản không tồn tại!"}, status=401)
        elif path == '/api/tickets/book':
            rand_num = random.randint(10000, 90000)
            t_code = f"#VE-2026-{rand_num}"
            self.send_json({
                "success": True,
                "message": "Đặt vé thành công từ Python Backend!",
                "data": {
                    "ticketCode": t_code,
                    "qrUrl": f"https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=BAOTANG-{t_code}"
                }
            })
        else:
            self.send_json({"success": False, "message": "Endpoint not found"}, status=404)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), MuseumAPIHandler)
    print(f"============================================================")
    print(f"[+] BAO TANG VAN HOA CAC DAN TOC VIET NAM - PYTHON BACKEND")
    print(f"[+] RESTful API Server running on http://localhost:{PORT}")
    print(f"============================================================")
    server.serve_forever()
