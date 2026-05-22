from http.server import HTTPServer, SimpleHTTPRequestHandler
import os

class MyHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        html = '''<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
    <style>
        body { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: Arial; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0;
        }
        .box { 
            background: white; 
            padding: 50px; 
            border-radius: 20px; 
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #667eea; margin: 0; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="box">
        <h1>✅ Port 5000 Works!</h1>
        <p>Server is running correctly on 0.0.0.0:5000</p>
    </div>
</body>
</html>'''
        self.wfile.write(html.encode())

print("🚀 Test server running on http://0.0.0.0:8888")
HTTPServer(('0.0.0.0', 8888), MyHandler).serve_forever()
