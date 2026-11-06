| Menu-order stepping helpers, placed at 0x1F0000.
| H:  d0 = team, d2 = delta  ->  d0 = next team in display order
| G3: d0 = delta, team in $E1B2 ; G4: d0 = delta, team in $72(a2)
        .text
        .org 0
H:      movem.l %d1/%a0,-(%sp)
        lea     INV(%pc),%a0
        moveq   #0,%d1
        move.b  (%a0,%d0.w),%d1
        add.w   %d2,%d1
        bpl.s   1f
        moveq   #35,%d1
1:      cmp.w   #36,%d1
        blt.s   2f
        moveq   #0,%d1
2:      lea     ORD(%pc),%a0
        moveq   #0,%d0
        move.b  (%a0,%d1.w),%d0
        movem.l (%sp)+,%d1/%a0
        rts
G3:     move.w  %d2,-(%sp)
        move.w  %d0,%d2
        move.w  0xE1B2:w,%d0
        bsr.s   H
        move.w  (%sp)+,%d2
        rts
G4:     move.w  %d2,-(%sp)
        move.w  %d0,%d2
        move.w  0x72(%a2),%d0
        bsr.s   H
        move.w  (%sp)+,%d2
        rts
        .balign 2
ORD:    .fill   36,1,0xAA
INV:    .fill   36,1,0xBB
END:
