import asyncio
import sys
import traceback
from app.main import app

async def main():
    scope = {
        'type': 'http',
        'asgi': {'version': '3.0'},
        'http_version': '1.1',
        'method': 'POST',
        'path': '/api/login',
        'raw_path': b'/api/login',
        'query_string': b'',
        'headers': [
            (b'content-type', b'application/json'),
            (b'origin', b'http://127.0.0.1:5500')
        ]
    }
    async def receive():
        return {
            'type': 'http.request',
            'body': b'{"usuario": "teomesa", "password": "2901"}',
            'more_body': False
        }
    async def send(message):
        print("SEND MESSAGE:", message)

    try:
        await app(scope, receive, send)
    except Exception as e:
        print("EXCEPTION CAUGHT IN MAIN:")
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())
