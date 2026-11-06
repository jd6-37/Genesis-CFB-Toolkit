| Celebration palette override, placed at 0x1F0320.
| Replaces "moveq #7,d0 ; lea $d946.w,a1 ; 1: move.l (a0)+,(a1)+ ; dbra d0,1b" at 0x079F00
| (12 bytes: the copy of the celebration's palette line to RAM) with "jsr CP ; nop ; nop ; nop".
| When the generic card stunt is playing (its image container is at 0x1EEF42), entries 9 (cards),
| 10 (skirts, pom-poms) and 13 (tops) are replaced with the winning team's colors from CT.
| The winner is found the way 0x079E84 does it: home if home score - visitor score >= 0.
        .text
        .org 0
CP:     moveq   #7,%d0
        lea     0xD946:w,%a1
1:      move.l  (%a0)+,(%a1)+
        dbra    %d0,1b
        cmpa.l  #0x1EEF42,%a4
        bne.s   9f
        movem.l %d0-%d1/%a0,-(%sp)
        jsr     0x6F90A
        move.w  0xE1B2:w,%d1
        tst.w   %d0
        bpl.s   2f
        move.w  0xE2E8:w,%d1
2:      mulu.w  #6,%d1
        lea     CT(%pc,%d1.w),%a0
        move.w  (%a0)+,0xD958:w
        move.w  (%a0)+,0xD95A:w
        move.w  (%a0)+,0xD960:w
        movem.l (%sp)+,%d0-%d1/%a0
9:      rts
        .balign 2
CT:     .fill   108,2,0
END:
