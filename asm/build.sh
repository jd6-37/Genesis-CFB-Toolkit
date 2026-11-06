#!/bin/sh
# Assembles the 68k helpers and regenerates src/core/helpers68k.ts.
# Needs binutils for m68k (Debian/Ubuntu: apt install binutils-m68k-linux-gnu).
set -e
cd "$(dirname "$0")"
for f in menuorder endzone helmet celebration; do
  m68k-linux-gnu-as -m68000 -o /tmp/$f.o $f.s
  m68k-linux-gnu-objcopy -O binary /tmp/$f.o /tmp/$f.bin
done
python3 gen.py
