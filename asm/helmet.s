| Setup-screen helmet tile base, placed at 0x1F0300.
| Replaces "addi.w #$ae,d4 ; movea.l $e1b4/$e2ea.w,a0 ; adda.w $a(a0),a0" (12 bytes)
| with "movea.l $e1b4/$e2ea.w,a0 ; jsr HB ; nop".
| Stock: helmet at slot base + 174. Helmets over 32 tiles are moved down so they end
| at slot base + 206 (the next slot), which is safe because swapped mascots are small.
        .text
        .org 0
HB:     adda.w  0x0A(%a0),%a0
        move.w  8(%a0),%d0
        cmp.w   #32,%d0
        bls.s   1f
        addi.w  #206,%d4
        sub.w   %d0,%d4
        rts
1:      addi.w  #174,%d4
        rts
END:
