| End zone color override, placed at 0x1F0280.
| Replaces "move.w $18(a0),d0 ; bsr.w $704b0" at 0x076F44 (a0 = home uniforms).
| Table: 36 words, 0 = stock (darkened jersey dark shade), else the color used as-is.
        .text
        .org 0
EZ:     move.w  0xE1B2:w,%d0
        add.w   %d0,%d0
        move.w  EZT(%pc,%d0.w),%d0
        bne.s   1f
        move.w  0x18(%a0),%d0
        jmp     0x704B0
1:      rts
        .balign 2
EZT:    .fill   36,2,0xCCCC
END:
