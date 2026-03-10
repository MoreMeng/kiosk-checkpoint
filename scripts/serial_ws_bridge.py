#!/usr/bin/env python3
"""
Serial -> WebSocket bridge

Reads newline-terminated codes from a serial device (e.g. /dev/ttyUSB0) and
broadcasts them to all connected WebSocket clients.

Dependencies: `pip3 install websockets pyserial`

Run:
  python3 scripts/serial_ws_bridge.py --device /dev/ttyUSB0
"""
import argparse
import asyncio
import logging
import threading

try:
    import serial
except Exception:
    print('Missing pyserial: pip3 install pyserial')
    raise

try:
    import websockets
except Exception:
    print('Missing websockets: pip3 install websockets')
    raise

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

clients = set()

async def handler(ws, path):
    logging.info('Client connected %s', ws.remote_address)
    clients.add(ws)
    try:
        await ws.wait_closed()
    finally:
        clients.remove(ws)
        logging.info('Client disconnected %s', ws.remote_address)

async def broadcast(msg):
    if not clients:
        return
    logging.info('Broadcasting: %s', msg)
    to_remove = []
    for ws in clients:
        try:
            await ws.send(msg)
        except Exception:
            to_remove.append(ws)
    for ws in to_remove:
        clients.discard(ws)

def serial_loop(device, baud, loop):
    try:
        ser = serial.Serial(device, baud, timeout=1)
    except Exception as e:
        logging.error('Failed to open serial device %s: %s', device, e)
        return
    logging.info('Serial reader started on %s @ %d', device, baud)
    while True:
        try:
            raw = ser.readline()
            if not raw:
                continue
            try:
                s = raw.decode('utf-8', errors='ignore').strip()
            except Exception:
                s = raw.strip().decode('latin1', errors='ignore')
            if not s:
                continue
            # schedule broadcast on the asyncio loop
            asyncio.run_coroutine_threadsafe(broadcast(s), loop)
        except Exception as e:
            logging.exception('Serial read error: %s', e)
            break

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--device', default='/dev/ttyUSB0')
    p.add_argument('--baud', type=int, default=9600)
    p.add_argument('--port', type=int, default=8765)
    args = p.parse_args()

    async def main_async():
        server = await websockets.serve(handler, '0.0.0.0', args.port)
        logging.info('WebSocket server listening on ws://0.0.0.0:%d', args.port)

        loop = asyncio.get_running_loop()
        t = threading.Thread(target=serial_loop, args=(args.device, args.baud, loop), daemon=True)
        t.start()

        try:
            # run until cancelled (serve forever)
            await asyncio.Future()
        except asyncio.CancelledError:
            logging.info('Shutting down')
        finally:
            server.close()
            await server.wait_closed()

    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logging.info('Keyboard interrupt, exiting')

if __name__ == '__main__':
    main()
