import requests

url = "https://api-resultadosloterias.com/api/results/2026-06-26"
try:
    r = requests.get(url, timeout=20)
    print("Status code:", r.status_code)
    print("Response text:", r.text[:1000])
except Exception as e:
    print("Error:", e)
