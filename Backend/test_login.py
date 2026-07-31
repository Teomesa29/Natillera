import urllib.request
import json
try:
    data = json.dumps({"usuario": "teomesa", "password": "2901"}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:8000/api/login', data=data, headers={'Content-Type': 'application/json'})
    urllib.request.urlopen(req)
except Exception as e:
    print(e.read().decode())
