## Library considerations

[X] Add Lit for DOM rendering
[ ] Add ts-pattern for reducer

## Features

[ ] Update finesse BFS to support soft drops (ugh)
[ ] Game mode: learn openers

## Infra

[ ] DAS state machine -- trigger movement on hold start before keypress released; if it's a tap, don't go further, if it's a hold then transition to DAS
[ ] Integration test for Freeplay mode: initialize the app, play the first 7-10 pieces, expect finesse errors and lineclears and gravity and DAS
