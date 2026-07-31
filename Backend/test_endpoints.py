import urllib.request
import json

API = "http://127.0.0.1:8000"

def test_endpoint(name, path, method="GET", body=None, token=None):
    print(f"\n--- TESTING: {name} ({method} {path}) ---")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    data = None
    if body:
        data = json.dumps(body).encode('utf-8')
        
    req = urllib.request.Request(f"{API}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            res_body = res.read().decode('utf-8')
            print(f"Status: {res.status}")
            print(f"Response: {res_body[:500]}")
            if len(res_body) > 500:
                print("... (truncated)")
            return json.loads(res_body) if res_body else None
    except Exception as e:
        print(f"FAILED: {e}")
        if hasattr(e, 'read'):
            print(f"Error Detail: {e.read().decode('utf-8')}")
        return None

# 1. Test Login
login_data = test_endpoint(
    "Login", 
    "/api/login", 
    method="POST", 
    body={"usuario": "teomesa", "password": "2901"}
)

if login_data:
    token = login_data.get("access_token")
    
    # 2. List Users
    test_endpoint("Listar Usuarios", "/api/usuarios", token=token)
    
    # 3. Estado Polla
    test_endpoint("Estado Polla", "/api/polla/estado/1", token=token)
    
    # 4. Historial Polla
    test_endpoint("Historial Polla", "/api/polla/historial", token=token)
    
    # 5. Registrar Aporte
    test_endpoint(
        "Registrar Aporte",
        "/api/ahorros/1/registrar_aporte",
        method="POST",
        body={"mes": "Julio", "anio": 2026},
        token=token
    )
    
    # 6. Registrar Polla
    test_endpoint(
        "Registrar Polla",
        "/api/ahorros/1/registrar_polla",
        method="POST",
        body={"mes": "Julio", "anio": 2026},
        token=token
    )

# 7. Recuperar password (email: restrepomate@gmail.com, celular: 3113009882)
test_endpoint(
    "Recuperar Contraseña",
    "/api/recuperar-password",
    method="POST",
    body={"email": "restrepomate@gmail.com", "celular": "3113009882", "nueva_password": "2901"}
)
