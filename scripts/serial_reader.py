#!/usr/bin/env python3
"""
Simple serial barcode/QR scanner reader for Raspberry Pi.

Reads newline-terminated values from a serial device (e.g. /dev/ttyUSB0),
trims the input, and performs an HTTP GET to the production backend:
  http://192.168.88.8:6601/rxqueue/{HN}

Usage:
  sudo apt install python3-pip
  pip3 install pyserial requests
  python3 scripts/serial_reader.py --device /dev/ttyUSB0

Options:
  --device    Serial device (default /dev/ttyUSB0)
  --baud      Baud rate (default 9600)
  --print-only  Print scanned codes but do not call HTTP
  --backend   Override backend base URL

"""
import argparse
import logging
import sys
import time
import requests

try:
    import serial
except Exception:
    print('Missing dependency: install with `pip3 install pyserial requests`')
    raise

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--device', default='/dev/ttyUSB0', help='Serial device')
    p.add_argument('--baud', type=int, default=9600, help='Baud rate')
    p.add_argument('--print-only', action='store_true', help='Only print scanned codes')
    p.add_argument('--backend', default='http://192.168.88.8:6601', help='Backend base URL')
    args = p.parse_args()

    try:
        ser = serial.Serial(args.device, args.baud, timeout=1)
    except Exception as e:
        logging.error('Failed to open serial device %s: %s', args.device, e)
        sys.exit(1)

    logging.info('Listening on %s @ %d', args.device, args.baud)

    while True:
        try:
            raw = ser.readline()
            if not raw:
                time.sleep(0.05)
                continue
            try:
                s = raw.decode('utf-8', errors='ignore').strip()
            except Exception:
                s = raw.strip().decode('latin1', errors='ignore')
            if not s:
                continue
            logging.info('Scanned: %s', s)
            if args.print_only:
                continue

            # Build URL and call backend
            hn = s
            url = f"{args.backend.rstrip('/')}/rxqueue/{requests.utils.requote_uri(hn)}"
            try:
                r = requests.get(url, timeout=5)
                if r.ok:
                    try:
                        data = r.json()
                        logging.info('Backend response: %s', data)
                    except Exception:
                        logging.info('Backend returned non-JSON: %s', r.text[:200])
                else:
                    logging.warning('Backend returned status %s: %s', r.status_code, r.text[:200])
            except requests.exceptions.RequestException as e:
                logging.error('HTTP request failed: %s', e)

        except KeyboardInterrupt:
            logging.info('Interrupted, exiting')
            break
        except Exception as e:
            logging.exception('Unexpected error: %s', e)
            time.sleep(1)

if __name__ == '__main__':
    main()
